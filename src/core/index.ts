/**
 * enhance-axios 核心模块
 *
 * 拦截器逻辑说明：
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │                         请求生命周期                                 │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * 1. 请求发起前 (request interceptor)
 *    ├── 取消请求 (cancelRequest)：检查是否有相同 key 的旧请求，有则取消
 *    └── 防重复提交 (preventDuplicate)：检查是否有相同 key 且在 intervalMs 内的请求
 *        ├── 有：返回已有请求的 Promise，阻止当前请求
 *        └── 无：继续发起请求
 *
 * 2. 响应返回后 (response interceptor)
 *    ┌──────────────────────────────────────────────────────────────────┐
 *    │                      成功响应 (2xx)                               │
 *    │  ├── 清理 preventDuplicate 的 pending 记录                       │
 *    │  ├── 清理 cancelRequest 的 pending 记录                           │
 *    │  └── 注意：此时不会触发重试                                        │
 *    └──────────────────────────────────────────────────────────────────┘
 *    ┌──────────────────────────────────────────────────────────────────┐
 *    │                      错误响应 (非 2xx)                            │
 *    │  ├── 防重复处理：检查 __preventReturn，返还原有请求的 Promise    │
 *    │  ├── 重试处理 (retry)：                                          │
 *    │  │   ├── 检查 retryCondition 是否应该重试                        │
 *    │  │   ├── 检查 retryCount 是否超过限制                            │
 *    │  │   ├── 检查 HTTP 状态码是否在 statusCodes 列表中              │
 *    │  │   ├── 等待 retryDelay (支持指数退避)                         │
 *    │  │   └── 重新发起请求                                             │
 *    │  └── 清理 pending 记录                                           │
 *    │                                                                  │
 *    │  注意：HTTP 2xx 响应但业务码异常的情况                            │
 *    │  - 需要用户自定义 retryCondition 来判断                           │
 *    │  - 例如：response.data.code !== 0                                │
 *    │  - 这种情况下 axios 不会抛出错误，需要在响应拦截器中自行处理       │
 *    └──────────────────────────────────────────────────────────────────┘
 *
 * 失败场景分析：
 *
 * | 场景                          | HTTP状态码 | 是否重试 | 如何判断           |
 * |-------------------------------|------------|----------|--------------------|
 * | 网络错误                       | 无         | 是       | !error.response   |
 * | 4xx 客户端错误                 | 400-499    | 否       | 默认不重试        |
 * | 429 Too Many Requests         | 429        | 是       | statusCodes 包含 |
 * | 5xx 服务器错误                 | 500-599    | 是       | statusCodes 包含 |
 * | HTTP 2xx 但业务码异常          | 200        | 需要自定义 | retryCondition   |
 * | 请求取消 (CancelToken)         | -          | 否       | error.code === 'ECONNABORTED' |
 * | 超时                          | -          | 可配置    | retryCondition    |
 * | 防重复拦截                    | -          | 否       | __preventReturn   |
 *
 * 清理逻辑说明：
 *
 * | 操作              | preventDuplicate | cancelRequest | 说明                |
 * |-------------------|------------------|---------------|--------------------|
 * | 成功响应          | ✓ 清理           | ✓ 清理       | 请求完成，正常清理  |
 * | 重试成功          | ✓ 清理           | ✓ 清理       | 最后一次请求完成    |
 * | 重试失败          | ✓ 清理           | ✓ 清理       | 不再重试时清理      |
 * | 防重复拦截        | ✗ 不清理         | ✗ 不清理     | 复用已有请求的 Promise |
 * | 请求超时          | ✓ 清理           | ✓ 清理       | timeout            |
 * | cancelRequest     | ✓ 清理           | ✓ 清理       | 主动取消            |
 * | clearAll()        | ✓ 清理           | ✓ 清理       | 清空所有            |
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import { RequestManager } from './requestManager';
import { resolveRequestKey } from '../utils';
import type { CreateEnhanceOptions, EnhanceInstance, PreventDuplicateConfig, CancelRequestConfig, RetryConfig } from '../types';

interface EnhanceInstanceInternal extends AxiosInstance {
  enhance: EnhanceInstance;
}

/**
 * 存储防重复请求的 Promise
 * key: requestKey
 * value: 原请求的 Promise
 *
 * 使用场景：当检测到重复请求时，阻止当前请求并返回原请求的 Promise
 */
const pendingReturns = new Map<string, Promise<unknown>>();

/**
 * 默认重试配置
 *
 * retryCondition 默认逻辑：
 * - 无响应（网络错误）：重试
 * - 5xx 服务器错误：重试
 * - 4xx 客户端错误：不重试（请求本身有问题）
 * - 2xx 但业务码异常：需要用户自定义判断（默认不重试）
 */
const defaultRetryConfig = {
  /** 是否启用重试，默认开启 */
  enabled: true,
  /** 重试次数，默认 3 次 */
  retries: 3,
  /** 初始重试延迟(ms)，默认 1000ms */
  retryDelay: 1000,
  /**
   * 重试条件判断函数
   *
   * 默认行为：
   * - 网络错误（无 response）：重试
   * - 5xx 错误：重试
   *
   * 自定义示例：
   * ```typescript
   * retryCondition: (error) => {
   *   // HTTP 2xx 但业务码异常
   *   if (error.response?.status === 200 && error.response?.data?.code !== 0) {
   *     return true;  // 重试
   *   }
   *   // 网络错误或 5xx
   *   return !error.response || error.response.status >= 500;
   * }
   * ```
   */
  retryCondition: (error: AxiosError) => {
    // 无响应（网络错误、CORS 等）：重试
    if (!error.response) {
      return true;
    }
    // 5xx 服务器错误：重试
    if (error.response.status >= 500 && error.response.status < 600) {
      return true;
    }
    return false;
  },
  /** 是否启用指数退避，默认开启 */
  exponential: true,
  /** 最大延迟时间(ms)，默认 30000ms */
  maxDelay: 30000,
  /** 生效的 HTTP 方法，undefined 表示全部方法 */
  methods: undefined as string[] | undefined,
  /** 需要重试的 HTTP 状态码列表 */
  statusCodes: [408, 429, 500, 502, 503, 504],
};

/**
 * 配置归一化：防重复提交
 *
 * 支持的输入格式：
 * - boolean: 赋给 enabled
 * - string: 赋给 requestKey
 * - function: 赋给 requestKey
 * - number: 赋给 intervalMs
 * - array: 赋给 methods
 * - object: 合并到配置
 * - undefined/null: 视为未传递，使用默认值
 *
 * @param config 输入配置
 * @param defaults 默认配置
 * @returns 归一化后的配置
 */
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

/**
 * 配置归一化：取消请求
 *
 * 支持的输入格式同 normalizePreventConfig
 */
function normalizeCancelConfig(
  config: any,
  defaults: { enabled: boolean; requestKey?: string | Function; methods?: string[] | undefined }
): { enabled: boolean; requestKey?: string | Function; methods?: string[] | undefined } {
  if (config === undefined || config === null) {
    return defaults;
  }

  if (typeof config === 'boolean') {
    return { ...defaults, enabled: config };
  }

  if (typeof config === 'string') {
    return { ...defaults, requestKey: config };
  }

  if (typeof config === 'function') {
    return { ...defaults, requestKey: config };
  }

  if (Array.isArray(config)) {
    return { ...defaults, methods: config as string[] };
  }

  return {
    enabled: config.enabled ?? defaults.enabled,
    requestKey: config.requestKey ?? defaults.requestKey,
    methods: config.methods !== undefined ? config.methods : defaults.methods,
  };
}

/**
 * 配置归一化：失败重试
 *
 * 支持的输入格式：
 * - boolean: 赋给 enabled
 * - number: 赋给 retries
 * - object: 合并到配置
 * - undefined/null: 视为未传递，使用默认值
 */
function normalizeRetryConfig(
  config: any,
  defaults: { enabled: boolean; retries: number; retryDelay: number; retryCondition: (error: AxiosError) => boolean; exponential: boolean; maxDelay: number; methods?: string[] | undefined; statusCodes: number[] }
): { enabled: boolean; retries: number; retryDelay: number; retryCondition: (error: AxiosError) => boolean; exponential: boolean; maxDelay: number; methods?: string[] | undefined; statusCodes: number[] } {
  if (config === undefined || config === null) {
    return defaults;
  }

  if (typeof config === 'boolean') {
    return { ...defaults, enabled: config };
  }

  if (typeof config === 'number') {
    return { ...defaults, retries: config };
  }

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

/**
 * 计算重试延迟
 *
 * @param retryConfig 重试配置
 * @param retryCount 当前重试次数（从 0 开始）
 * @returns 延迟时间(ms)
 *
 * 指数退避公式：min(retryDelay * 2^retryCount, maxDelay)
 */
function calculateRetryDelay(retryConfig: { retryDelay: number; exponential: boolean; maxDelay: number }, retryCount: number): number {
  let delay = retryConfig.retryDelay;
  if (retryConfig.exponential) {
    delay = Math.min(retryConfig.retryDelay * Math.pow(2, retryCount), retryConfig.maxDelay);
  }
  return delay;
}

/**
 * 检查 HTTP 方法是否在允许列表中
 *
 * @param method 请求方法
 * @param methods 允许的方法列表，undefined 表示全部允许
 */
function shouldApply(method?: string, methods?: string[]): boolean {
  if (!methods || methods.length === 0) return true;
  return methods.includes(method?.toUpperCase() || 'GET');
}

/**
 * 清理 pending 记录
 *
 * @param config 请求配置
 * @param requestManager 请求管理器
 *
 * 清理时机：
 * 1. 响应成功
 * 2. 重试成功
 * 3. 重试次数用尽
 * 4. 不需要重试的错误
 */
function cleanupPendingRecord(config: any, requestManager: RequestManager): void {
  const key = config?.__pendingKey;
  if (key) {
    pendingReturns.delete(key);
    requestManager.unregisterRequest(key, 'prevent');
  }
}

/**
 * 创建增强的 axios 实例
 *
 * @param options 实例配置
 * @returns 增强后的 axios 实例
 */
function createEnhanceInstance(options: CreateEnhanceOptions = {}): EnhanceInstanceInternal {
  // 创建原生 axios 实例
  const instance = axios.create(options) as EnhanceInstanceInternal;

  // ═══════════════════════════════════════════════════════════════════════════
  // 默认配置初始化
  // ═══════════════════════════════════════════════════════════════════════════

  const defaultPrevent = { enabled: true, intervalMs: 1000 };
  const defaultCancel = { enabled: true };
  const defaultRetry = { ...defaultRetryConfig };

  // 处理实例级别的配置归一化
  if (options.preventDuplicate !== undefined && options.preventDuplicate !== null) {
    const normalized = normalizePreventConfig(options.preventDuplicate, defaultPrevent);
    Object.assign(defaultPrevent, normalized);
  }

  if (options.cancelRequest !== undefined && options.cancelRequest !== null) {
    const normalized = normalizeCancelConfig(options.cancelRequest, defaultCancel);
    Object.assign(defaultCancel, normalized);
  }

  if (options.retry !== undefined && options.retry !== null) {
    const normalized = normalizeRetryConfig(options.retry, defaultRetry);
    Object.assign(defaultRetry, normalized);
  }

  // 初始化请求管理器（用于管理 pending 状态）
  const requestManager = new RequestManager(defaultPrevent, defaultCancel);

  // ═══════════════════════════════════════════════════════════════════════════
  // 暴露给用户的 enhance API
  // ═══════════════════════════════════════════════════════════════════════════

  const enhanceInstance: EnhanceInstance = {
    requestManager,
    clearAll: () => requestManager.clearAll(),
    cancelRequest: (key: string) => requestManager.cancelRequest(key),
    getRequestStatus: (key: string) => requestManager.getRequestStatus(key),
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 请求拦截器
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 请求拦截器处理顺序：
   * 1. 取消请求 (cancelRequest) - 先检查并取消旧请求
   * 2. 防重复提交 (preventDuplicate) - 再检查是否需要阻止新请求
   */
  instance.interceptors.request.use((config) => {
    // 获取请求级别的配置（从 config 中读取，覆盖实例配置）
    const preventConfig = config.preventDuplicate;
    const cancelConfig = config.cancelRequest;

    // 合并配置：实例配置 + 请求配置，请求配置优先级更高
    const mergedPrevent = normalizePreventConfig(preventConfig, defaultPrevent);
    const mergedCancel = normalizeCancelConfig(cancelConfig, defaultCancel);

    // ─────────────────────────────────────────────────────────────────────
    // 步骤 1：处理取消请求
    // ─────────────────────────────────────────────────────────────────────
    // 逻辑：检查是否有相同 key 的旧请求，有则取消
    // 目的：确保只有最新发出的请求有效（搜索场景）
    if (mergedCancel.enabled && shouldApply(config.method, mergedCancel.methods)) {
      const key = resolveRequestKey(config, mergedCancel.requestKey);
      requestManager.cancelRequest(key);
    }

    // ─────────────────────────────────────────────────────────────────────
    // 步骤 2：处理防重复提交
    // ─────────────────────────────────────────────────────────────────────
    // 逻辑：
    // 1. 生成 requestKey
    // 2. 检查是否有相同 key 且在 intervalMs 内的请求
    // 3. 有则阻止当前请求，返回已有请求的 Promise
    // 目的：防止用户快速点击重复提交表单
    if (mergedPrevent.enabled && shouldApply(config.method, mergedPrevent.methods)) {
      const key = resolveRequestKey(config, mergedPrevent.requestKey);

      // 检查是否有正在进行的相同请求
      const existing = requestManager.getRequestStatus(key);
      if (existing) {
        const now = Date.now();
        // 如果请求还在 intervalMs 内，则返回已有请求的 Promise
        if (now - existing.timestamp < mergedPrevent.intervalMs) {
          const pendingPromise = pendingReturns.get(key);
          if (pendingPromise) {
            // 生成取消令牌用于阻止当前请求
            const source = axios.CancelToken.source();
            (config as any).__cancelTokenSource = source;
            source.cancel('Request prevented by duplicate');

            // 创建错误对象，用于在响应拦截器中处理
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

  // ═══════════════════════════════════════════════════════════════════════════
  // 响应拦截器
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 响应拦截器处理顺序：
   * 1. 成功响应 (2xx)：清理 pending 记录
   * 2. 防重复处理：检查 __preventReturn，返还原有请求的 Promise
   * 3. 重试处理：检查是否需要重试
   * 4. 错误处理：清理 pending 记录，抛出错误
   */
  instance.interceptors.response.use(
    // ─────────────────────────────────────────────────────────────────────
    // 成功响应处理
    // ─────────────────────────────────────────────────────────────────────
    (response) => {
      // 清理 pending 记录
      cleanupPendingRecord(response.config, requestManager);
      return response;
    },

    // ─────────────────────────────────────────────────────────────────────
    // 错误响应处理
    // ─────────────────────────────────────────────────────────────────────
    async (error) => {
      // 获取原始请求配置
      const config = error.config || (error as any).config;

      // ─────────────────────────────────────────────────────────────────
      // 情况 1：防重复拦截返回
      // ─────────────────────────────────────────────────────────────────
      // 说明：当前请求被阻止，需要返回原请求的 Promise
      if ((error as any)?.__preventReturn && (error as any)?.__pendingPromise) {
        return (error as any).__pendingPromise;
      }

      // ─────────────────────────────────────────────────────────────────
      // 情况 2：处理重试
      // ─────────────────────────────────────────────────────────────────
      // 重试条件检查顺序：
      // 1. retry 配置是否启用
      // 2. 当前方法是否在允许列表中
      // 3. retryCondition 是否返回 true
      // 4. 重试次数是否超过限制
      if (config) {
        const retryConfig = normalizeRetryConfig(config.retry, defaultRetry);

        if (retryConfig.enabled && shouldApply(config.method, retryConfig.methods)) {
          // 获取当前重试次数
          const retryCount = (config as any).__retryCount || 0;

          // 检查是否应该重试
          // 条件 1：retryCondition 返回 true（自定义判断）
          // 条件 2：重试次数未超限
          // 条件 3：HTTP 状态码在允许列表中（如果有状态码）
          const shouldRetry =
            retryConfig.retryCondition(error) &&
            retryCount < retryConfig.retries &&
            (!error.response || !retryConfig.statusCodes.length || retryConfig.statusCodes.includes(error.response.status));

          if (shouldRetry) {
            // 计算延迟时间
            const delay = calculateRetryDelay(retryConfig, retryCount);

            // 等待延迟后重试
            await new Promise(resolve => setTimeout(resolve, delay));

            // 清除之前的 pending 记录（避免与重试后的记录混淆）
            delete (config as any).__pendingKey;

            // 增加重试计数
            (config as any).__retryCount = retryCount + 1;

            // 重新发起请求
            return instance.request(config);
          }
        }
      }

      // ─────────────────────────────────────────────────────────────────
      // 情况 3：清理并抛出错误
      // ─────────────────────────────────────────────────────────────────
      // 说明：不需要重试的错误，清理 pending 记录后抛出
      if (config) {
        cleanupPendingRecord(config, requestManager);
      }

      return Promise.reject(error);
    }
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // 添加 RESTful 方法封装
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * 统一调用格式：api.method(url, data?, config?)
   *
   * 方法分类：
   * - GET/HEAD/OPTIONS/DELETE：第二个参数作为 params
   * - POST/PUT/PATCH：第二个参数作为 data
   */
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

      return (instance as AxiosInstance).request(finalConfig);
    };
  }

  // 添加 enhance 属性
  instance.enhance = enhanceInstance;

  return instance;
}

export { createEnhanceInstance, normalizePreventConfig, normalizeCancelConfig, normalizeRetryConfig };
export type { CreateEnhanceOptions, EnhanceInstance, PreventDuplicateConfig, CancelRequestConfig, RetryConfig } from '../types';