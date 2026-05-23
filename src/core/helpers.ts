/**
 * 内部辅助函数
 */

/** 检查 HTTP 方法是否在允许列表中 */
export function shouldApply(method?: string, methods?: string[] | null): boolean {
  if (methods == null) return true;
  if (methods.length === 0) return false;
  return methods.includes(method?.toUpperCase() || 'GET');
}

/** 判断配置值是否已设置（非 null/undefined） */
export function isConfigSet(config: any): boolean {
  return config != null;
}
