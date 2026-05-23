/**
 * TokenManager — Token 认证管理
 *
 * 负责：注入 header、检测过期、排队刷新、失败处理
 *
 * 三个公开方法对应拦截器调用点：
 *   handleRequest(config)   — 请求拦截器步骤 1.5
 *   handleResponse(response) — 响应拦截器 resolve 分支
 *   handleError(error)       — 响应拦截器 reject 分支
 */

import type { AxiosRequestConfig } from 'axios';
import type { TokenInfo, TokenAuthConfig } from '../types';

// ════════════════════════════════════════════════════════════════════════════════
// 工具函数
// ════════════════════════════════════════════════════════════════════════════════

export function formatHeader(token: string, fmt?: string | ((t: string) => string)): string {
  if (typeof fmt === 'function') return fmt(token).trim();
  if (typeof fmt === 'string') {
    const tpl = fmt.includes('{token}') ? fmt : `${fmt} {token}`;
    return tpl.replace('{token}', token).trim();
  }
  return `Bearer ${token}`;
}

function setAuthHeader(
  config: AxiosRequestConfig,
  token: string,
  auth: TokenAuthConfig,
): void {
  config.headers = config.headers || {};
  config.headers[auth.headerName || 'Authorization'] = formatHeader(token, auth.headerFormat);
}

function resolveNeedToken(
  config: AxiosRequestConfig,
  needTokenDefault: boolean | ((c: AxiosRequestConfig) => boolean) | undefined,
): boolean {
  if (config.needToken !== undefined) return config.needToken;
  if (typeof needTokenDefault === 'function') return needTokenDefault(config);
  if (needTokenDefault !== undefined) return needTokenDefault;
  return true;
}

function defaultShouldRefresh(err: any): boolean {
  return err?.response?.status === 401 || err?.response?.data?.code === 401;
}

function defaultTokenFailure(reason: string, error?: any): void {
  console.warn(`[enhance-axios] Token ${reason} failed`, error);
}

// ════════════════════════════════════════════════════════════════════════════════
// TokenManager
// ════════════════════════════════════════════════════════════════════════════════

export class TokenManager {
  private pendingRefresh: Promise<TokenInfo> | null = null;

  constructor(
    private auth: TokenAuthConfig,
    private needToken: boolean | ((c: AxiosRequestConfig) => boolean) | undefined,
  ) {}

  // ─── 请求拦截器 ───

  async handleRequest(config: AxiosRequestConfig): Promise<void> {
    if (!resolveNeedToken(config, this.needToken)) return;

    if (this.pendingRefresh) {
      const newToken = await this.pendingRefresh;
      setAuthHeader(config, newToken.accessToken, this.auth);
      return;
    }

    const local = await Promise.resolve(this.auth.getLocalToken());
    if (local) {
      setAuthHeader(config, local.accessToken, this.auth);
    }
  }

  // ─── 响应拦截器 resolve ───

  async handleResponse(response: any, config: AxiosRequestConfig): Promise<any> {
    if (!resolveNeedToken(config, this.needToken)) return null;

    const shouldRefresh = this.auth.shouldRefreshToken || defaultShouldRefresh;
    if (!shouldRefresh(response)) return null;

    return this.refreshAndRetry(config);
  }

  // ─── 响应拦截器 reject ───

  async handleError(error: any, config: AxiosRequestConfig): Promise<any> {
    if (!resolveNeedToken(config, this.needToken)) return null;

    const shouldRefresh = this.auth.shouldRefreshToken || defaultShouldRefresh;
    if (!shouldRefresh(error)) return null;

    return this.refreshAndRetry(config);
  }

  // ─── 内部 ───

  private async refreshAndRetry(config: AxiosRequestConfig): Promise<any> {
    try {
      if (!this.pendingRefresh) {
        this.pendingRefresh = this.auth.refreshToken().then((info) => {
          if (this.auth.setLocalToken) {
            Promise.resolve(this.auth.setLocalToken(info)).catch(() => {});
          }
          return info;
        });
      }
      const newToken = await this.pendingRefresh;
      this.pendingRefresh = null;
      setAuthHeader(config, newToken.accessToken, this.auth);
      return { retry: true, config };
    } catch (err) {
      this.pendingRefresh = null;
      (this.auth.tokenFailureHandler || defaultTokenFailure)('refresh', err);
      throw err;
    }
  }
}
