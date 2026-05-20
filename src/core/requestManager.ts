/**
 * 请求管理器
 *
 * 负责管理所有 pending 状态的请求，支持：
 * 1. 防重复提交：检查是否有相同的正在进行的请求
 * 2. 取消请求：取消指定的正在进行的请求
 *
 * ════════════════════════════════════════════════════════════════════════════════
 *                           设计说明
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 使用 Map 存储 pending 请求，以 requestKey 为键
 * 每次请求完成后，需要调用 unregisterRequest 清理记录
 *
 * 存储结构：
 * - preventPending: 存储防重复提交的 pending 请求
 * - cancelPending: 存储取消请求的 pending 请求
 *
 * 注意：两个 Map 是独立的，同一个 key 可以同时存在于两个 Map 中
 * 这是因为防重复和取消请求可能同时启用（虽然推荐只使用其中一个）
 *
 * ════════════════════════════════════════════════════════════════════════════════
 *                           取消机制说明
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * 使用 AbortController / AbortSignal（axios 1.x 推荐方式）
 * - 创建：new AbortController()
 * - 设置到请求：config.signal = controller.signal
 * - 取消：controller.abort(reason)
 * - 取消错误：axios.isCancel(error) 对两种机制都有效
 */

import type { AxiosRequestConfig } from 'axios';
import type { PendingRequest } from '../types';

/**
 * 请求管理器类
 *
 * 用于管理所有 pending 状态的请求
 */
export class RequestManager {
  // 存储防重复提交的 pending 请求
  private preventPending: Map<string, PendingRequest> = new Map();

  // 存储取消请求的 pending 请求
  private cancelPending: Map<string, PendingRequest> = new Map();

  constructor() {
    // 构造函数为空，配置由外部传入
  }

  /**
   * 注册一个新请求
   *
   * @param key 请求标识
   * @param type 请求类型：'prevent' 防重复 或 'cancel' 取消请求
   * @param controller AbortController
   * @param promise 请求的 Promise
   * @param config 请求配置（用于记录元数据）
   */
  registerRequest(
    key: string,
    type: 'prevent' | 'cancel',
    controller: AbortController,
    promise: Promise<unknown>,
    config?: AxiosRequestConfig
  ): void {
    const pending: PendingRequest = {
      key,
      config: config || {},
      controller,
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
   *
   * @param key 请求标识
   * @param type 请求类型
   */
  unregisterRequest(key: string, type: 'prevent' | 'cancel'): void {
    if (type === 'prevent') {
      this.preventPending.delete(key);
    } else {
      this.cancelPending.delete(key);
    }
  }

  /**
   * 取消并移除请求
   *
   * @param key 请求标识
   * @returns 是否成功取消
   */
  cancelRequest(key: string): boolean {
    // 先检查 preventPending
    const preventReq = this.preventPending.get(key);
    if (preventReq) {
      try {
        preventReq.controller.abort('Cancelled by cancelRequest');
      } catch {
        // 忽略取消错误
      }
      this.preventPending.delete(key);
      return true;
    }

    // 再检查 cancelPending
    const cancelReq = this.cancelPending.get(key);
    if (cancelReq) {
      try {
        cancelReq.controller.abort('Cancelled by cancelRequest');
      } catch {
        // 忽略取消错误
      }
      this.cancelPending.delete(key);
      return true;
    }

    return false;
  }

  /**
   * 获取请求状态
   *
   * @param key 请求标识
   * @returns PendingRequest 或 undefined
   */
  getRequestStatus(key: string): PendingRequest | undefined {
    // 先检查 preventPending
    const preventReq = this.preventPending.get(key);
    if (preventReq) {
      return preventReq;
    }

    // 再检查 cancelPending
    return this.cancelPending.get(key);
  }

  /**
   * 获取 preventPending 中的请求
   */
  getPreventPending(key: string): PendingRequest | undefined {
    return this.preventPending.get(key);
  }

  /**
   * 获取 cancelPending 中的请求
   */
  getCancelPending(key: string): PendingRequest | undefined {
    return this.cancelPending.get(key);
  }

  /**
   * 清空所有 pending 请求
   */
  clearAll(): void {
    // 取消并清空 preventPending
    for (const req of this.preventPending.values()) {
      try {
        req.controller.abort('Cleared by clearAll');
      } catch {
        // 忽略取消错误
      }
    }
    this.preventPending.clear();

    // 取消并清空 cancelPending
    for (const req of this.cancelPending.values()) {
      try {
        req.controller.abort('Cleared by clearAll');
      } catch {
        // 忽略取消错误
      }
    }
    this.cancelPending.clear();
  }

  /**
   * 获取当前 pending 请求数量
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
