import type { AxiosRequestConfig } from 'axios';

export interface PreventDuplicateConfig {
  enabled?: boolean;
  requestKey?: string;
  methods?: string[];
  intervalMs?: number;
}

export interface CancelRequestConfig {
  enabled?: boolean;
  requestKey?: string;
  methods?: string[];
}

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

export interface CreateEnhanceOptions extends AxiosRequestConfig {
  preventDuplicate?: PreventDuplicateConfig | boolean;
  cancelRequest?: CancelRequestConfig | boolean;
}

declare module 'axios' {
  interface AxiosRequestConfig {
    preventDuplicate?: PreventDuplicateConfig | boolean;
    cancelRequest?: CancelRequestConfig | boolean;
  }
}

import { RequestManager } from '../core/requestManager';
export { RequestManager };