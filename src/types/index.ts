/**
 * enhance-axios 类型定义
 */

// 引入 axios 类型
import type { AxiosRequestConfig, AxiosError } from 'axios';
import type { RequestManager } from '../core/requestManager';

// ════════════════════════════════════════════════════════════════════════════════
// 基础类型
// ════════════════════════════════════════════════════════════════════════════════

export type RequestMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

/**
 * Content-Type 简化配置
 *
 * - 'json': application/json;charset=UTF-8
 * - 'form': application/x-www-form-urlencoded
 * - 'file': multipart/form-data（当 data 为 FormData 时不设置，交由浏览器自动处理）
 * - 其他字符串：直接用作 Content-Type 值
 */
export type ContentType = 'json' | 'form' | 'file' | (string & {});

export const CONTENT_TYPE_MAP: Record<string, string> = {
  json: 'application/json;charset=UTF-8',
  form: 'application/x-www-form-urlencoded',
  file: 'multipart/form-data',
};

// ════════════════════════════════════════════════════════════════════════════════
// 配置接口
// ════════════════════════════════════════════════════════════════════════════════

/**
 * 防重复提交配置
 *
 * 用于防止用户在短时间内重复发送相同请求
 * 当检测到重复请求时，返回已有请求的 Promise，阻止当前请求继续执行
 */
export interface PreventDuplicateConfig {
  /** 是否启用防重复提交，默认 true */
  enabled?: boolean;
  /** 请求标识生成方式 */
  requestKey?: string | ((config: AxiosRequestConfig) => string);
  /** 生效的 HTTP 方法，默认全部方法 */
  methods?: string[];
  /** 防重复时间窗口(ms)，默认 1000 */
  intervalMs?: number;
}

/**
 * 取消请求配置
 *
 * 用于取消正在进行的相同请求，只保留最新发出的请求
 * 当检测到相同请求时，取消旧请求，继续执行当前请求
 */
export interface CancelRequestConfig {
  /** 是否启用取消请求，默认 true */
  enabled?: boolean;
  /** 请求标识生成方式 */
  requestKey?: string | ((config: AxiosRequestConfig) => string);
  /** 生效的 HTTP 方法，默认全部方法 */
  methods?: string[];
}

/**
 * 失败重试配置
 *
 * 用于在请求失败时自动重试
 */
export interface RetryConfig {
  /** 是否启用重试，默认 true */
  enabled?: boolean;
  /** 重试次数，默认 3 */
  retries?: number;
  /** 初始重试延迟(ms)，默认 1000 */
  retryDelay?: number;
  /** 重试条件判断函数 */
  retryCondition?: (error: AxiosError) => boolean;
  /** 是否启用指数退避，默认 true */
  exponential?: boolean;
  /** 最大延迟时间(ms)，默认 30000 */
  maxDelay?: number;
  /** 生效的 HTTP 方法，默认全部方法 */
  methods?: string[];
  /** 需要重试的 HTTP 状态码列表 */
  statusCodes?: number[];
}

/**
 * 默认需要重试的 HTTP 状态码
 */
export const DEFAULT_RETRY_STATUS_CODES = [408, 429, 500, 502, 503, 504];

// ════════════════════════════════════════════════════════════════════════════════
// 内部类型
// ════════════════════════════════════════════════════════════════════════════════

/**
 * Pending 请求结构
 *
 * 用于存储正在进行的请求信息
 */
export interface PendingRequest {
  /** 请求标识 */
  key: string;
  /** 请求配置 */
  config: AxiosRequestConfig;
  /** AbortController，用于取消请求 */
  controller: AbortController;
  /** 请求的 Promise */
  promise: Promise<unknown>;
  /** 请求创建时间戳 */
  timestamp: number;
}

// ════════════════════════════════════════════════════════════════════════════════
// 增强实例接口
// ════════════════════════════════════════════════════════════════════════════════

/**
 * 增强实例 API
 *
 * 提供对增强功能的访问和控制
 */
export interface EnhanceInstance {
  /** 请求管理器 */
  requestManager: RequestManager;
  /** 取消所有 pending 请求 */
  clearAll: () => void;
  /** 取消指定请求 */
  cancelRequest: (key: string) => boolean;
  /** 获取请求状态 */
  getRequestStatus: (key: string) => PendingRequest | undefined;
}

// ════════════════════════════════════════════════════════════════════════════════
// 配置联合类型（用于灵活的 API）
// ════════════════════════════════════════════════════════════════════════════════

/**
 * 防重复配置联合类型
 *
 * 支持多种输入格式：
 * - boolean: 直接启用/禁用
 * - string: 设置 requestKey
 * - function: 设置 requestKey 生成函数
 * - number: 设置 intervalMs
 * - string[]: 设置 methods
 * - object: 完整配置对象
 */
export type PreventDuplicateOption =
  | PreventDuplicateConfig
  | boolean
  | string
  | ((config: AxiosRequestConfig) => string)
  | number
  | string[];

/**
 * 取消请求配置联合类型
 *
 * 支持多种输入格式（同上）
 */
export type CancelRequestOption =
  | CancelRequestConfig
  | boolean
  | string
  | ((config: AxiosRequestConfig) => string)
  | string[];

/**
 * 重试配置联合类型
 *
 * 支持多种输入格式：
 * - boolean: 启用/禁用
 * - number: 设置 retries
 * - number[]: 设置 statusCodes
 * - function: 设置 retryCondition
 * - object: 完整配置对象
 */
export type RetryOption =
  | RetryConfig
  | boolean
  | number
  | number[]
  | ((error: AxiosError) => boolean);

// ════════════════════════════════════════════════════════════════════════════════
// 内部类型（归一化后的配置，可选字段已填充默认值）
// ════════════════════════════════════════════════════════════════════════════════

type RequiredKeys<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

export type InternalPreventConfig = RequiredKeys<PreventDuplicateConfig, 'enabled' | 'intervalMs'>;

export type InternalCancelConfig = RequiredKeys<CancelRequestConfig, 'enabled'>;

export type InternalRetryConfig = RequiredKeys<
  RetryConfig,
  'enabled' | 'retries' | 'retryDelay' | 'retryCondition' | 'exponential' | 'maxDelay' | 'statusCodes'
>;

// ════════════════════════════════════════════════════════════════════════════════
// AxiosRequestConfig 扩展
// ════════════════════════════════════════════════════════════════════════════════

/**
 * 增强后的 AxiosRequestConfig
 *
 * 扩展了 preventDuplicate、cancelRequest 和 retry 字段
 */
export interface CreateEnhanceOptions extends AxiosRequestConfig {
  /** Content-Type 简化配置，默认 'json' */
  contentType?: ContentType;
  /** 防重复提交配置 */
  preventDuplicate?: PreventDuplicateOption;
  /** 取消请求配置 */
  cancelRequest?: CancelRequestOption;
  /** 重试配置 */
  retry?: RetryOption;
}

// ════════════════════════════════════════════════════════════════════════════════
// 模块扩展
// ════════════════════════════════════════════════════════════════════════════════

// 扩展 axios 的 AxiosRequestConfig 类型
declare module 'axios' {
  interface AxiosRequestConfig {
    /** Content-Type 简化配置，默认 'json' */
    contentType?: ContentType;
    /** 防重复提交配置 */
    preventDuplicate?: PreventDuplicateOption;
    /** 取消请求配置 */
    cancelRequest?: CancelRequestOption;
    /** 重试配置 */
    retry?: RetryOption;
  }
}

// ════════════════════════════════════════════════════════════════════════════════
// 导出
// ════════════════════════════════════════════════════════════════════════════════

export { RequestManager } from '../core/requestManager';