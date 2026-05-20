/**
 * getFormData — 将任意数据转换为 FormData
 *
 * 转换规则：
 * - File / Blob           → 字段名 'file'（可通过 fieldName 自定义）
 * - FileList              → 遍历，每个文件字段名 'file'
 * - 数组                  → 遍历每一项，所有值共用同一字段名
 * - 普通对象              → 遍历 entries，每个 key 作为字段名；嵌套对象用 . 连接
 * - string/number/boolean → 转字符串，字段名 'file'
 * - null / undefined      → 跳过
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

function appendValue(fd: FormData, key: string, value: unknown): void {
  if (value == null) return;

  if (value instanceof File) {
    fd.append(key, value);
  } else if (value instanceof Blob) {
    fd.append(key, value);
  } else if (value instanceof Date) {
    fd.append(key, value.toISOString());
  } else if (Array.isArray(value)) {
    for (const item of value) {
      appendValue(fd, key, item);
    }
  } else if (isPlainObject(value)) {
    for (const [subKey, subValue] of Object.entries(value)) {
      appendValue(fd, `${key}.${subKey}`, subValue);
    }
  } else {
    fd.append(key, String(value));
  }
}

export function getFormData(data: unknown, fieldName?: string): FormData {
  const fd = new FormData();
  if (data == null) return fd;

  // FileList — 不能使用 for-of 迭代，单独处理
  if (typeof FileList !== 'undefined' && data instanceof FileList) {
    const key = fieldName || 'file';
    for (let i = 0; i < data.length; i++) fd.append(key, data[i]);
    return fd;
  }

  // 顶层普通对象 — 使用对象自身的 key
  if (isPlainObject(data)) {
    for (const [key, value] of Object.entries(data)) {
      appendValue(fd, key, value);
    }
    return fd;
  }

  // 其余所有类型统一走 appendValue
  appendValue(fd, fieldName || 'file', data);
  return fd;
}
