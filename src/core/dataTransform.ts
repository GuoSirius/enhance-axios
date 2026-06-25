/**
 * 数据自动转换（transformRequest 注入）
 *
 * 根据 Content-Type 自动转换 data 格式：
 *   file → FormData
 *   form → URLSearchParams
 *   json → 由 axios 默认 transformRequest 处理
 */

import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import { getFormData } from '../utils';

/** 检测当前请求的数据格式 */
export function getDataFormat(config: AxiosRequestConfig): string | undefined {
  // config.contentType 优先级高于 headers 中的 Content-Type
  if (config.contentType) return config.contentType;

  const headers = config.headers || {};
  const ctKey = Object.keys(headers).find(k => k.toLowerCase() === 'content-type');
  if (ctKey) {
    const ct = String(headers[ctKey]).toLowerCase();
    if (ct.includes('multipart/form-data')) return 'file';
    if (ct.includes('application/x-www-form-urlencoded')) return 'form';
    if (ct.includes('application/json') || ct.includes('+json')) return 'json';
  }
  return config.contentType;
}

/** 注入 transformRequest 处理 file/form 数据转换 */
export function injectDataTransform(
  config: AxiosRequestConfig,
  format: 'file' | 'form',
  instance: AxiosInstance,
): void {
  if ((config as any).__dataTransformInjected) return;
  (config as any).__dataTransformInjected = true;

  const ourTransform = (data: unknown) => {
    if (data == null || data instanceof FormData || data instanceof URLSearchParams) return data;
    if (typeof data !== 'object') return data;
    if (format === 'file') return getFormData(data);
    return new URLSearchParams(data as Record<string, string>);
  };

  const existing = config.transformRequest;
  const defaults = instance.defaults.transformRequest;
  const source = existing != null ? existing : defaults;
  let chain: ((...args: any[]) => any)[] = [];
  if (source != null) {
    chain = Array.isArray(source) ? [...source] : [source];
  }
  config.transformRequest = [ourTransform, ...chain];
}
