import type { AxiosRequestConfig, AxiosError } from 'axios';

export interface PreventDuplicateConfig {
  enabled?: boolean;
  requestKey?: string | ((config: AxiosRequestConfig) => string);
  methods?: string[];
  intervalMs?: number;
}

export interface CancelRequestConfig {
  enabled?: boolean;
  requestKey?: string | ((config: AxiosRequestConfig) => string);
  methods?: string[];
}

export interface RetryConfig {
  enabled?: boolean;        // 默认 true
  retries?: number;        // 重试次数，默认 3
  retryDelay?: number;     // 初始延迟(ms)，默认 1000
  retryCondition?: (error: AxiosError) => boolean;
  exponential?: boolean;   // 指数增长，默认 true
  maxDelay?: number;       // 最大延迟(ms)，默认 30000
  methods?: string[];      // 生效方法，默认全部
  statusCodes?: number[];  // 需要重试的 HTTP 状态码
}

// 默认状态码
export const DEFAULT_RETRY_STATUS_CODES = [408, 429, 500, 502, 503, 504];

export interface PendingRequest {
  key: string;
  config: AxiosRequestConfig;
  cancelSource: { cancel: () => void };
  promise: Promise<unknown>;
  timestamp: number;
}

export interface EnhanceInstance {
  requestManager: any;
  clearAll: () => void;
  cancelRequest: (key: string) => boolean;
  getRequestStatus: (key: string) => PendingRequest | undefined;
}

// 配置归一化联合类型
export type PreventDuplicateOption =
  | PreventDuplicateConfig
  | boolean
  | string
  | ((config: AxiosRequestConfig) => string)
  | number
  | string[];

export type CancelRequestOption =
  | CancelRequestConfig
  | boolean
  | string
  | ((config: AxiosRequestConfig) => string)
  | string[];

export type RetryOption =
  | RetryConfig
  | boolean
  | number;

export interface CreateEnhanceOptions extends AxiosRequestConfig {
  preventDuplicate?: PreventDuplicateOption;
  cancelRequest?: CancelRequestOption;
  retry?: RetryOption;
}

declare module 'axios' {
  interface AxiosRequestConfig {
    preventDuplicate?: PreventDuplicateOption;
    cancelRequest?: CancelRequestOption;
    retry?: RetryOption;
  }
}

import { RequestManager } from '../core/requestManager';
export { RequestManager };