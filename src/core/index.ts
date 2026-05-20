/**
 * enhance-axios 核心模块
 *
 * ════════════════════════════════════════════════════════════════════════════════
 *                           功能说明
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 三个核心增强：
 * 1. 防重复提交 (preventDuplicate)：阻止短时间内重复发送相同请求，返回已有请求的结果
 * 2. 取消请求 (cancelRequest)：    取消正在进行的相同请求，保留最新请求
 * 3. 失败重试 (retry)：             请求失败（含 2xx 业务码异常）时自动重试
 *
 * ════════════════════════════════════════════════════════════════════════════════
 *                           默认策略
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * - 防重复：methods 默认 ['POST', 'PUT', 'PATCH', 'DELETE']
 * - 取消请求：methods 默认 ['GET']
 * - 重试：    methods 默认 undefined（所有方法）
 *
 * 三者通过 methods 数组各自控制生效范围，默认互不重叠。
 * 如同时启用防重复和取消请求：防重复优先（先检查取消 → 再检查防重复 → 注册）。
 *
 * ════════════════════════════════════════════════════════════════════════════════
 *                           配置规则
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 1. 请求级配置优先于实例级配置
 * 2. 非 false 快捷方式（string/function/number/array）暗含 enabled: true
 * 3. 空数组 methods: [] 表示不应用于任何方法
 * 4. methods: undefined / null 表示应用于所有方法
 *
 * ════════════════════════════════════════════════════════════════════════════════
 *                           请求拦截器 (5 步)
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 步骤 1：获取有效配置（请求级 > 实例级）
 * 步骤 2：Content-Type 处理（默认 json，file 不设置）
 * 步骤 3：取消旧请求（同 cancelKey 的请求被中止）
 * 步骤 4：防重复检查（同 preventKey 且在 intervalMs 内则阻止并返回 deferred.promise）
 * 步骤 5：注册新请求（创建 AbortController，注册到 requestManager）
 *
 * ════════════════════════════════════════════════════════════════════════════════
 *                           响应拦截器
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 成功 (2xx):
 *   1. 检测业务码重试 (__bizRetry flag)
 *   2. resolve deferred → 清理 pendingReturns + requestManager
 *
 * 错误 (非 2xx / 网络错误 / 取消):
 *   情况 1 — 防重复拦截：返回原请求的 deferred.promise（不清理）
 *   情况 2 — 请求被取消：  reject deferred，清理，抛出
 *   情况 3 — 满足重试条件：保留 deferred，清理 requestManager，延迟后重新发起
 *   情况 4 — 不满足/耗尽：  reject deferred，清理，抛出
 *
 * ════════════════════════════════════════════════════════════════════════════════
 *                           pendingReturns vs requestManager
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * pendingReturns:   Map<string, PendingDeferred>
 *   ─ 存储 deferred（promise + resolve/reject），供防重复等待者复用结果
 *   ─ 请求 A 创建 deferred → 请求 B 被阻止时拿到 A 的 deferred.promise
 *   ─ 重试链复用同一个 deferred，保证等待者拿到最终结果而非中间失败
 *
 * requestManager:   RequestManager 实例
 *   ─ 内部两个 Map：
 *     preventPending: Map<string, PendingRequest>  — 防重复注册
 *     cancelPending:  Map<string, PendingRequest>  — 取消注册
 *   ─ 每个 PendingRequest 存 { key, config, controller, promise, timestamp }
 *   ─ controller 用于 abort()，promise 指向 pendingReturns 中的 deferred.promise
 *
 * ════════════════════════════════════════════════════════════════════════════════
 *                           enhance API（外部使用）
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * api.enhance.cancelRequest(key)
 *   ─ 取消 key 对应的请求（同时查两个 Map）
 *   ─ 内部调用 requestManager.cancelRequest(key) → controller.abort()
 *
 * api.enhance.getRequestStatus(key)
 *   ─ 返回 PendingRequest | undefined
 *   ─ 优先查 preventPending，其次 cancelPending
 *
 * api.enhance.clearAll()
 *   ─ reject 所有 deferred → 清空 pendingReturns → 清空 requestManager
 *
 * ════════════════════════════════════════════════════════════════════════════════
 *                           重试场景分析
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * | 场景                    | HTTP  | 重试 | 判断方式                        |
 * |-------------------------|-------|------|---------------------------------|
 * | 网络错误                | 无    | 是   | !error.response                 |
 * | 429 / 5xx               | >=500 | 是   | statusCodes 包含 / retryCondition |
 * | 4xx 客户端错误          | 400+  | 否   | 默认不重试                      |
 * | 请求取消                | -     | 否   | axios.isCancel()                |
 * | 防重复拦截              | -     | 否   | __preventReturn                 |
 * | 2xx 业务码异常          | 200   | 自定义| __bizRetry + retryCondition      |
 *
 * ════════════════════════════════════════════════════════════════════════════════
 *                           清理时机
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * | 操作           | pendingReturns | requestManager | deferred     |
 * |----------------|----------------|----------------|--------------|
 * | 成功 / 重试成功 | 删除           | 取消注册       | resolve      |
 * | 失败 / 重试耗尽 | 删除           | 取消注册       | reject       |
 * | 重试前          | 保留           | 取消注册       | 保留         |
 * | 防重复拦截      | -              | -              | -            |
 * | 请求被取消      | 删除           | 取消注册       | reject       |
 * | clearAll()     | 全部删除       | 全部清空       | reject 全部  |
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import { RequestManager } from './requestManager';
import { resolveRequestKey } from '../utils';
import type {
  CreateEnhanceOptions,
  EnhanceInstance,
  PreventDuplicateConfig,
  CancelRequestConfig,
  RetryConfig,
  PreventDuplicateOption,
  CancelRequestOption,
  RetryOption,
  InternalPreventConfig,
  InternalCancelConfig,
  InternalRetryConfig,
  RequestMethod,
} from '../types';
import { CONTENT_TYPE_MAP } from '../types';

// ════════════════════════════════════════════════════════════════════════════════
// 存储防重复请求的延迟 Promise
// ════════════════════════════════════════════════════════════════════════════════

/**
 * 延迟 Promise 结构
 *
 * 用于防重复提交：当检测到重复请求时，后续请求可以等待原始请求的结果。
 * Promise 会在原始请求（包括重试）最终完成时被 resolve/reject。
 * 重试链会复用同一个 deferred，保证后续请求拿到最终结果而非中间失败。
 */
interface PendingDeferred {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  promise: Promise<unknown>;
}

// ════════════════════════════════════════════════════════════════════════════════
// 默认配置
// ════════════════════════════════════════════════════════════════════════════════

/**
 * 默认防重复配置
 */
const DEFAULT_PREVENT_CONFIG: InternalPreventConfig = {
  enabled: true,
  methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
  intervalMs: 1000,
};

/**
 * 默认取消请求配置
 */
const DEFAULT_CANCEL_CONFIG: InternalCancelConfig = {
  enabled: true,
  methods: ['GET'],
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
 * 检查 HTTP 方法是否在允许列表中
 */
function shouldApply(method?: string, methods?: string[] | null): boolean {
  if (methods == null) return true;
  if (methods.length === 0) return false;
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
  config: PreventDuplicateOption | undefined,
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
    return { ...defaults, enabled: true, requestKey: config };
  }

  // function -> requestKey
  if (typeof config === 'function') {
    return { ...defaults, enabled: true, requestKey: config as (cfg: AxiosRequestConfig, h: (s: string) => string) => string };
  }

  // number -> intervalMs
  if (typeof config === 'number') {
    return { ...defaults, enabled: true, intervalMs: config };
  }

  // array -> methods
  if (Array.isArray(config)) {
    return { ...defaults, enabled: true, methods: config as string[] };
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
  config: CancelRequestOption | undefined,
  defaults: InternalCancelConfig
): InternalCancelConfig {
  if (!isConfigSet(config)) {
    return defaults;
  }

  if (typeof config === 'boolean') {
    return { ...defaults, enabled: config };
  }

  if (typeof config === 'string') {
    return { ...defaults, enabled: true, requestKey: config };
  }

  if (typeof config === 'function') {
    return { ...defaults, enabled: true, requestKey: config as (cfg: AxiosRequestConfig, h: (s: string) => string) => string };
  }

  if (Array.isArray(config)) {
    return { ...defaults, enabled: true, methods: config as string[] };
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
 * - number[]: 赋给 statusCodes
 * - function: 赋给 retryCondition
 * - object: 合并到配置
 * - undefined/null: 视为未传递，使用默认值
 *
 * 注意：非对象类型的快捷方式默认开启该功能（enabled: true），
 * 仅 retry: false 时明确关闭。
 */
function normalizeRetryConfig(
  config: RetryOption | undefined,
  defaults: InternalRetryConfig
): InternalRetryConfig {
  if (!isConfigSet(config)) {
    return defaults;
  }

  if (typeof config === 'boolean') {
    return { ...defaults, enabled: config };
  }

  if (typeof config === 'number') {
    return { ...defaults, enabled: true, retries: config };
  }

  if (typeof config === 'function') {
    return { ...defaults, enabled: true, retryCondition: config as (error: AxiosError) => boolean };
  }

  if (Array.isArray(config)) {
    return { ...defaults, enabled: true, statusCodes: config as number[] };
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
// 核心函数
// ════════════════════════════════════════════════════════════════════════════════

/**
 * 获取有效的增强配置
 *
 * 优先级规则：
 * 1. 请求级配置优先于实例级配置（通过 methods 数组控制生效方法）
 * 2. 未设置时使用实例默认配置
 * 3. 默认 methods：防重复 -> POST/PUT/PATCH/DELETE，取消请求 -> GET
 *
 * @param config 请求配置
 * @param instanceDefaults 实例默认配置
 */
function getEffectiveConfig(
  config: AxiosRequestConfig,
  instanceDefaults: {
    prevent: InternalPreventConfig;
    cancel: InternalCancelConfig;
  }
): { prevent: InternalPreventConfig; cancel: InternalCancelConfig } {
  const prevent = isConfigSet(config.preventDuplicate)
    ? normalizePreventConfig(config.preventDuplicate, instanceDefaults.prevent)
    : { ...instanceDefaults.prevent };

  const cancel = isConfigSet(config.cancelRequest)
    ? normalizeCancelConfig(config.cancelRequest, instanceDefaults.cancel)
    : { ...instanceDefaults.cancel };

  return { prevent, cancel };
}

// ════════════════════════════════════════════════════════════════════════════════
// 请求清理辅助
// ════════════════════════════════════════════════════════════════════════════════

function getPendingKey(config: AxiosRequestConfig): string | undefined {
  return (config as any).__pendingKey;
}
function getCancelKey(config: AxiosRequestConfig): string | undefined {
  return (config as any).__cancelKey;
}

/**
 * 清理 requestManager 中的注册记录（不操作 deferred）
 */
function cleanupRegistered(config: AxiosRequestConfig, rm: RequestManager): void {
  const pk = getPendingKey(config);
  const ck = getCancelKey(config);
  if (pk) rm.unregisterRequest(pk, 'prevent');
  if (ck && ck !== pk) rm.unregisterRequest(ck, 'cancel');
}

/**
 * 失败时：reject deferred + 清理
 */
function rejectAndCleanup(
  config: AxiosRequestConfig, rm: RequestManager,
  pr: Map<string, PendingDeferred>, reason: unknown
): void {
  const pk = getPendingKey(config);
  const ck = getCancelKey(config);
  if (pk) {
    const df = pr.get(pk);
    if (df) { df.reject(reason); pr.delete(pk); }
    rm.unregisterRequest(pk, 'prevent');
  }
  if (ck && ck !== pk) rm.unregisterRequest(ck, 'cancel');
}

function resolveAndCleanup(
  config: AxiosRequestConfig, rm: RequestManager,
  pr: Map<string, PendingDeferred>, data: unknown
): void {
  const pk = getPendingKey(config);
  const ck = getCancelKey(config);
  if (pk) {
    const df = pr.get(pk);
    if (df) { df.resolve(data); pr.delete(pk); }
    rm.unregisterRequest(pk, 'prevent');
  }
  if (ck && ck !== pk) rm.unregisterRequest(ck, 'cancel');
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
  // 初始化请求管理器 和 延迟 Promise 存储
  // ─────────────────────────────────────────────────────────────────────────
  const requestManager = new RequestManager();
  const pendingReturns = new Map<string, PendingDeferred>();

  // ─────────────────────────────────────────────────────────────────────────
  // 暴露给用户的 enhance API
  // ─────────────────────────────────────────────────────────────────────────
  const enhanceInstance: EnhanceInstance = {
    requestManager,
    clearAll: () => {
      for (const [key, deferred] of pendingReturns) {
        try { deferred.reject(new Error('All requests cleared')); } catch { }
      }
      pendingReturns.clear();
      requestManager.clearAll();
    },
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
      const { prevent, cancel } = getEffectiveConfig(config, { prevent: defaultPrevent, cancel: defaultCancel });

      // ─────────────────────────────────────────────────────────────────────
      // 步骤 2：处理 Content-Type
      // ─────────────────────────────────────────────────────────────────────
      // 仅在未显式设置 Content-Type 时处理（大小写不敏感）
      // 'json' → application/json;charset=UTF-8（默认）
      // 'form' → application/x-www-form-urlencoded
      // 'file' → 不设置（multipart/form-data 需要 boundary）
      // 自定义字符串 → 直接使用
      const headers = config.headers || {};
      const hasContentType = typeof headers === 'object'
        && Object.keys(headers).some(k => k.toLowerCase() === 'content-type');

      if (!hasContentType) {
        const contentType = config.contentType;

        if (contentType !== 'file') {
          config.headers = config.headers || {};
          const value = contentType != null
            ? (CONTENT_TYPE_MAP[contentType] || contentType)
            : CONTENT_TYPE_MAP.json;
          config.headers['Content-Type'] = value;
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // 步骤 3：取消旧请求（同 key 的旧请求被中止）
      // ─────────────────────────────────────────────────────────────────────
      if (cancel.enabled && shouldApply(method, cancel.methods)) {
        const key = resolveRequestKey(config, cancel.requestKey);
        requestManager.cancelRequest(key);
      }

      // ─────────────────────────────────────────────────────────────────────
      // 步骤 4：防重复检查（同 key 且在 intervalMs 内则阻止当前请求）
      // ─────────────────────────────────────────────────────────────────────
      if (prevent.enabled && shouldApply(method, prevent.methods)) {
        const key = resolveRequestKey(config, prevent.requestKey);

        // 检查是否有正在进行的相同请求
        const existing = requestManager.getRequestStatus(key);
        if (existing) {
          const now = Date.now();
          // 如果请求还在 intervalMs 内，则返回已有请求的 Promise
          if (now - existing.timestamp < prevent.intervalMs) {
            const deferred = pendingReturns.get(key);
            if (deferred) {
              // 阻止当前请求：通过 AbortController 中止本次请求
              const controller = new AbortController();
              config.signal = controller.signal;
              controller.abort('Request prevented by duplicate');

              // 保存 key，用于响应拦截器中可能需要的清理
              (config as any).__pendingKey = key;

              // 创建错误对象，携带原请求的 Promise 给调用方
              const error = new Error('Request prevented by duplicate') as AxiosError;
              (error as any).__preventReturn = true;
              (error as any).__pendingPromise = deferred.promise;
              (error as any).__pendingKey = key;
              error.config = config;

              return Promise.reject(error);
            }
          }
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // 步骤 5：注册新请求（创建 AbortController 供后续 cancel/prevent 使用）
      // ─────────────────────────────────────────────────────────────────────
      const needsPrevent = prevent.enabled && shouldApply(method, prevent.methods);
      const needsCancel = cancel.enabled && shouldApply(method, cancel.methods);

      if (needsPrevent || needsCancel) {
        const controller = new AbortController();
        config.signal = controller.signal;
        (config as any).__controller = controller;

        if (needsCancel) {
          const cancelKey = resolveRequestKey(config, cancel.requestKey);
          (config as any).__cancelKey = cancelKey;
          requestManager.registerRequest(cancelKey, 'cancel', controller, Promise.resolve());
        }

        if (needsPrevent) {
          const preventKey = resolveRequestKey(config, prevent.requestKey);
          (config as any).__pendingKey = preventKey;

          let deferred = pendingReturns.get(preventKey);
          if (!deferred) {
            let resolveFn: (value: unknown) => void;
            let rejectFn: (reason: unknown) => void;
            const promise = new Promise<unknown>((resolve, reject) => {
              resolveFn = resolve;
              rejectFn = reject;
            });
            deferred = { resolve: resolveFn!, reject: rejectFn!, promise };
            pendingReturns.set(preventKey, deferred);
          }

          requestManager.registerRequest(preventKey, 'prevent', controller, deferred.promise);
        }
      }

      return config;
    },
    (error) => {
      if (error?.config) rejectAndCleanup(error.config, requestManager, pendingReturns, error);
      return Promise.reject(error);
    }
  );

  // ════════════════════════════════════════════════════════════════════════════
  // 响应拦截器
  // ════════════════════════════════════════════════════════════════════════════
  instance.interceptors.response.use(
    // ─────────────────────────────────────────────────────────────────────────
    // 成功响应处理 (2xx)
    // ─────────────────────────────────────────────────────────────────────────
    async (response) => {
      const config = response.config;

      // ─────────────────────────────────────────────────────────────────────
      // 检查业务码重试（2xx 但业务逻辑失败）
      // ─────────────────────────────────────────────────────────────────────
      const retryConfig = normalizeRetryConfig(config.retry, defaultRetry);
      if (retryConfig.enabled && shouldApply(config.method, retryConfig.methods)) {
        const syntheticError = new Error('Business logic error') as AxiosError;
        syntheticError.config = config;
        syntheticError.response = response;
        syntheticError.isAxiosError = true;

        if (retryConfig.retryCondition(syntheticError)) {
          const retryCount = (config as any).__retryCount || 0;
          if (retryCount < retryConfig.retries) {
            await new Promise((resolve) => setTimeout(resolve, calculateRetryDelay(retryConfig, retryCount)));
            cleanupRegistered(config, requestManager);
            (config as any).__retryCount = retryCount + 1;
            return instance.request(config);
          }
        }
      }

      resolveAndCleanup(config, requestManager, pendingReturns, response);
      return response;
    },

    // ─────────────────────────────────────────────────────────────────────────
    // 错误响应处理 (非 2xx / 网络错误 / 取消 / 防重复拦截)
    // ─────────────────────────────────────────────────────────────────────────
    async (error) => {
      const config = error.config || (error as any).config;
      if (!config) return Promise.reject(error);

      // 情况 1：防重复拦截 → 返回原始 deferred.promise
      if ((error as any)?.__preventReturn && (error as any)?.__pendingPromise) {
        return (error as any).__pendingPromise;
      }

      // 情况 2：请求被取消 → reject + 清理（不重试）
      if (axios.isCancel(error)) {
        rejectAndCleanup(config, requestManager, pendingReturns, error);
        return Promise.reject(error);
      }

      // 情况 3：重试
      const retryConfig = normalizeRetryConfig(config.retry, defaultRetry);
      if (retryConfig.enabled && shouldApply(config.method, retryConfig.methods)) {
        const retryCount = (config as any).__retryCount || 0;

        const shouldRetry =
          retryCount < retryConfig.retries &&
          retryConfig.retryCondition(error) &&
          (!error.response || !retryConfig.statusCodes.length || retryConfig.statusCodes.includes(error.response.status));

        if (shouldRetry) {
          await new Promise((resolve) => setTimeout(resolve, calculateRetryDelay(retryConfig, retryCount)));
          cleanupRegistered(config, requestManager);
          (config as any).__retryCount = retryCount + 1;
          return instance.request(config);
        }
      }

      // 情况 4：不需要重试或重试耗尽，清理并抛出错误
      rejectAndCleanup(config, requestManager, pendingReturns, error);
      return Promise.reject(error);
    }
  );

  // ════════════════════════════════════════════════════════════════════════════
  // 添加 RESTful 方法封装
  // ════════════════════════════════════════════════════════════════════════════
  const methods: RequestMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

  for (const method of methods) {
    (instance as any)[method.toLowerCase()] = (url: string, data?: any, config?: AxiosRequestConfig) => {
      const finalConfig: AxiosRequestConfig = {
        ...config,
        url,
        method: method,
      };

      // 根据方法类型决定 data 参数的位置
      if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
        if (data) finalConfig.params = data;
      } else {
        if (data !== undefined) finalConfig.data = data;
      }

      return instance.request(finalConfig);
    };
  }

  // 添加 enhance 属性
  (instance as any).enhance = enhanceInstance;

  return instance as AxiosInstance & { enhance: EnhanceInstance };
}

export { createEnhanceInstance };
