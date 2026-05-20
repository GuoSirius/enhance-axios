/**
 * enhance-axios 核心模块
 *
 * ════════════════════════════════════════════════════════════════════════════════
 *                           功能设计说明
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 本库提供三个核心增强功能：
 * 1. 防重复提交 (preventDuplicate)：阻止短时间内重复发送相同请求，返回已有请求的 Promise
 * 2. 取消请求 (cancelRequest)：取消正在进行的相同请求，只保留最新发出的请求
 * 3. 失败重试 (retry)：请求失败时自动重试
 *
 * ════════════════════════════════════════════════════════════════════════════════
 *                           配置策略说明
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 【默认策略】
 * - POST/PUT/PATCH 等使用 data 的请求：默认启用防重复提交
 * - GET/DELETE 等使用 params 的请求：默认启用取消请求
 *
 * 【为什么不能同时使用】
 * - 防重复：返回已有请求的 Promise，阻止当前请求继续执行
 * - 取消请求：取消已有请求，继续执行当前请求
 * 两者同时使用会产生冲突，且业务场景中通常只需要其中一种
 *
 * 【优先级规则】
 * 1. 请求级别配置优先于实例级别配置
 * 2. 如果请求明确指定了 preventDuplicate 或 cancelRequest，则使用请求配置
 * 3. 如果请求未指定，则使用实例默认策略
 *
 * ════════════════════════════════════════════════════════════════════════════════
 *                           请求生命周期
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │                         请求发起前 (请求拦截器)                              │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 *  步骤 1：取消请求 (cancelRequest)
 *  ────────────────────────────────
 *  • 检查是否有相同 key 的旧请求
 *  • 有则取消旧请求
 *  • 继续发起当前请求
 *  • 适用场景：搜索框输入时自动取消旧请求
 *
 *  步骤 2：防重复提交 (preventDuplicate)
 *  ────────────────────────────────────
 *  • 检查是否有相同 key 且在 intervalMs 内的请求
 *  • 有则返回已有请求的 Promise，阻止当前请求
 *  • 无则继续发起请求
 *  • 适用场景：防止用户快速点击重复提交表单
 *
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │                         响应返回后 (响应拦截器)                              │
 * └─────────────────────────────────────────────────────────────────────────────┘
 *
 *  成功响应 (2xx)
 *  ──────────────
 *  • 清理 pending 记录
 *  • 返回响应数据
 *
 *  错误响应 (非 2xx)
 *  ──────────────────
 *  • 防重复处理：检查 __preventReturn，返还原有请求的 Promise
 *  • 重试处理：检查 retryCondition 是否应该重试
 *  • 清理 pending 记录
 *
 * ════════════════════════════════════════════════════════════════════════════════
 *                           失败场景分析
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * | 场景                    | HTTP状态码  | 是否重试 | 如何判断                   |
 * |-------------------------|-------------|----------|----------------------------|
 * | 网络错误                | 无          | 是       | !error.response            |
 * | 429 Too Many Requests   | 429         | 是       | statusCodes 包含           |
 * | 5xx 服务器错误          | 500-599     | 是       | statusCodes 包含            |
 * | 4xx 客户端错误          | 400-499     | 否       | 默认不重试                  |
 * | 请求取消                | -           | 否       | error.code === 'ECONNABORTED' |
 * | 防重复拦截              | -           | 否       | __preventReturn             |
 * | HTTP 2xx 但业务码异常   | 200         | 自定义   | retryCondition              |
 *
 * ════════════════════════════════════════════════════════════════════════════════
 *                           清理时机说明
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * | 操作                   | pending 清理 | 说明                              |
 * |------------------------|--------------|-----------------------------------|
 * | 成功响应               | ✓            | 请求完成，正常清理                 |
 * | 重试成功               | ✓            | 最后一次请求完成                   |
 * | 重试耗尽               | ✓            | 不再重试时清理                     |
 * | 防重复拦截             | ✗            | 复用已有请求，不清理               |
 * | cancelRequest          | ✓            | 主动取消时清理                     |
 * | clearAll()             | ✓            | 清空所有 pending                   |
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosError, CancelTokenSource } from 'axios';
import { RequestManager } from './requestManager';
import { resolveRequestKey } from '../utils';
import type {
  CreateEnhanceOptions,
  EnhanceInstance,
  PreventDuplicateConfig,
  CancelRequestConfig,
  RetryConfig,
  PendingRequest,
} from '../types';

// ════════════════════════════════════════════════════════════════════════════════
// 类型定义
// ════════════════════════════════════════════════════════════════════════════════

/**
 * 内部防重复配置
 */
interface InternalPreventConfig {
  enabled: boolean;
  requestKey?: string | ((config: AxiosRequestConfig) => string);
  methods?: string[];
  intervalMs: number;
}

/**
 * 内部取消请求配置
 */
interface InternalCancelConfig {
  enabled: boolean;
  requestKey?: string | ((config: AxiosRequestConfig) => string);
  methods?: string[];
}

/**
 * 内部重试配置
 */
interface InternalRetryConfig {
  enabled: boolean;
  retries: number;
  retryDelay: number;
  retryCondition: (error: AxiosError) => boolean;
  exponential: boolean;
  maxDelay: number;
  methods?: string[];
  statusCodes: number[];
}

/**
 * 请求方法类型
 */
type RequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/**
 * 判断请求是否使用 data（而非 params）
 */
const DATA_METHODS: RequestMethod[] = ['POST', 'PUT', 'PATCH'];

// ════════════════════════════════════════════════════════════════════════════════
// 存储防重复请求的 Promise
// ════════════════════════════════════════════════════════════════════════════════

/**
 * 存储防重复请求的 Promise
 * key: requestKey
 * value: 原请求的 Promise
 *
 * 使用场景：当检测到重复请求时，阻止当前请求并返回原请求的 Promise
 */
const pendingReturns = new Map<string, Promise<unknown>>();

// ════════════════════════════════════════════════════════════════════════════════
// 默认配置
// ════════════════════════════════════════════════════════════════════════════════

/**
 * 默认防重复配置
 */
const DEFAULT_PREVENT_CONFIG: InternalPreventConfig = {
  enabled: true,
  intervalMs: 1000,
};

/**
 * 默认取消请求配置
 */
const DEFAULT_CANCEL_CONFIG: InternalCancelConfig = {
  enabled: true,
};

/**
 * 默认重试配置
 */
const DEFAULT_RETRY_CONFIG: InternalRetryConfig = {
  enabled: true,
  retries: 3,
  retryDelay: 1000,
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
  exponential: true,
  maxDelay: 30000,
  statusCodes: [408, 429, 500, 502, 503, 504],
};

// ════════════════════════════════════════════════════════════════════════════════
// 工具函数
// ════════════════════════════════════════════════════════════════════════════════

/**
 * 判断请求方法是否使用 data（POST/PUT/PATCH）
 */
function isDataMethod(method?: string): boolean {
  return DATA_METHODS.includes(method?.toUpperCase() as RequestMethod);
}

/**
 * 检查 HTTP 方法是否在允许列表中
 */
function shouldApply(method?: string, methods?: string[]): boolean {
  if (!methods || methods.length === 0) return true;
  return methods.includes(method?.toUpperCase() || 'GET');
}

/**
 * 计算重试延迟（支持指数退避）
 *
 * @param retryConfig 重试配置
 * @param retryCount 当前重试次数（从 0 开始）
 * @returns 延迟时间(ms)
 *
 * 指数退避公式：min(retryDelay * 2^retryCount, maxDelay)
 */
function calculateRetryDelay(
  retryConfig: { retryDelay: number; exponential: boolean; maxDelay: number },
  retryCount: number
): number {
  let delay = retryConfig.retryDelay;
  if (retryConfig.exponential) {
    delay = Math.min(
      retryConfig.retryDelay * Math.pow(2, retryCount),
      retryConfig.maxDelay
    );
  }
  return delay;
}

// ════════════════════════════════════════════════════════════════════════════════
// 配置归一化函数
// ════════════════════════════════════════════════════════════════════════════════

/**
 * 判断配置是否为明确的 false（用于区分未设置和明确禁用）
 */
function isExplicitFalse(config: any): boolean {
  return config === false || config === 'false';
}

/**
 * 判断配置是否已设置（不是 undefined/null）
 */
function isConfigSet(config: any): boolean {
  return config !== undefined && config !== null;
}

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
 */
function normalizePreventConfig(
  config: PreventDuplicateConfig | boolean | string | Function | number | string[] | undefined,
  defaults: InternalPreventConfig
): InternalPreventConfig {
  // undefined/null 视为未传递
  if (!isConfigSet(config)) {
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
    return { ...defaults, requestKey: config as (config: AxiosRequestConfig) => string };
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
    enabled: (config as PreventDuplicateConfig).enabled ?? defaults.enabled,
    requestKey: (config as PreventDuplicateConfig).requestKey ?? defaults.requestKey,
    methods: (config as PreventDuplicateConfig).methods !== undefined
      ? (config as PreventDuplicateConfig).methods
      : defaults.methods,
    intervalMs: (config as PreventDuplicateConfig).intervalMs ?? defaults.intervalMs,
  };
}

/**
 * 配置归一化：取消请求
 *
 * 支持的输入格式同 normalizePreventConfig
 */
function normalizeCancelConfig(
  config: CancelRequestConfig | boolean | string | Function | string[] | undefined,
  defaults: InternalCancelConfig
): InternalCancelConfig {
  if (!isConfigSet(config)) {
    return defaults;
  }

  if (typeof config === 'boolean') {
    return { ...defaults, enabled: config };
  }

  if (typeof config === 'string') {
    return { ...defaults, requestKey: config };
  }

  if (typeof config === 'function') {
    return { ...defaults, requestKey: config as (config: AxiosRequestConfig) => string };
  }

  if (Array.isArray(config)) {
    return { ...defaults, methods: config as string[] };
  }

  return {
    enabled: (config as CancelRequestConfig).enabled ?? defaults.enabled,
    requestKey: (config as CancelRequestConfig).requestKey ?? defaults.requestKey,
    methods: (config as CancelRequestConfig).methods !== undefined
      ? (config as CancelRequestConfig).methods
      : defaults.methods,
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
  config: RetryConfig | boolean | number | undefined,
  defaults: InternalRetryConfig
): InternalRetryConfig {
  if (!isConfigSet(config)) {
    return defaults;
  }

  if (typeof config === 'boolean') {
    return { ...defaults, enabled: config };
  }

  if (typeof config === 'number') {
    return { ...defaults, retries: config };
  }

  return {
    enabled: (config as RetryConfig).enabled ?? defaults.enabled,
    retries: (config as RetryConfig).retries ?? defaults.retries,
    retryDelay: (config as RetryConfig).retryDelay ?? defaults.retryDelay,
    retryCondition: (config as RetryConfig).retryCondition ?? defaults.retryCondition,
    exponential: (config as RetryConfig).exponential ?? defaults.exponential,
    maxDelay: (config as RetryConfig).maxDelay ?? defaults.maxDelay,
    methods: (config as RetryConfig).methods !== undefined
      ? (config as RetryConfig).methods
      : defaults.methods,
    statusCodes: (config as RetryConfig).statusCodes ?? defaults.statusCodes,
  };
}

// ════════════════════════════════════════════════════════════════════════════════
// 清理函数
// ════════════════════════════════════════════════════════════════════════════════

/**
 * 清理 pending 记录
 *
 * @param config 请求配置
 * @param requestManager 请求管理器
 * @param requestKey 请求标识（可选，用于精确清理）
 *
 * 清理时机：
 * 1. 响应成功
 * 2. 重试成功
 * 3. 重试次数用尽
 * 4. 不需要重试的错误
 */
function cleanupPendingRecord(
  config: AxiosRequestConfig,
  requestManager: RequestManager,
  requestKey?: string
): void {
  // 优先使用传入的 requestKey，其次使用 config 中的 __pendingKey
  const key = requestKey || (config as any).__pendingKey;
  if (key) {
    pendingReturns.delete(key);
    requestManager.unregisterRequest(key, 'prevent');
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// 核心函数
// ════════════════════════════════════════════════════════════════════════════════

/**
 * 获取有效的增强配置
 *
 * 优先级规则：
 * 1. 如果请求明确设置了 preventDuplicate（不是 undefined），使用请求配置
 * 2. 如果请求未设置，根据方法类型决定默认策略
 *    - POST/PUT/PATCH：使用防重复
 *    - GET/DELETE 等：使用取消请求
 * 3. 实例默认配置作为最终回退
 *
 * @param config 请求配置
 * @param instanceDefaults 实例默认配置
 * @param method 请求方法
 */
function getEffectiveConfig(
  config: AxiosRequestConfig,
  instanceDefaults: {
    prevent: InternalPreventConfig;
    cancel: InternalCancelConfig;
  },
  method: string
): { prevent: InternalPreventConfig; cancel: InternalCancelConfig } {
  // 获取请求级别的配置
  const requestPrevent = config.preventDuplicate;
  const requestCancel = config.cancelRequest;

  // 检查是否明确禁用
  const preventExplicitDisabled = isExplicitFalse(requestPrevent);
  const cancelExplicitDisabled = isExplicitFalse(requestCancel);

  let prevent: InternalPreventConfig;
  let cancel: InternalCancelConfig;

  // ─────────────────────────────────────────────────────────────────────────
  // 步骤 1：确定防重复配置
  // ─────────────────────────────────────────────────────────────────────────
  if (preventExplicitDisabled) {
    // 明确禁用防重复
    prevent = { ...DEFAULT_PREVENT_CONFIG, enabled: false };
  } else if (isConfigSet(requestPrevent)) {
    // 使用请求配置
    prevent = normalizePreventConfig(requestPrevent, DEFAULT_PREVENT_CONFIG);
  } else if (isDataMethod(method)) {
    // 默认策略：使用 data 的请求启用防重复
    prevent = { ...instanceDefaults.prevent };
  } else {
    // 默认策略：其他请求禁用防重复
    prevent = { ...DEFAULT_PREVENT_CONFIG, enabled: false };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 步骤 2：确定取消请求配置
  // ─────────────────────────────────────────────────────────────────────────
  if (cancelExplicitDisabled) {
    // 明确禁用取消请求
    cancel = { ...DEFAULT_CANCEL_CONFIG, enabled: false };
  } else if (isConfigSet(requestCancel)) {
    // 使用请求配置
    cancel = normalizeCancelConfig(requestCancel, DEFAULT_CANCEL_CONFIG);
  } else if (!isDataMethod(method)) {
    // 默认策略：不使用 data 的请求启用取消请求
    cancel = { ...instanceDefaults.cancel };
  } else {
    // 默认策略：使用 data 的请求禁用取消请求
    cancel = { ...DEFAULT_CANCEL_CONFIG, enabled: false };
  }

  return { prevent, cancel };
}

// ════════════════════════════════════════════════════════════════════════════════
// 主函数
// ════════════════════════════════════════════════════════════════════════════════

/**
 * 创建增强的 axios 实例
 *
 * @param options 实例配置
 * @returns 增强后的 axios 实例
 */
function createEnhanceInstance(options: CreateEnhanceOptions = {}): AxiosInstance & { enhance: EnhanceInstance } {
  // ─────────────────────────────────────────────────────────────────────────
  // 创建原生 axios 实例
  // ─────────────────────────────────────────────────────────────────────────
  const instance = axios.create(options);

  // ─────────────────────────────────────────────────────────────────────────
  // 初始化默认配置
  // ─────────────────────────────────────────────────────────────────────────
  const defaultPrevent = { ...DEFAULT_PREVENT_CONFIG };
  const defaultCancel = { ...DEFAULT_CANCEL_CONFIG };
  const defaultRetry = { ...DEFAULT_RETRY_CONFIG };

  // 处理实例级别的配置归一化
  if (isConfigSet(options.preventDuplicate)) {
    const normalized = normalizePreventConfig(options.preventDuplicate, DEFAULT_PREVENT_CONFIG);
    Object.assign(defaultPrevent, normalized);
  }

  if (isConfigSet(options.cancelRequest)) {
    const normalized = normalizeCancelConfig(options.cancelRequest, DEFAULT_CANCEL_CONFIG);
    Object.assign(defaultCancel, normalized);
  }

  if (isConfigSet(options.retry)) {
    const normalized = normalizeRetryConfig(options.retry, DEFAULT_RETRY_CONFIG);
    Object.assign(defaultRetry, normalized);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 初始化请求管理器
  // ─────────────────────────────────────────────────────────────────────────
  const requestManager = new RequestManager();

  // ─────────────────────────────────────────────────────────────────────────
  // 暴露给用户的 enhance API
  // ─────────────────────────────────────────────────────────────────────────
  const enhanceInstance: EnhanceInstance = {
    requestManager,
    clearAll: () => requestManager.clearAll(),
    cancelRequest: (key: string) => requestManager.cancelRequest(key),
    getRequestStatus: (key: string) => requestManager.getRequestStatus(key),
  };

  // ════════════════════════════════════════════════════════════════════════════
  // 请求拦截器
  // ════════════════════════════════════════════════════════════════════════════
  instance.interceptors.request.use(
    (config) => {
      const method = config.method?.toUpperCase() || 'GET';

      // ─────────────────────────────────────────────────────────────────────
      // 步骤 1：获取有效的增强配置
      // ─────────────────────────────────────────────────────────────────────
      const { prevent, cancel } = getEffectiveConfig(config, { prevent: defaultPrevent, cancel: defaultCancel }, method);

      // ─────────────────────────────────────────────────────────────────────
      // 步骤 2：处理取消请求
      // ─────────────────────────────────────────────────────────────────────
      // 逻辑：检查是否有相同 key 的旧请求，有则取消
      // 目的：确保只有最新发出的请求有效（搜索场景）
      // 注意：取消请求会继续执行当前请求
      if (cancel.enabled && shouldApply(method, cancel.methods)) {
        const key = resolveRequestKey(config, cancel.requestKey);
        requestManager.cancelRequest(key);
      }

      // ─────────────────────────────────────────────────────────────────────
      // 步骤 3：处理防重复提交
      // ─────────────────────────────────────────────────────────────────────
      // 逻辑：
      // 1. 生成 requestKey
      // 2. 检查是否有相同 key 且在 intervalMs 内的请求
      // 3. 有则阻止当前请求，返回已有请求的 Promise
      // 目的：防止用户快速点击重复提交表单
      // 注意：防重复会阻止当前请求，不会继续执行
      if (prevent.enabled && shouldApply(method, prevent.methods)) {
        const key = resolveRequestKey(config, prevent.requestKey);

        // 检查是否有正在进行的相同请求
        const existing = requestManager.getRequestStatus(key);
        if (existing) {
          const now = Date.now();
          // 如果请求还在 intervalMs 内，则返回已有请求的 Promise
          if (now - existing.timestamp < prevent.intervalMs) {
            const pendingPromise = pendingReturns.get(key);
            if (pendingPromise) {
              // 生成取消令牌用于阻止当前请求
              const source = axios.CancelToken.source();
              (config as any).__cancelTokenSource = source;
              source.cancel('Request prevented by duplicate');

              // 保存 pending key，用于响应拦截器清理
              (config as any).__pendingKey = key;

              // 创建错误对象，用于在响应拦截器中处理
              const error = new Error('Request prevented by duplicate') as AxiosError;
              (error as any).__preventReturn = true;
              (error as any).__pendingPromise = existing.promise;
              (error as any).__pendingKey = key;
              error.config = config;

              return Promise.reject(error);
            }
          }
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // 步骤 4：注册新请求
      // ─────────────────────────────────────────────────────────────────────
      // 为防重复功能注册请求（取消请求不需要注册，因为会继续执行）
      if (prevent.enabled && shouldApply(method, prevent.methods)) {
        const key = resolveRequestKey(config, prevent.requestKey);
        const source = axios.CancelToken.source();
        (config as any).__cancelToken = source.token;
        (config as any).__cancelSource = source;
        (config as any).__pendingKey = key;

        // 创建 Promise 并保存，用于防重复拦截
        const requestPromise = new Promise<unknown>((resolve, reject) => {
          // 这个 Promise 会在请求完成时 resolve/reject
          // 我们需要在响应拦截器中替换它
        });
        pendingReturns.set(key, requestPromise);

        requestManager.registerRequest(key, 'prevent', source, requestPromise);
      }

      return config;
    },
    (error) => Promise.reject(error)
  );

  // ════════════════════════════════════════════════════════════════════════════
  // 响应拦截器
  // ════════════════════════════════════════════════════════════════════════════
  instance.interceptors.response.use(
    // ─────────────────────────────────────────────────────────────────────────
    // 成功响应处理 (2xx)
    // ─────────────────────────────────────────────────────────────────────────
    (response) => {
      // 清理 pending 记录
      cleanupPendingRecord(response.config, requestManager);

      // 清理 cancelSource（如果有）
      const cancelSource = (response.config as any).__cancelSource;
      if (cancelSource) {
        try { cancelSource.cancel('Request completed'); } catch {}
      }

      return response;
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 错误响应处理 (非 2xx)
    // ─────────────────────────────────────────────────────────────────────────
    async (error) => {
      // 获取原始请求配置
      const config = error.config || (error as any).config;

      // 如果没有配置，说明是致命错误（如网络完全断开），直接抛出
      if (!config) {
        return Promise.reject(error);
      }

      // ─────────────────────────────────────────────────────────────────────
      // 情况 1：防重复拦截返回
      // ─────────────────────────────────────────────────────────────────────
      // 说明：当前请求被阻止，需要返回原请求的 Promise
      if ((error as any)?.__preventReturn && (error as any)?.__pendingPromise) {
        // 注意：这里不清理 pending，因为原请求还在进行
        return (error as any).__pendingPromise;
      }

      // ─────────────────────────────────────────────────────────────────────
      // 情况 2：请求被取消（cancelToken 取消）
      // ─────────────────────────────────────────────────────────────────────
      // 说明：可能是 cancelRequest 取消的旧请求，不需要重试
      if (axios.isCancel(error)) {
        // 清理 pending 记录
        cleanupPendingRecord(config, requestManager);
        return Promise.reject(error);
      }

      // ─────────────────────────────────────────────────────────────────────
      // 情况 3：处理重试
      // ─────────────────────────────────────────────────────────────────────
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
          await new Promise((resolve) => setTimeout(resolve, delay));

          // 清理之前的 pending 记录（避免与重试后的记录混淆）
          cleanupPendingRecord(config, requestManager);

          // 增加重试计数
          (config as any).__retryCount = retryCount + 1;

          // 重新发起请求
          return instance.request(config);
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // 情况 4：清理并抛出错误
      // ─────────────────────────────────────────────────────────────────────
      // 说明：不需要重试的错误，清理 pending 记录后抛出
      cleanupPendingRecord(config, requestManager);

      // 清理 cancelSource
      const cancelSource = (config as any).__cancelSource;
      if (cancelSource) {
        try { cancelSource.cancel('Request failed'); } catch {}
      }

      return Promise.reject(error);
    }
  );

  // ════════════════════════════════════════════════════════════════════════════
  // 添加 RESTful 方法封装
  // ════════════════════════════════════════════════════════════════════════════
  const methods: RequestMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

  for (const method of methods) {
    const originalMethod = instance[method.toLowerCase() as keyof AxiosInstance] as any;
    (instance as any)[method.toLowerCase()] = (url: string, data?: any, config?: AxiosRequestConfig) => {
      const finalConfig: AxiosRequestConfig = {
        ...config,
        url,
        method: method,
      };

      // 根据方法类型决定 data 参数的位置
      if (['GET', 'HEAD', 'OPTIONS', 'DELETE'].includes(method)) {
        if (data) {
          finalConfig.params = data;
        }
      } else {
        if (data !== undefined) {
          finalConfig.data = data;
        }
      }

      return instance.request(finalConfig);
    };
  }

  // 添加 enhance 属性
  (instance as any).enhance = enhanceInstance;

  return instance as AxiosInstance & { enhance: EnhanceInstance };
}

export { createEnhanceInstance };
export type {
  CreateEnhanceOptions,
  EnhanceInstance,
  PreventDuplicateConfig,
  CancelRequestConfig,
  RetryConfig,
} from '../types';