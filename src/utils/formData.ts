/**
 * getFormData — 将任意数据转换为 FormData
 *
 * 转换规则：
 * - File / Blob           → 字段名 'file'（可通过 fieldName 自定义）
 * - FileList              → 遍历，每个文件字段名 'file'
 * - 数组                  → 遍历每一项，File/Blob 用 fieldName，其他值转字符串
 * - 普通对象              → 遍历 entries，key 作为字段名；嵌套对象用 . 连接
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
    fd.append(key, value);  // non-File Blob (File already matched above)
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

  // 单个 FileLike
  if (data instanceof Blob) {
    fd.append(fieldName || 'file', data, data instanceof File ? data.name : undefined);
    return fd;
  }

  // FileList
  if (typeof FileList !== 'undefined' && data instanceof FileList) {
    for (let i = 0; i < data.length; i++) {
      fd.append(fieldName || 'file', data[i]);
    }
    return fd;
  }

  // 数组
  if (Array.isArray(data)) {
    for (const item of data) {
      appendValue(fd, fieldName || 'file', item);
    }
    return fd;
  }

  // 普通对象
  if (isPlainObject(data)) {
    for (const [key, value] of Object.entries(data)) {
      appendValue(fd, key, value);
    }
    return fd;
  }

  // 基础值
  fd.append(fieldName || 'file', String(data));
  return fd;
}
