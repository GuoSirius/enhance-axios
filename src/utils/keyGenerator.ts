import type { AxiosRequestConfig } from 'axios';

// ════════════════════════════════════════════════════════════════════════════════
// 辅助函数
// ════════════════════════════════════════════════════════════════════════════════

/**
 * 检查值是否为"可安全按 key 遍历"的普通对象
 * 排除 Blob / FormData / Date / Map / Set 等内置类型
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  if (Array.isArray(value)) return false;
  if (value instanceof Blob) return false;
  if (value instanceof Date) return false;
  if (typeof FormData !== 'undefined' && value instanceof FormData) return false;
  if (typeof Map !== 'undefined' && value instanceof Map) return false;
  if (typeof Set !== 'undefined' && value instanceof Set) return false;
  return true;
}

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
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  });
}

/**
 * 生成默认的 requestKey（method + url + params + data 的排序哈希）
 */
export function generateDefaultKey(config: AxiosRequestConfig): string {
  const parts = [
    config.method?.toUpperCase() || 'GET',
    config.url || '',
    config.params != null ? JSON.stringify(sortObject(toPlain(config.params))) : '',
    config.data != null ? JSON.stringify(sortObject(toPlain(config.data))) : '',
  ];
  return hash(parts.join('|'));
}

/**
 * 字符串哈希（FNV-1a 32-bit，兼容浏览器）
 */
export function hash(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
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
  keyTemplate?: string | ((config: AxiosRequestConfig) => string),
): string {
  if (!keyTemplate) return generateDefaultKey(config);

  if (typeof keyTemplate === 'function') {
    return keyTemplate(config);
  }

  if (typeof keyTemplate === 'string' && keyTemplate.includes('${')) {
    return resolveTemplate(keyTemplate, config);
  }

  return keyTemplate;
}

// ════════════════════════════════════════════════════════════════════════════════
// 内部函数
// ════════════════════════════════════════════════════════════════════════════════

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
