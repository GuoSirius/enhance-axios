/**
 * 失败重试模块
 *
 * 默认重试条件 + 配置归一化 + 延迟计算
 */

import type { AxiosError } from 'axios';
import type { RetryConfig, RetryOption, InternalRetryConfig } from '../types';
import { isConfigSet } from './helpers';

// ════════════════════════════════════════════════════════════════════════════════

/** 默认重试条件（可导出复用） */
export function defaultRetryCondition(error: AxiosError): boolean {
  if (!error.response) return true;
  const status = error.response.status;
  if (status === 408 || status === 429) return true;
  if (status >= 500 && status < 600) return true;
  return false;
}

/** 默认重试配置 */
export const DEFAULT_RETRY_CONFIG: InternalRetryConfig = {
  enabled: true,
  retries: 3,
  retryDelay: 1000,
  retryCondition: defaultRetryCondition,
  exponential: true,
  maxDelay: 30000,
};

/** 指数退避延迟 */
export function calculateRetryDelay(
  config: { retryDelay: number; exponential: boolean; maxDelay: number },
  retryCount: number,
): number {
  if (!config.exponential) return config.retryDelay;
  return Math.min(config.retryDelay * Math.pow(2, retryCount), config.maxDelay);
}

/** 配置归一化：失败重试 */
export function normalizeRetryConfig(
  config: RetryOption | undefined,
  defaults: InternalRetryConfig,
): InternalRetryConfig {
  if (!isConfigSet(config)) return defaults;

  if (typeof config === 'boolean') return { ...defaults, enabled: config };
  if (typeof config === 'number') return { ...defaults, enabled: true, retries: config };
  if (typeof config === 'function') return { ...defaults, enabled: true, retryCondition: config as (error: AxiosError) => boolean };

  if (Array.isArray(config)) {
    const codes = config as number[];
    return {
      ...defaults,
      enabled: true,
      retryCondition: (error: AxiosError) => {
        if (!error.response) return true;
        return codes.includes(error.response.status);
      },
    };
  }

  return {
    enabled: (config as RetryConfig).enabled ?? true,
    retries: (config as RetryConfig).retries ?? defaults.retries,
    retryDelay: (config as RetryConfig).retryDelay ?? defaults.retryDelay,
    retryCondition: (config as RetryConfig).retryCondition ?? defaults.retryCondition,
    exponential: (config as RetryConfig).exponential ?? defaults.exponential,
    maxDelay: (config as RetryConfig).maxDelay ?? defaults.maxDelay,
    methods: (config as RetryConfig).methods != null
      ? (config as RetryConfig).methods
      : defaults.methods,
  };
}
