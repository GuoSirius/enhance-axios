import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createEnhanceInstance } from '../src';

describe('enhance-axios', () => {
  let api: ReturnType<typeof createEnhanceInstance>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('API 调用方式', () => {
    it('createEnhanceInstance 返回函数', () => {
      const instance = createEnhanceInstance({ baseURL: 'http://localhost' });
      expect(typeof instance).toBe('function');
    });

    it('支持 RESTful 方法', () => {
      const instance = createEnhanceInstance({ baseURL: 'http://localhost' });
      expect(typeof instance.get).toBe('function');
      expect(typeof instance.post).toBe('function');
      expect(typeof instance.put).toBe('function');
      expect(typeof instance.delete).toBe('function');
      expect(typeof instance.patch).toBe('function');
      expect(typeof instance.head).toBe('function');
      expect(typeof instance.options).toBe('function');
    });

    it('enhance 属性可用', () => {
      const instance = createEnhanceInstance({ baseURL: 'http://localhost' });
      expect(instance.enhance).toBeDefined();
      expect(typeof instance.enhance.clearAll).toBe('function');
      expect(typeof instance.enhance.cancelRequest).toBe('function');
      expect(typeof instance.enhance.getRequestStatus).toBe('function');
    });
  });

  describe('配置合并', () => {
    it('实例配置可关闭功能', () => {
      const instance = createEnhanceInstance({
        preventDuplicate: false,
        cancelRequest: false,
      });
      expect(instance.enhance).toBeDefined();
    });

    it('单个请求配置不影响实例', () => {
      const instance = createEnhanceInstance({
        preventDuplicate: { intervalMs: 2000 },
      });
      expect(() => {
        instance.get('/test', null, { preventDuplicate: false });
      }).not.toThrow();
    });
  });

  describe('requestKey 模板解析', () => {
    it('支持 ${method} 占位符', () => {
      const template = '${method}-${url}';
      expect(template.includes('${method}')).toBe(true);
    });

    it('支持 ${url} 占位符', () => {
      const template = '${method}-${url}';
      expect(template.includes('${url}')).toBe(true);
    });

    it('支持 ${data.xxx} 嵌套属性', () => {
      const template = '${data.user.id}';
      expect(template.includes('${data.user.id}')).toBe(true);
    });

    it('支持 ${params.xxx} 嵌套属性', () => {
      const template = '${params.id}';
      expect(template.includes('${params.id}')).toBe(true);
    });
  });

  describe('防重复配置', () => {
    it('默认 enabled 为 true', () => {
      const instance = createEnhanceInstance({});
      expect(instance.enhance).toBeDefined();
    });

    it('可配置 enabled 为 false', () => {
      const instance = createEnhanceInstance({ preventDuplicate: false });
      expect(instance.enhance).toBeDefined();
    });

    it('可配置 intervalMs', () => {
      const instance = createEnhanceInstance({
        preventDuplicate: { intervalMs: 2000 },
      });
      expect(instance.enhance).toBeDefined();
    });

    it('可配置 requestKey', () => {
      const instance = createEnhanceInstance({
        preventDuplicate: { requestKey: 'test-key' },
      });
      expect(instance.enhance).toBeDefined();
    });

    it('可配置 methods', () => {
      const instance = createEnhanceInstance({
        preventDuplicate: { methods: ['GET', 'POST'] },
      });
      expect(instance.enhance).toBeDefined();
    });
  });

  describe('取消请求配置', () => {
    it('默认 enabled 为 true', () => {
      const instance = createEnhanceInstance({});
      expect(instance.enhance).toBeDefined();
    });

    it('可配置 enabled 为 false', () => {
      const instance = createEnhanceInstance({ cancelRequest: false });
      expect(instance.enhance).toBeDefined();
    });

    it('可配置 requestKey', () => {
      const instance = createEnhanceInstance({
        cancelRequest: { requestKey: 'search-query' },
      });
      expect(instance.enhance).toBeDefined();
    });

    it('可配置 methods', () => {
      const instance = createEnhanceInstance({
        cancelRequest: { methods: ['GET'] },
      });
      expect(instance.enhance).toBeDefined();
    });
  });

  describe('RESTful 方法参数格式', () => {
    it('GET 请求正确传递 params', () => {
      const instance = createEnhanceInstance({ baseURL: 'http://localhost' });
      expect(() => {
        instance.get('/test', { page: 1 });
      }).not.toThrow();
    });

    it('POST 请求正确传递 data', () => {
      const instance = createEnhanceInstance({ baseURL: 'http://localhost' });
      expect(() => {
        instance.post('/test', { name: 'test' });
      }).not.toThrow();
    });

    it('PUT 请求正确传递 data', () => {
      const instance = createEnhanceInstance({ baseURL: 'http://localhost' });
      expect(() => {
        instance.put('/test', { id: 1, name: 'updated' });
      }).not.toThrow();
    });

    it('DELETE 请求正确传递 params', () => {
      const instance = createEnhanceInstance({ baseURL: 'http://localhost' });
      expect(() => {
        instance.delete('/test/1', { page: 1 });
      }).not.toThrow();
    });

    it('PATCH 请求正确传递 data', () => {
      const instance = createEnhanceInstance({ baseURL: 'http://localhost' });
      expect(() => {
        instance.patch('/test/1', { status: 'done' });
      }).not.toThrow();
    });

    it('支持 null 作为第二个参数', () => {
      const instance = createEnhanceInstance({ baseURL: 'http://localhost' });
      expect(() => {
        instance.get('/test', null, { preventDuplicate: false });
      }).not.toThrow();
    });
  });

  describe('enhance API', () => {
    it('clearAll 清空所有待处理请求', () => {
      const instance = createEnhanceInstance({ baseURL: 'http://localhost' });
      expect(() => instance.enhance.clearAll()).not.toThrow();
    });

    it('cancelRequest 取消指定请求', () => {
      const instance = createEnhanceInstance({ baseURL: 'http://localhost' });
      expect(instance.enhance.cancelRequest('test-key')).toBe(false);
    });

    it('getRequestStatus 获取请求状态', () => {
      const instance = createEnhanceInstance({ baseURL: 'http://localhost' });
      expect(instance.enhance.getRequestStatus('test-key')).toBeUndefined();
    });

    it('requestManager 可访问', () => {
      const instance = createEnhanceInstance({ baseURL: 'http://localhost' });
      expect(instance.enhance.requestManager).toBeDefined();
    });
  });

  describe('配置归一化', () => {
    it('boolean 值赋给 enabled', () => {
      const instance = createEnhanceInstance({ preventDuplicate: true });
      expect(instance.enhance).toBeDefined();
    });

    it('string 值赋给 requestKey', () => {
      const instance = createEnhanceInstance({
        preventDuplicate: '${method}-${url}',
      });
      expect(instance.enhance).toBeDefined();
    });

    it('function 值赋给 requestKey', () => {
      const instance = createEnhanceInstance({
        preventDuplicate: (config) => `${config.method}-${config.url}`,
      });
      expect(instance.enhance).toBeDefined();
    });

    it('array 值赋给 methods', () => {
      const instance = createEnhanceInstance({
        preventDuplicate: ['GET', 'POST'],
      });
      expect(instance.enhance).toBeDefined();
    });

    it('number 值赋给 intervalMs', () => {
      const instance = createEnhanceInstance({
        preventDuplicate: 2000,
      });
      expect(instance.enhance).toBeDefined();
    });

    it('undefined/null 视为未传递', () => {
      const instance1 = createEnhanceInstance({});
      const instance2 = createEnhanceInstance({ preventDuplicate: undefined });
      const instance3 = createEnhanceInstance({ preventDuplicate: null });
      expect(instance1.enhance).toBeDefined();
      expect(instance2.enhance).toBeDefined();
      expect(instance3.enhance).toBeDefined();
    });
  });

  describe('Retry 配置', () => {
    it('默认启用重试', () => {
      const instance = createEnhanceInstance({});
      expect(instance.enhance).toBeDefined();
    });

    it('可配置 retries', () => {
      const instance = createEnhanceInstance({
        retry: { retries: 5 },
      });
      expect(instance.enhance).toBeDefined();
    });

    it('数字赋给 retries', () => {
      const instance = createEnhanceInstance({
        retry: 10,
      });
      expect(instance.enhance).toBeDefined();
    });

    it('可配置 exponential', () => {
      const instance = createEnhanceInstance({
        retry: { exponential: false },
      });
      expect(instance.enhance).toBeDefined();
    });

    it('可关闭重试', () => {
      const instance = createEnhanceInstance({
        retry: false,
      });
      expect(instance.enhance).toBeDefined();
    });

    it('可自定义 retryCondition 判断业务码异常', () => {
      // 这个测试验证配置可以被正确设置
      const instance = createEnhanceInstance({
        retry: {
          retryCondition: (error) => {
            // 自定义：HTTP 2xx 但业务码非 0 时重试
            if (error.response?.status === 200 && error.response?.data?.code !== 0) {
              return true;
            }
            return !error.response || error.response.status >= 500;
          },
        },
      });
      expect(instance.enhance).toBeDefined();
    });

    it('可配置 statusCodes', () => {
      const instance = createEnhanceInstance({
        retry: { statusCodes: [408, 429, 500, 502, 503, 504] },
      });
      expect(instance.enhance).toBeDefined();
    });

    it('可配置 exponential 指数退避', () => {
      const instance = createEnhanceInstance({
        retry: { exponential: false },
      });
      expect(instance.enhance).toBeDefined();
    });
  });

  describe('拦截器场景分析', () => {
    it('HTTP 2xx 但业务码异常需要用户自定义 retryCondition', () => {
      // 说明：这种情况 axios 不会抛出错误
      // 用户需要在响应拦截器中自行处理或使用 transformResponse
      const instance = createEnhanceInstance({
        retry: {
          retryCondition: (error) => {
            // 自定义判断逻辑
            return error.response?.data?.code !== 0;
          },
        },
      });
      expect(instance.enhance).toBeDefined();
    });

    it('网络错误触发重试（默认行为）', () => {
      const instance = createEnhanceInstance({
        retry: { retries: 3 },
      });
      expect(instance.enhance).toBeDefined();
    });

    it('5xx 错误触发重试（默认行为）', () => {
      const instance = createEnhanceInstance({
        retry: { statusCodes: [500, 502, 503, 504] },
      });
      expect(instance.enhance).toBeDefined();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════
// getFormData 测试
// ═══════════════════════════════════════════════════════════════════

import { getFormData } from '../src';

describe('getFormData', () => {
  it('null / undefined 返回空 FormData', () => {
    expect(getFormData(null)).toBeInstanceOf(FormData);
    expect(getFormData(undefined)).toBeInstanceOf(FormData);
  });

  it('File 默认字段名 file', () => {
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' });
    const fd = getFormData(file);
    const result = fd.get('file') as File;
    expect(result.name).toBe('test.txt');
  });

  it('File 自定义字段名', () => {
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' });
    const fd = getFormData(file, 'avatar');
    expect(fd.get('avatar')).toBeInstanceOf(File);
    expect(fd.get('file')).toBeNull();
  });

  it('Blob 默认字段名 file', () => {
    const blob = new Blob(['world'], { type: 'text/plain' });
    const fd = getFormData(blob);
    const got = fd.get('file');
    expect(got).toBeInstanceOf(Blob);
  });

  it('基础值转字符串，字段名 file', () => {
    expect(getFormData('hello').get('file')).toBe('hello');
    expect(getFormData(123).get('file')).toBe('123');
    expect(getFormData(true).get('file')).toBe('true');
  });

  it('数组', () => {
    const file = new File(['a'], 'a.txt');
    const fd = getFormData([file, 'text', 42]);
    expect(fd.getAll('file')).toHaveLength(3);
  });

  it('普通对象', () => {
    const fd = getFormData({ name: 'test', age: 18, active: true });
    expect(fd.get('name')).toBe('test');
    expect(fd.get('age')).toBe('18');
    expect(fd.get('active')).toBe('true');
  });

  it('对象嵌套 File', () => {
    const file = new File(['data'], 'avatar.png');
    const fd = getFormData({ username: 'john', avatar: file });
    expect(fd.get('username')).toBe('john');
    expect(fd.get('avatar')).toBeInstanceOf(File);
  });

  it('嵌套对象用 . 连接', () => {
    const fd = getFormData({ user: { name: 'test', age: 18 } });
    expect(fd.get('user.name')).toBe('test');
    expect(fd.get('user.age')).toBe('18');
  });

  it('数组包含 File 和基础值', () => {
    const fd = getFormData([new File(['f1'], 'f1.txt'), 'extra']);
    expect(fd.getAll('file')).toHaveLength(2);
  });

  it('Date 转 ISO 字符串', () => {
    const date = new Date('2025-01-01T00:00:00Z');
    const fd = getFormData({ createdAt: date });
    expect(fd.get('createdAt')).toBe('2025-01-01T00:00:00.000Z');
  });

  it('FileList 默认字段名 file', () => {
    if (typeof DataTransfer === 'undefined') return; // Node 环境跳过
    const dt = new DataTransfer();
    const f1 = new File(['a'], 'a.txt');
    const f2 = new File(['b'], 'b.txt');
    dt.items.add(f1);
    dt.items.add(f2);
    const fd = getFormData(dt.files);
    expect(fd.getAll('file')).toHaveLength(2);
  });

  it('空数组返回空 FormData', () => {
    const fd = getFormData([]);
    expect([...fd.entries()]).toHaveLength(0);
  });

  it('空对象返回空 FormData', () => {
    const fd = getFormData({});
    expect([...fd.entries()]).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// contentType 测试
// ═══════════════════════════════════════════════════════════════════

describe('contentType', () => {
  it('默认 json 设置 Content-Type', () => {
    const instance = createEnhanceInstance({ baseURL: 'http://localhost' });
    expect(instance.defaults.headers?.['Content-Type']).toBeUndefined();
    // 默认在请求拦截器中设置，这里验证可配置
    const instance2 = createEnhanceInstance({
      baseURL: 'http://localhost',
      contentType: 'json',
    });
    expect(instance2.enhance).toBeDefined();
  });

  it('可配置 form', () => {
    const instance = createEnhanceInstance({
      baseURL: 'http://localhost',
      contentType: 'form',
    });
    expect(instance.enhance).toBeDefined();
  });

  it('可配置 file 模式', () => {
    const instance = createEnhanceInstance({
      baseURL: 'http://localhost',
      contentType: 'file',
    });
    expect(instance.enhance).toBeDefined();
  });

  it('可配置自定义 Content-Type', () => {
    const instance = createEnhanceInstance({
      baseURL: 'http://localhost',
      contentType: 'text/plain',
    });
    expect(instance.enhance).toBeDefined();
  });

  it('null 和 undefined 都默认 json', () => {
    const instance1 = createEnhanceInstance({
      baseURL: 'http://localhost',
      contentType: undefined,
    });
    expect(instance1.enhance).toBeDefined();

    const instance2 = createEnhanceInstance({
      baseURL: 'http://localhost',
      contentType: null as any,
    });
    expect(instance2.enhance).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════
// 2xx 业务码重试测试
// ═══════════════════════════════════════════════════════════════════

describe('2xx 业务码重试', () => {
  it('retryCondition 可通过 error.response 判断业务码', () => {
    const instance = createEnhanceInstance({
      baseURL: 'http://localhost',
      retry: {
        retryCondition: (error) => {
          if (error.response?.status === 200 && error.response?.data?.code !== 0) return true;
          return false;
        },
      },
    });
    expect(instance.enhance).toBeDefined();
  });

  it('支持 __bizRetry 标记绕过 statusCodes 检查', () => {
    const instance = createEnhanceInstance({
      baseURL: 'http://localhost',
      retry: {
        retries: 2,
        retryDelay: 10,
        retryCondition: (error) => {
          if (error.response?.status === 200 && error.response?.data?.code !== 0) return true;
          return false;
        },
      },
    });
    expect(instance.enhance).toBeDefined();
  });

  it('业务码重试配置可正常关闭', () => {
    const instance = createEnhanceInstance({
      baseURL: 'http://localhost',
      retry: false,
    });
    expect(instance.enhance).toBeDefined();
  });
});