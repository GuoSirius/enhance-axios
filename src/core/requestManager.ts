/**
 * 请求管理器
 *
 * 负责管理所有 pending 状态的请求，支持：
 * 1. 防重复提交：检查是否有相同的正在进行的请求
 * 2. 取消请求：取消指定的正在进行的请求
 *
 * 存储结构：
 * - preventPending: 防重复提交的 pending 请求（key 来自 preventDuplicate.requestKey）
 * - cancelPending:  取消请求的 pending 请求（key 来自 cancelRequest.requestKey）
 *
 * 两个 Map 独立，同一个 key 可同时存在于两者（各自 requestKey 可能不同）。
 *
 * 取消机制：使用 AbortController / AbortSignal（axios 1.x 推荐）
 */

import type { AxiosRequestConfig } from 'axios';
import type { PendingRequest } from '../types';

export class RequestManager {
  private preventPending = new Map<string, PendingRequest>();
  private cancelPending = new Map<string, PendingRequest>();

  /**
   * 注册一个新请求
   */
  registerRequest(
    key: string,
    type: 'prevent' | 'cancel',
    controller: AbortController,
    promise: Promise<unknown>,
    config?: AxiosRequestConfig,
  ): void {
    const pending: PendingRequest = {
      key,
      config: config || ({} as AxiosRequestConfig),
      controller,
      promise,
      timestamp: Date.now(),
    };
    (type === 'prevent' ? this.preventPending : this.cancelPending).set(key, pending);
  }

  /**
   * 移除请求记录
   */
  unregisterRequest(key: string, type: 'prevent' | 'cancel'): void {
    (type === 'prevent' ? this.preventPending : this.cancelPending).delete(key);
  }

  /**
   * 取消并移除请求，同时检查两个 Map
   */
  cancelRequest(key: string): boolean {
    let cancelled = false;

    const abort = (map: Map<string, PendingRequest>) => {
      const req = map.get(key);
      if (req) {
        try { req.controller.abort('Cancelled by cancelRequest'); } catch { /* noop */ }
        map.delete(key);
        cancelled = true;
      }
    };

    abort(this.preventPending);
    abort(this.cancelPending);
    return cancelled;
  }

  /**
   * 获取请求状态（优先返回 preventPending）
   */
  getRequestStatus(key: string): PendingRequest | undefined {
    return this.preventPending.get(key) ?? this.cancelPending.get(key);
  }

  getPreventPending(key: string): PendingRequest | undefined {
    return this.preventPending.get(key);
  }

  getCancelPending(key: string): PendingRequest | undefined {
    return this.cancelPending.get(key);
  }

  /**
   * 清空所有 pending 请求
   */
  clearAll(): void {
    const abortAll = (map: Map<string, PendingRequest>, reason: string) => {
      for (const req of map.values()) {
        try { req.controller.abort(reason); } catch { /* noop */ }
      }
      map.clear();
    };

    abortAll(this.preventPending, 'Cleared by clearAll');
    abortAll(this.cancelPending, 'Cleared by clearAll');
  }

  /**
   * 获取 pending 数量（注意两 Map 独立，合计可能重复计数）
   */
  getPendingCount(): { prevent: number; cancel: number; total: number } {
    return {
      prevent: this.preventPending.size,
      cancel: this.cancelPending.size,
      total: this.preventPending.size + this.cancelPending.size,
    };
  }

  /**
   * 获取所有 pending 的 key
   */
  getPendingKeys(): { prevent: string[]; cancel: string[] } {
    return {
      prevent: Array.from(this.preventPending.keys()),
      cancel: Array.from(this.cancelPending.keys()),
    };
  }
}
