/**
 * 内部共享工具
 */

/**
 * 检查值是否为可安全遍历键的普通对象
 * 排除 Array / Blob / Date / FormData / Map / Set 等内置类型
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false;
  if (Array.isArray(value)) return false;
  if (value instanceof Blob) return false;
  if (value instanceof Date) return false;
  if (typeof FormData !== 'undefined' && value instanceof FormData) return false;
  if (typeof Map !== 'undefined' && value instanceof Map) return false;
  if (typeof Set !== 'undefined' && value instanceof Set) return false;
  return true;
}
