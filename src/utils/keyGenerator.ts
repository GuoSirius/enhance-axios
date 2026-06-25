import type { AxiosRequestConfig } from 'axios';
import { isPlainObject } from './common';

// ════════════════════════════════════════════════════════════════════════════════
// 辅助函数
// ════════════════════════════════════════════════════════════════════════════════

/**
 * 将特殊类型转为普通对象，供模板解析和哈希使用：
 *   URLSearchParams → { key: value, ... }
 *   其他（Blob/FormData/原值）→ 原样返回
 */
function toPlain(value: unknown): unknown {
  if (value == null) return value;
  if (typeof URLSearchParams !== 'undefined' && value instanceof URLSearchParams) {
    return Object.fromEntries(value);
  }
  return value;
}

// ════════════════════════════════════════════════════════════════════════════════
// 公开 API
// ════════════════════════════════════════════════════════════════════════════════

/**
 * 获取嵌套属性的值
 *
 * 支持两种路径格式：
 *   - 点分隔：data.user.name
 *   - 括号索引：data.users[0].name（内部转为 data.users.0.name）
 */
export function getNestedValue(obj: unknown, path: string): unknown {
  if (!path) return obj;
  const normalized = path.replace(/\[(\d+)\]/g, '.$1');
  return normalized.split('.').reduce<unknown>(
    (o: any, k) => (o == null ? undefined : o[k]),
    obj,
  );
}

/**
 * 解析字符串模板
 * 支持 ${xxx} 或 ${xxx.yyy} 或 ${xxx[0].yyy} 占位符
 */
export function resolveTemplate(template: string, config: AxiosRequestConfig): string {
  const context = {
    method: config.method?.toUpperCase() || 'GET',
    url: config.url || '',
    params: toPlain(config.params),
    data: toPlain(config.data),
  };

  return template.replace(/\$\{([^}]+)\}/g, (_match, path) => {
    const value = getNestedValue(context, path);
    if (value == null) return '';
    if (typeof value === 'object') {
      const str = JSON.stringify(value);
      // 防止超大对象产生过长的模板结果（如 base64 文件内容）
      return str.length > 512 ? hash(str) : str;
    }
    return String(value);
  });
}

/**
 * 生成默认的 requestKey（method + url + params + data 的排序哈希）
 *
 * 自动剔除 params 和 data 中的 _ 字段（缓存破坏参数），
 * 避免重试时 key 不一致导致 deferred 链断裂。
 */
export function generateDefaultKey(config: AxiosRequestConfig): string {
  const parts = [
    config.method?.toUpperCase() || 'GET',
    config.url || '',
    config.params != null ? JSON.stringify(sortObject(stripCacheParam(toPlain(config.params)))) : '',
    config.data != null ? JSON.stringify(sortObject(stripCacheParam(toPlain(config.data)))) : '',
  ];
  return hash(parts.join('|'));
}

/**
 * 字符串哈希（cyrb53 — 53-bit，碰撞概率远低于 FNV-1a 32-bit）
 *
 * 基于 https://github.com/bryc/code/blob/master/jshash/README.md#cyrb53
 * 返回 53-bit 正整数的 hex 字符串（最多 14 位），兼容浏览器。
 */
export function hash(str: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const result = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return result.toString(16).padStart(8, '0');
}

/**
 * 解析 requestKey
 *
 * - 函数 → 直接调用
 * - 包含 ${ 的字符串 → 模板解析
 * - 其他字符串 → 原样返回
 * - 未提供 → 自动生成（method + url + params + data）
 */
export function resolveRequestKey(
  config: AxiosRequestConfig,
  keyTemplate?: string | ((config: AxiosRequestConfig, hash: (str: string) => string) => string),
): string {
  if (!keyTemplate) return generateDefaultKey(config);

  if (typeof keyTemplate === 'function') {
    return keyTemplate(config, hash);
  }

  if (typeof keyTemplate === 'string' && keyTemplate.includes('${')) {
    return hash(resolveTemplate(keyTemplate, config));
  }

  return keyTemplate;
}

// ════════════════════════════════════════════════════════════════════════════════
// 内部函数
// ════════════════════════════════════════════════════════════════════════════════

/**
 * 剔除对象中的 _ 字段（缓存破坏参数，不应参与 key 生成）
 */
function stripCacheParam(obj: unknown): unknown {
  if (obj == null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj;
  if (!isPlainObject(obj)) return obj;
  const { _, ...rest } = obj as Record<string, unknown>;
  return rest;
}

/**
 * 对对象键进行递归排序（保证相同数据产生相同哈希）
 *
 * 非 plain 对象（Blob / FormData / Date 等）直接返回原值，
 * 避免 Object.keys() 返回空数组导致哈希碰撞。
 */
function sortObject(obj: unknown): unknown {
  if (obj == null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sortObject);
  if (!isPlainObject(obj)) return obj;
  const sorted: Record<string, unknown> = {};
  const keys = Object.keys(obj).sort();
  for (const key of keys) {
    sorted[key] = sortObject(obj[key]);
  }
  return sorted;
}
