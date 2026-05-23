/**
 * enhance-axios 核心模块
 *
 * ════════════════════════════════════════════════════════════════════════════════
 *                              功能说明
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 五个增强能力：
 *  1. 防重复提交 (preventDuplicate) — 短时间内相同请求复用第一次的结果
 *  2. 取消请求   (cancelRequest)    — 新请求到达时取消旧请求，始终保留最新
 *  3. 失败重试   (retry)            — HTTP 错误或业务码异常时自动重试
 *  4. 数据转换   (contentType)      — 根据 Content-Type 自动转换 data 格式
 *  5. 缓存破坏   (needCacheBust)        — 所有请求追加 _ 参数防止缓存
 *
 * ════════════════════════════════════════════════════════════════════════════════
 *                              默认策略
 * ════════════════════════════════════════════════════════════════════════════════
 *
 *  功能     | 默认启用 | 默认 methods                     | 默认 key 生成
 *  --------|---------|----------------------------------|------------------
 *  防重复   | 是      | POST, PUT, PATCH, DELETE         | hash(method|url|params|data)
 *  取消请求| 是      | GET                              | 同上
 *  重试     | 是      | 全部                             | N/A
 *  数据转换| 是      | N/A (有 data 的请求)             | N/A
 *  缓存破坏| 是      | 全部                             | N/A
 *
 * 防重复和取消请求通过 methods 各自控制生效范围，默认互不重叠。
 * 同一请求同时命中两者时：步骤 4（取消旧请求）→ 步骤 5（防重复检查）→ 步骤 6（注册）。
 *
 * ════════════════════════════════════════════════════════════════════════════════
 *                              配置规则
 * ════════════════════════════════════════════════════════════════════════════════
 *
 *  1. 请求级配置覆盖实例级配置
 *  2. 请求级传入 object 默认 enabled: true（显式 opt-in）
 *  3. 快捷写法（string/function/number/array）暗含 enabled: true
 *  4. needCacheBust 仅 false 关闭，其他值一律视为 true
 *  5. methods: undefined / null → 全部方法，methods: [] → 不应用
 *
 * ════════════════════════════════════════════════════════════════════════════════
 *                              请求拦截器流程
 * ════════════════════════════════════════════════════════════════════════════════
 *
 *  步骤 1 — 获取有效配置           请求级 > 实例级
 *  步骤 2 — Token 注入              tokenAuth 检测、注入 header、排队刷新
 *  步骤 3 — Content-Type 处理      默认 json，file 不设（浏览器自动 boundary）
 *  步骤 4 — 取消旧请求             同 cancelKey 的旧请求被 abort
 *  步骤 5 — 防重复检查             同 preventKey 且在 intervalMs 内 → 阻止，返回 deferred.promise
 *  步骤 6 — 注册新请求             AbortController + requestManager 双 Map 注册
 *  步骤 7 — 数据转换注入           file/form → transformRequest（json 由 axios 处理）
 *  步骤 8 — 缓存破坏               追加 _=<timestamp> 到 params（key 生成后，不影响防重复）
 *
 * ════════════════════════════════════════════════════════════════════════════════
 *                              响应拦截器流程
 * ════════════════════════════════════════════════════════════════════════════════
 *
 *  成功 (2xx):
 *   1. 业务码重试检测（retryCondition 在 success handler 中直接判断）
 *   2. resolve deferred → 清理 pendingReturns + requestManager
 *
 *  错误 (非 2xx / 网络错误 / 取消):
 *   情况 1 ─ 防重复拦截       → 返回 deferred.promise（不清理，等待者拿原请求结果）
 *   情况 2 ─ 请求被取消       → reject deferred → 清理 → 抛出
 *   情况 3 ─ 满足重试条件     → 保留 deferred → 清理 requestManager → 延迟后重试
 *   情况 4 ─ 不满足/重试耗尽  → reject deferred → 清理 → 抛出
 *
 * ════════════════════════════════════════════════════════════════════════════════
 *                           deferred 机制
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * pendingReturns: Map<key, { resolve, reject, promise }>
 *   请求 A 创建 deferred — 请求 B 被拦截时拿到 A 的 deferred.promise
 *   重试链复用同一个 deferred — 被拦截的请求拿到最终结果而非中间失败
 *
 * requestManager: { preventPending, cancelPending }
 *   两个独立 Map，各自存 { key, config, controller, promise, timestamp }
 *   controller 用于 abort()，promise 指向 pendingReturns 的 deferred.promise
 *
 * ════════════════════════════════════════════════════════════════════════════════
 *                              清理时机
 * ════════════════════════════════════════════════════════════════════════════════
 *
 *  操作              | pendingReturns | requestManager | deferred
 *  ------------------|----------------|----------------|----------
 *  成功 / 重试成功   | 删除           | 取消注册       | resolve
 *  失败 / 重试耗尽   | 删除           | 取消注册       | reject
 *  重试前            | 保留           | 取消注册       | 保留
 *  防重复拦截        | -              | -              | -
 *  请求被取消        | 删除           | 取消注册       | reject
 *  clearAll()        | 全部删除       | 全部清空       | reject 全部
 *
 * ════════════════════════════════════════════════════════════════════════════════
 *                              重试场景
 * ════════════════════════════════════════════════════════════════════════════════
 *
 *  场景               | HTTP   | 重试 | 判断方式
 *  -------------------|--------|------|------------------
 *  网络错误            | 无     | 是   | !error.response
 *  408 / 429 / 5xx    | >=400  | 是   | retryCondition
 *  4xx 客户端错误      | 400+   | 否   | 默认不重试
 *  请求取消            | -      | 否   | axios.isCancel()
 *  防重复拦截          | -      | 否   | __preventReturn
 *  2xx 业务码异常      | 200    | 自定义| success handler 中 retryCondition
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios';
import { RequestManager } from './requestManager';
import { resolveRequestKey } from '../utils';
import type {
  CreateEnhanceOptions,
  EnhanceInstance,
  PreventDuplicateConfig,
  CancelRequestConfig,
  PreventDuplicateOption,
  CancelRequestOption,
  InternalPreventConfig,
  InternalCancelConfig,
  RequestMethod,
} from '../types';
import { CONTENT_TYPE_MAP } from '../types';
import { TokenManager } from './tokenManager';
import { getDataFormat, injectDataTransform } from './dataTransform';
import { defaultRetryCondition, DEFAULT_RETRY_CONFIG, calculateRetryDelay, normalizeRetryConfig } from './retry';
import { shouldApply, isConfigSet } from './helpers';

export { defaultRetryCondition };

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

// ════════════════════════════════════════════════════════════════════════════════
// 配置归一化函数
// ════════════════════════════════════════════════════════════════════════════════

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
    return { ...defaults, enabled: true, methods: [...(config as string[])] };
  }

  // object -> 合并
  return {
    enabled: (config as PreventDuplicateConfig).enabled ?? true,
    requestKey: (config as PreventDuplicateConfig).requestKey ?? defaults.requestKey,
    methods: (config as PreventDuplicateConfig).methods != null
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
    return { ...defaults, enabled: true, methods: [...(config as string[])] };
  }

  return {
    enabled: (config as CancelRequestConfig).enabled ?? true,
    requestKey: (config as CancelRequestConfig).requestKey ?? defaults.requestKey,
    methods: (config as CancelRequestConfig).methods != null
      ? (config as CancelRequestConfig).methods
      : defaults.methods,
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
  const { tokenAuth: _ta, needToken: _nt, ...axiosOptions } = options;
  const instance = axios.create(axiosOptions);

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

  const needCacheBust = options.needCacheBust ?? true;
  const tokenManager = _ta ? new TokenManager(_ta, _nt) : null;

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
      for (const [_key, deferred] of pendingReturns) {
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
    async (config) => {
      const method = config.method?.toUpperCase() || 'GET';

      // ─────────────────────────────────────────────────────────────────────
      // 步骤 1：获取有效的增强配置
      // ─────────────────────────────────────────────────────────────────────
      const { prevent, cancel } = getEffectiveConfig(config, { prevent: defaultPrevent, cancel: defaultCancel });

      // ─────────────────────────────────────────────────────────────────────
      // 步骤 2：Token 注入
      // ─────────────────────────────────────────────────────────────────────
      if (tokenManager) await tokenManager.handleRequest(config);

      // ─────────────────────────────────────────────────────────────────────
      // 步骤 3：处理 Content-Type
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
      // 步骤 4：取消旧请求（同 key 的旧请求被中止）
      // ─────────────────────────────────────────────────────────────────────
      if (cancel.enabled && shouldApply(method, cancel.methods)) {
        const key = resolveRequestKey(config, cancel.requestKey);
        // 清除旧请求的 key 标记，避免其异步 error handler 误删新请求的注册
        const existing = requestManager.getRequestStatus(key);
        if (existing?.config) {
          (existing.config as any).__cancelKey = undefined;
          (existing.config as any).__pendingKey = undefined;
        }
        requestManager.cancelRequest(key);
      }

      // ─────────────────────────────────────────────────────────────────────
      // 步骤 5：防重复检查（同 key 且在 intervalMs 内则阻止当前请求）
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
      // 步骤 6：注册新请求（创建 AbortController 供后续 cancel/prevent 使用）
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
          requestManager.registerRequest(cancelKey, 'cancel', controller, Promise.resolve(), config);
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

          requestManager.registerRequest(preventKey, 'prevent', controller, deferred.promise, config);
        }
      }

      // ─────────────────────────────────────────────────────────────────────
      // 步骤 7：注入数据转换（file/form → transformRequest，json 由 axios 默认处理）
      // ─────────────────────────────────────────────────────────────────────
      const format = getDataFormat(config);
      if (format === 'file' || format === 'form') {
        injectDataTransform(config, format, instance);
      }

      // ─────────────────────────────────────────────────────────────────────
      // 步骤 8：缓存破坏（追加 _ 参数，key 生成后执行，stripCacheParam 自动剔除不影响 key）
      // ─────────────────────────────────────────────────────────────────────
      if ((config.needCacheBust ?? needCacheBust) !== false) {
        const stamp = Date.now().toString(36);
        if (config.params instanceof URLSearchParams) {
          config.params.append('_', stamp);
        } else if (typeof config.params === 'object' && config.params !== null) {
          config.params = { ...config.params, _: stamp };
        } else {
          config.params = { _: stamp };
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

      // Token 刷新（resolve 分支）
      if (tokenManager) {
        try {
          if (await tokenManager.handleAuthError(response, config)) {
            cleanupRegistered(config, requestManager);
            return instance.request(config);
          }
        } catch (err) {
          tokenManager.handleRefreshFailure(err);
          rejectAndCleanup(config, requestManager, pendingReturns, err);
          return Promise.reject(err);
        }
      }

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

      // Token 刷新（reject 分支，在 retry 之前）
      if (tokenManager) {
        try {
          if (await tokenManager.handleAuthError(error, config)) {
            cleanupRegistered(config, requestManager);
            return instance.request(config);
          }
        } catch (err) {
          tokenManager.handleRefreshFailure(err);
          rejectAndCleanup(config, requestManager, pendingReturns, err);
          return Promise.reject(err);
        }
      }

      // 情况 3：重试
      const retryConfig = normalizeRetryConfig(config.retry, defaultRetry);
      if (retryConfig.enabled && shouldApply(config.method, retryConfig.methods)) {
        const retryCount = (config as any).__retryCount || 0;

        const shouldRetry =
          retryCount < retryConfig.retries &&
          retryConfig.retryCondition(error);

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
