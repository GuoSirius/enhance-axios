/**
 * TokenManager — Token 认证管理
 *
 * 请求拦截器：注入 header，排队等待刷新
 * 响应拦截器：检测过期，触发刷新，返回 true 通知调用方重试
 */

import type { AxiosRequestConfig } from 'axios';
import type { TokenInfo, TokenAuthConfig } from '../types';

// ════════════════════════════════════════════════════════════════════════════════

export function formatHeader(token: string, fmt?: string | ((t: string) => string)): string {
  if (typeof fmt === 'function') return fmt(token).trim();
  if (typeof fmt === 'string') {
    const tpl = fmt.includes('{token}') ? fmt : `${fmt} {token}`;
    return tpl.replace('{token}', token).trim();
  }
  return `Bearer ${token}`;
}

function setHeader(config: AxiosRequestConfig, token: string, auth: TokenAuthConfig): void {
  config.headers = config.headers || {};
  config.headers[auth.headerName || 'Authorization'] = formatHeader(token, auth.headerFormat);
}

function shouldUseToken(
  config: AxiosRequestConfig,
  instanceNeedToken: boolean | ((c: AxiosRequestConfig) => boolean) | undefined,
): boolean {
  if (config.needToken !== undefined) return config.needToken;
  if (typeof instanceNeedToken === 'function') return instanceNeedToken(config);
  if (instanceNeedToken !== undefined) return instanceNeedToken;
  return true;
}

function defaultShouldRefresh(err: any): boolean {
  return err?.response?.status === 401 || err?.response?.data?.code === 401;
}

// ════════════════════════════════════════════════════════════════════════════════

export class TokenManager {
  private pendingRefresh: Promise<TokenInfo> | null = null;

  constructor(
    private auth: TokenAuthConfig,
    private needTokenDefault: boolean | ((c: AxiosRequestConfig) => boolean) | undefined,
  ) {}

  /** 请求拦截器：注入 token header */
  async handleRequest(config: AxiosRequestConfig): Promise<void> {
    if (!shouldUseToken(config, this.needTokenDefault)) return;

    if (this.pendingRefresh) {
      try {
        const info = await this.pendingRefresh;
        setHeader(config, info.accessToken, this.auth);
        return;
      } catch {
        this.pendingRefresh = null; // 上次刷新失败，重新尝试
      }
    }

    try {
      const local = await Promise.resolve(this.auth.getLocalToken());
      if (local) {
        setHeader(config, local.accessToken, this.auth);
      }
    } catch {
      // getLocalToken 异常 → 静默跳过，等响应时触发刷新
    }
  }

  /**
   * 响应拦截器（resolve / reject）：
   * 检测到 token 过期则刷新并注入新 token。
   * 返回 true 表示调用方需要调用 instance.request(config) 重试。
   * 抛出异常表示刷新失败，调用方应 reject。
   */
  async handleAuthError(responseOrError: any, config: AxiosRequestConfig): Promise<boolean> {
    if (!shouldUseToken(config, this.needTokenDefault)) return false;

    const check = this.auth.shouldRefreshToken || defaultShouldRefresh;
    if (!check(responseOrError)) return false;

    if (!this.pendingRefresh) {
      this.pendingRefresh = this.auth.refreshToken()
        .then((info) => {
          if (this.auth.setLocalToken) {
            Promise.resolve(this.auth.setLocalToken(info)).catch(() => {});
          }
          return info;
        });
    }

    const info = await this.pendingRefresh;
    this.pendingRefresh = null;
    setHeader(config, info.accessToken, this.auth);
    return true;
  }

  /** 刷新失败时调用 */
  clearPendingRefresh(): void {
    this.pendingRefresh = null;
  }
}
