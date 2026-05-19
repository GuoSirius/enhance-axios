import axios, { AxiosInstance, AxiosRequestConfig, CancelTokenSource, AxiosError } from 'axios';
import { RequestManager } from './requestManager';
import { resolveRequestKey } from '../utils';
import type { CreateEnhanceOptions, EnhanceInstance, PreventDuplicateConfig, CancelRequestConfig } from '../types';

interface EnhanceInstanceInternal extends AxiosInstance {
  enhance: EnhanceInstance;
}

// 存储待返回的 Promise，用于防重复
const pendingReturns = new Map<string, Promise<unknown>>();

function createEnhanceInstance(options: CreateEnhanceOptions = {}): EnhanceInstanceInternal {
  const instance = axios.create(options) as EnhanceInstanceInternal;

  // 从实例配置中提取防重复和取消请求的默认配置
  const defaultPrevent: PreventDuplicateConfig = {};
  const defaultCancel: CancelRequestConfig = {};

  if (options.preventDuplicate !== undefined) {
    if (typeof options.preventDuplicate === 'boolean') {
      defaultPrevent.enabled = options.preventDuplicate;
    } else {
      Object.assign(defaultPrevent, options.preventDuplicate);
    }
  }

  if (options.cancelRequest !== undefined) {
    if (typeof options.cancelRequest === 'boolean') {
      defaultCancel.enabled = options.cancelRequest;
    } else {
      Object.assign(defaultCancel, options.cancelRequest);
    }
  }

  const requestManager = new RequestManager(defaultPrevent, defaultCancel);

  const enhanceInstance: EnhanceInstance = {
    requestManager,
    clearAll: () => requestManager.clearAll(),
    cancelRequest: (key: string) => requestManager.cancelRequest(key),
    getRequestStatus: (key: string) => requestManager.getRequestStatus(key),
  };

  // 请求拦截器 - 处理防重复和取消请求
  instance.interceptors.request.use((config) => {
    const preventConfig = config.preventDuplicate;
    const cancelConfig = config.cancelRequest;

    // 合并实例级别和请求级别的配置
    const mergedPrevent = mergePreventConfig(defaultPrevent, preventConfig);
    const mergedCancel = mergeCancelConfig(defaultCancel, cancelConfig);

    // 处理取消请求（先处理，取消旧请求）
    if (mergedCancel.enabled && shouldApply(config.method, mergedCancel.methods)) {
      const key = resolveRequestKey(config, mergedCancel.requestKey);
      requestManager.cancelRequest(key);
    }

    // 处理防重复提交
    if (mergedPrevent.enabled && shouldApply(config.method, mergedPrevent.methods)) {
      const key = resolveRequestKey(config, mergedPrevent.requestKey);

      // 检查是否有正在进行的相同请求
      const existing = requestManager.getRequestStatus(key);
      if (existing) {
        const now = Date.now();
        // 如果请求还在 intervalMs 内，则返回已有请求的 Promise
        if (now - existing.timestamp < mergedPrevent.intervalMs) {
          // 阻止当前请求，返回已有请求的 Promise
          const pendingPromise = pendingReturns.get(key);
          if (pendingPromise) {
            // 使用 CancelToken 取消当前请求
            const source = axios.CancelToken.source();
            (config as any).__cancelTokenSource = source;
            source.cancel('Request prevented by duplicate');
            // 返回一个 rejected promise，让响应拦截器处理
            const error = new Error('Request prevented by duplicate') as AxiosError;
            (error as any).__preventReturn = true;
            (error as any).__pendingKey = key;
            (error as any).__pendingPromise = existing.promise;
            error.config = config;
            return Promise.reject(error);
          }
        }
      }
    }

    return config;
  });

  // 响应拦截器 - 处理防重复返回
  instance.interceptors.response.use(
    (response) => {
      // 清理请求记录
      const key = (response.config as any).__pendingKey;
      if (key) {
        pendingReturns.delete(key);
        requestManager.unregisterRequest(key, 'prevent');
      }
      return response;
    },
    (error) => {
      // 处理防重复的 Promise 返回
      if ((error as any)?.__preventReturn && (error as any)?.__pendingPromise) {
        // 返回原请求的 Promise
        return (error as any).__pendingPromise;
      }

      // 清理请求记录
      if (error?.config) {
        const key = (error.config as any).__pendingKey;
        if (key) {
          pendingReturns.delete(key);
          requestManager.unregisterRequest(key, 'prevent');
        }
        requestManager.unregisterRequest(key, 'cancel');
      }

      return Promise.reject(error);
    }
  );

  // 添加 enhance 属性
  instance.enhance = enhanceInstance;

  // 添加 RESTful 方法封装 - 统一格式: (url, data, config?)
  const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];

  for (const method of methods) {
    const originalMethod = instance[method as keyof AxiosInstance] as any;
    (instance as any)[method] = (url: string, data?: any, config?: AxiosRequestConfig) => {
      const finalConfig: AxiosRequestConfig = {
        ...config,
        url,
        method: method.toUpperCase(),
      };

      // 根据方法类型决定 data 参数的位置
      if (['GET', 'HEAD', 'OPTIONS', 'DELETE'].includes(finalConfig.method!)) {
        if (data) {
          finalConfig.params = data;
        }
      } else {
        if (data !== undefined) {
          finalConfig.data = data;
        }
      }

      return originalMethod.call(instance, finalConfig);
    };
  }

  return instance;
}

function shouldApply(method?: string, methods?: string[]): boolean {
  if (!methods || methods.length === 0) return true;
  return methods.includes(method?.toUpperCase() || 'GET');
}

function mergePreventConfig(
  instanceConfig: PreventDuplicateConfig,
  requestConfig: PreventDuplicateConfig | boolean | undefined
): { enabled: boolean; requestKey?: string; methods?: string[]; intervalMs: number } {
  const result = {
    enabled: instanceConfig.enabled ?? true,
    requestKey: instanceConfig.requestKey,
    methods: instanceConfig.methods,
    intervalMs: instanceConfig.intervalMs ?? 1000,
  };

  if (requestConfig === false) {
    result.enabled = false;
  } else if (requestConfig === true) {
    result.enabled = true;
  } else if (typeof requestConfig === 'object') {
    result.enabled = requestConfig.enabled ?? instanceConfig.enabled ?? true;
    if (requestConfig.requestKey !== undefined) result.requestKey = requestConfig.requestKey;
    if (requestConfig.methods !== undefined) result.methods = requestConfig.methods;
    if (requestConfig.intervalMs !== undefined) result.intervalMs = requestConfig.intervalMs;
  }

  return result;
}

function mergeCancelConfig(
  instanceConfig: CancelRequestConfig,
  requestConfig: CancelRequestConfig | boolean | undefined
): { enabled: boolean; requestKey?: string; methods?: string[] } {
  const result = {
    enabled: instanceConfig.enabled ?? true,
    requestKey: instanceConfig.requestKey,
    methods: instanceConfig.methods,
  };

  if (requestConfig === false) {
    result.enabled = false;
  } else if (requestConfig === true) {
    result.enabled = true;
  } else if (typeof requestConfig === 'object') {
    result.enabled = requestConfig.enabled ?? instanceConfig.enabled ?? true;
    if (requestConfig.requestKey !== undefined) result.requestKey = requestConfig.requestKey;
    if (requestConfig.methods !== undefined) result.methods = requestConfig.methods;
  }

  return result;
}

export { createEnhanceInstance };
export type { CreateEnhanceOptions, EnhanceInstance, PreventDuplicateConfig, CancelRequestConfig } from '../types';