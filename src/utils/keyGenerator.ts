import type { AxiosRequestConfig } from 'axios';

/**
 * 获取嵌套属性的值
 */
export function getNestedValue(obj: any, path: string): any {
  if (!path) return obj;
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

/**
 * 解析字符串模板
 * 支持 ${xxx} 或 ${xxx.yyy} 占位符
 */
export function resolveTemplate(template: string, config: AxiosRequestConfig): string {
  const context = {
    method: config.method?.toUpperCase() || 'GET',
    url: config.url || '',
    params: config.params,
    data: config.data,
  };

  return template.replace(/\$\{([^}]+)\}/g, (match, path) => {
    const value = getNestedValue(context, path);
    if (value == null) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  });
}

/**
 * 生成默认的 requestKey
 */
export function generateDefaultKey(config: AxiosRequestConfig): string {
  const parts = [
    config.method?.toUpperCase() || 'GET',
    config.url || '',
    config.params != null ? JSON.stringify(sortObject(config.params)) : '',
    config.data != null ? JSON.stringify(sortObject(config.data)) : '',
  ];
  return hash(parts.join('|'));
}

/**
 * 字符串哈希（简易实现，兼容浏览器）
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
 * 对对象键进行排序（保证相同数据产生相同哈希）
 */
function sortObject(obj: any): any {
  if (obj == null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sortObject);
  const sorted: Record<string, any> = {};
  const keys = Object.keys(obj).sort();
  for (const key of keys) {
    sorted[key] = sortObject(obj[key]);
  }
  return sorted;
}

/**
 * 解析 requestKey
 * 支持字符串模板和直接字符串
 */
export function resolveRequestKey(config: AxiosRequestConfig, keyTemplate?: string): string {
  if (!keyTemplate) {
    return generateDefaultKey(config);
  }
  // 如果包含 ${ 则作为模板解析
  if (keyTemplate.includes('${')) {
    return resolveTemplate(keyTemplate, config);
  }
  // 直接返回字符串
  return keyTemplate;
}