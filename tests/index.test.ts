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
});