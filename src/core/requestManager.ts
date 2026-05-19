import axios, { AxiosRequestConfig, CancelTokenSource, CancelToken } from 'axios';
import type {
  PreventDuplicateConfig,
  CancelRequestConfig,
  PendingRequest,
} from '../types';
import { resolveRequestKey } from '../utils';

interface InternalPreventConfig {
  enabled: boolean;
  requestKey?: string;
  methods?: string[];
  intervalMs: number;
}

interface InternalCancelConfig {
  enabled: boolean;
  requestKey?: string;
  methods?: string[];
}

export class RequestManager {
  private preventPending: Map<string, PendingRequest> = new Map();
  private cancelPending: Map<string, PendingRequest> = new Map();

  constructor(
    defaultPrevent: PreventDuplicateConfig = {},
    defaultCancel: CancelRequestConfig = {}
  ) {
    // 初始化默认配置
  }

  /**
   * 检查是否有相同的待处理请求（防重复）
   */
  checkPreventDuplicate(
    config: AxiosRequestConfig,
    preventConfig: InternalPreventConfig
  ): PendingRequest | null {
    if (!preventConfig.enabled) return null;
    if (!this.shouldApply(config.method, preventConfig.methods)) return null;

    const key = resolveRequestKey(config, preventConfig.requestKey);
    const existing = this.preventPending.get(key);

    if (existing) {
      const now = Date.now();
      if (now - existing.timestamp < preventConfig.intervalMs) {
        return existing;
      }
      // 超出时间限制，清理旧请求
      try { existing.cancelSource.cancel(); } catch {}
      this.preventPending.delete(key);
    }

    return null;
  }

  /**
   * 检查并取消相同的待处理请求（取消请求）
   */
  checkAndCancelRequest(
    config: AxiosRequestConfig,
    cancelConfig: InternalCancelConfig
  ): string | null {
    if (!cancelConfig.enabled) return null;
    if (!this.shouldApply(config.method, cancelConfig.methods)) return null;

    const key = resolveRequestKey(config, cancelConfig.requestKey);
    const existing = this.cancelPending.get(key);

    if (existing) {
      try { existing.cancelSource.cancel(); } catch {}
      this.cancelPending.delete(key);
      return key;
    }

    return null;
  }

  /**
   * 注册一个新请求
   */
  registerRequest(
    key: string,
    type: 'prevent' | 'cancel',
    source: CancelTokenSource,
    promise: Promise<unknown>
  ): void {
    const pending: PendingRequest = {
      key,
      config: {},
      cancelSource: source,
      promise,
      timestamp: Date.now(),
    };

    if (type === 'prevent') {
      this.preventPending.set(key, pending);
    } else {
      this.cancelPending.set(key, pending);
    }
  }

  /**
   * 移除请求记录
   */
  unregisterRequest(key: string, type: 'prevent' | 'cancel'): void {
    if (type === 'prevent') {
      this.preventPending.delete(key);
    } else {
      this.cancelPending.delete(key);
    }
  }

  private shouldApply(method?: string, methods?: string[]): boolean {
    if (!methods || methods.length === 0) return true;
    return methods.includes(method?.toUpperCase() || 'GET');
  }

  clearAll(): void {
    for (const req of this.preventPending.values()) {
      try { req.cancelSource.cancel(); } catch {}
    }
    this.preventPending.clear();
    for (const req of this.cancelPending.values()) {
      try { req.cancelSource.cancel(); } catch {}
    }
    this.cancelPending.clear();
  }

  cancelRequest(key: string): boolean {
    const preventReq = this.preventPending.get(key);
    if (preventReq) {
      try { preventReq.cancelSource.cancel(); } catch {}
      this.preventPending.delete(key);
      return true;
    }
    const cancelReq = this.cancelPending.get(key);
    if (cancelReq) {
      try { cancelReq.cancelSource.cancel(); } catch {}
      this.cancelPending.delete(key);
      return true;
    }
    return false;
  }

  getRequestStatus(key: string): PendingRequest | undefined {
    return this.preventPending.get(key) ?? this.cancelPending.get(key);
  }
}