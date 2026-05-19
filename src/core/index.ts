import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import { RequestManager } from './requestManager';
import { resolveRequestKey } from '../utils';
import type { CreateEnhanceOptions, EnhanceInstance, PreventDuplicateConfig, CancelRequestConfig, RetryConfig } from '../types';

interface EnhanceInstanceInternal extends AxiosInstance {
  enhance: EnhanceInstance;
}

// 存储待返回的 Promise，用于防重复
const pendingReturns = new Map<string, Promise<unknown>>();

// 默认重试配置
const defaultRetryConfig = {
  enabled: true,
  retries: 3,
  retryDelay: 1000,
  retryCondition: (error: AxiosError) => {
    // 默认重试条件：网络错误或 5xx 错误
    return !error.response || (error.response.status >= 500 && error.response.status < 600);
  },
  exponential: true,
  maxDelay: 30000,
  methods: undefined as string[] | undefined,
  statusCodes: [408, 429, 500, 502, 503, 504],
};

// 防重复配置归一化
function normalizePreventConfig(
  config: any,
  defaults: { enabled: boolean; requestKey?: string | Function; methods?: string[] | undefined; intervalMs: number }
): { enabled: boolean; requestKey?: string | Function; methods?: string[] | undefined; intervalMs: number } {
  // undefined/null 视为未传递
  if (config === undefined || config === null) {
    return defaults;
  }

  // boolean -> enabled
  if (typeof config === 'boolean') {
    return { ...defaults, enabled: config };
  }

  // string -> requestKey
  if (typeof config === 'string') {
    return { ...defaults, requestKey: config };
  }

  // function -> requestKey
  if (typeof config === 'function') {
    return { ...defaults, requestKey: config };
  }

  // number -> intervalMs
  if (typeof config === 'number') {
    return { ...defaults, intervalMs: config };
  }

  // array -> methods
  if (Array.isArray(config)) {
    return { ...defaults, methods: config as string[] };
  }

  // object -> 合并
  return {
    enabled: config.enabled ?? defaults.enabled,
    requestKey: config.requestKey ?? defaults.requestKey,
    methods: config.methods !== undefined ? config.methods : defaults.methods,
    intervalMs: config.intervalMs ?? defaults.intervalMs,
  };
}

// 取消请求配置归一化
function normalizeCancelConfig(
  config: any,
  defaults: { enabled: boolean; requestKey?: string | Function; methods?: string[] | undefined }
): { enabled: boolean; requestKey?: string | Function; methods?: string[] | undefined } {
  // undefined/null 视为未传递
  if (config === undefined || config === null) {
    return defaults;
  }

  // boolean -> enabled
  if (typeof config === 'boolean') {
    return { ...defaults, enabled: config };
  }

  // string -> requestKey
  if (typeof config === 'string') {
    return { ...defaults, requestKey: config };
  }

  // function -> requestKey
  if (typeof config === 'function') {
    return { ...defaults, requestKey: config };
  }

  // array -> methods
  if (Array.isArray(config)) {
    return { ...defaults, methods: config as string[] };
  }

  // object -> 合并
  return {
    enabled: config.enabled ?? defaults.enabled,
    requestKey: config.requestKey ?? defaults.requestKey,
    methods: config.methods !== undefined ? config.methods : defaults.methods,
  };
}

// 重试配置归一化
function normalizeRetryConfig(
  config: any,
  defaults: { enabled: boolean; retries: number; retryDelay: number; retryCondition: (error: AxiosError) => boolean; exponential: boolean; maxDelay: number; methods?: string[] | undefined; statusCodes: number[] }
): { enabled: boolean; retries: number; retryDelay: number; retryCondition: (error: AxiosError) => boolean; exponential: boolean; maxDelay: number; methods?: string[] | undefined; statusCodes: number[] } {
  // undefined/null 视为未传递
  if (config === undefined || config === null) {
    return defaults;
  }

  // boolean -> enabled
  if (typeof config === 'boolean') {
    return { ...defaults, enabled: config };
  }

  // number -> retries
  if (typeof config === 'number') {
    return { ...defaults, retries: config };
  }

  // object -> 合并
  return {
    enabled: config.enabled ?? defaults.enabled,
    retries: config.retries ?? defaults.retries,
    retryDelay: config.retryDelay ?? defaults.retryDelay,
    retryCondition: config.retryCondition ?? defaults.retryCondition,
    exponential: config.exponential ?? defaults.exponential,
    maxDelay: config.maxDelay ?? defaults.maxDelay,
    methods: config.methods !== undefined ? config.methods : defaults.methods,
    statusCodes: config.statusCodes ?? defaults.statusCodes,
  };
}

// 计算重试延迟
function calculateRetryDelay(retryConfig: { retryDelay: number; exponential: boolean; maxDelay: number }, retryCount: number): number {
  let delay = retryConfig.retryDelay;
  if (retryConfig.exponential) {
    delay = Math.min(retryConfig.retryDelay * Math.pow(2, retryCount), retryConfig.maxDelay);
  }
  return delay;
}

// 重试函数
async function retryRequest(
  instance: AxiosInstance,
  config: AxiosRequestConfig,
  retryConfig: Required<RetryConfig>,
  retryCount: number = 0
): Promise<any> {
  try {
    return await instance.request(config);
  } catch (error: any) {
    const shouldRetry =
      retryConfig.enabled &&
      retryCount < retryConfig.retries &&
      retryConfig.retryCondition(error);

    if (!shouldRetry) {
      throw error;
    }

    // 检查状态码
    if (error.response && retryConfig.statusCodes) {
      const shouldRetryStatus = retryConfig.statusCodes.includes(error.response.status);
      if (!shouldRetryStatus) {
        throw error;
      }
    }

    // 计算延迟
    const delay = calculateRetryDelay(retryConfig, retryCount);

    // 等待后重试
    await new Promise(resolve => setTimeout(resolve, delay));

    return retryRequest(instance, config, retryConfig, retryCount + 1);
  }
}

function createEnhanceInstance(options: CreateEnhanceOptions = {}): EnhanceInstanceInternal {
  const instance = axios.create(options) as EnhanceInstanceInternal;

  // 默认配置
  const defaultPrevent = { enabled: true, intervalMs: 1000 };
  const defaultCancel = { enabled: true };
  const defaultRetry = { ...defaultRetryConfig };

  // 处理实例级别的防重复配置
  const instancePrevent = options.preventDuplicate;
  if (instancePrevent !== undefined && instancePrevent !== null) {
    const normalized = normalizePreventConfig(instancePrevent, defaultPrevent);
    Object.assign(defaultPrevent, normalized);
  }

  // 处理实例级别的取消请求配置
  const instanceCancel = options.cancelRequest;
  if (instanceCancel !== undefined && instanceCancel !== null) {
    const normalized = normalizeCancelConfig(instanceCancel, defaultCancel);
    Object.assign(defaultCancel, normalized);
  }

  // 处理实例级别的重试配置
  const instanceRetry = options.retry;
  if (instanceRetry !== undefined && instanceRetry !== null) {
    const normalized = normalizeRetryConfig(instanceRetry, defaultRetry);
    Object.assign(defaultRetry, normalized);
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
    const mergedPrevent = normalizePreventConfig(preventConfig, defaultPrevent);
    const mergedCancel = normalizeCancelConfig(cancelConfig, defaultCancel);

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

  // 响应拦截器 - 处理防重复返回和重试
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
    async (error) => {
      // 处理防重复的 Promise 返回
      if ((error as any)?.__preventReturn && (error as any)?.__pendingPromise) {
        // 返回原请求的 Promise
        return (error as any).__pendingPromise;
      }

      // 处理重试
      const config = error.config || (error as any).config;
      if (config) {
        const retryConfig = normalizeRetryConfig(config.retry, defaultRetry);
        if (retryConfig.enabled && shouldApply(config.method, retryConfig.methods)) {
          if (retryConfig.retryCondition(error)) {
            const delay = calculateRetryDelay(retryConfig, 0);
            await new Promise(resolve => setTimeout(resolve, delay));

            // 清除之前的拦截器中的配置
            delete (config as any).__pendingKey;
            delete (config as any).__retryCount;

            // 重新发起请求
            return instance.request(config);
          }
        }
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

export { createEnhanceInstance, normalizePreventConfig, normalizeCancelConfig, normalizeRetryConfig };
export type { CreateEnhanceOptions, EnhanceInstance, PreventDuplicateConfig, CancelRequestConfig, RetryConfig } from '../types';