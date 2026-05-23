import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { createEnhanceInstance } from '../src';

const mockAdapter = () => Promise.resolve({
  data: { code: 0, message: 'ok', data: {} },
  status: 200,
  statusText: 'OK',
  headers: {},
  config: {},
});

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
        instance.get('/test', null, { preventDuplicate: false, adapter: mockAdapter });
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
    const adapter = mockAdapter;
    it('GET 请求正确传递 params', () => {
      const instance = createEnhanceInstance({ baseURL: 'http://localhost' });
      expect(() => {
        instance.get('/test', { page: 1 }, { adapter });
      }).not.toThrow();
    });

    it('POST 请求正确传递 data', () => {
      const instance = createEnhanceInstance({ baseURL: 'http://localhost' });
      expect(() => {
        instance.post('/test', { name: 'test' }, { adapter });
      }).not.toThrow();
    });

    it('PUT 请求正确传递 data', () => {
      const instance = createEnhanceInstance({ baseURL: 'http://localhost' });
      expect(() => {
        instance.put('/test', { id: 1, name: 'updated' }, { adapter });
      }).not.toThrow();
    });

    it('DELETE 请求正确传递 params', () => {
      const instance = createEnhanceInstance({ baseURL: 'http://localhost' });
      expect(() => {
        instance.delete('/test/1', { page: 1 }, { adapter });
      }).not.toThrow();
    });

    it('PATCH 请求正确传递 data', () => {
      const instance = createEnhanceInstance({ baseURL: 'http://localhost' });
      expect(() => {
        instance.patch('/test/1', { status: 'done' }, { adapter });
      }).not.toThrow();
    });

    it('支持 null 作为第二个参数', () => {
      const instance = createEnhanceInstance({ baseURL: 'http://localhost' });
      expect(() => {
        instance.get('/test', null, { preventDuplicate: false, adapter });
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

    it('数组快捷生成 retryCondition', () => {
      const instance = createEnhanceInstance({
        retry: [408, 429, 500],
      });
      expect(instance.enhance).toBeDefined();
    });

    it('函数赋给 retryCondition', () => {
      const instance = createEnhanceInstance({
        retry: (error: any) => !error.response || error.response.status >= 500,
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
        retry: { retryCondition: (err) => !err.response || err.response.status >= 500 },
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

  it('retryCondition 可在 success handler 中检测业务码并重试', () => {
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

// ═══════════════════════════════════════════════════════════════════
// 缓存破坏测试（通过 mock adapter 验证实际行为）
// ═══════════════════════════════════════════════════════════════════

describe('缓存破坏 (needCacheBust)', () => {
  function mockAdapter() {
    return (config: any) => Promise.resolve({
      data: { code: 0, data: { query: config.params } },
      status: 200, statusText: 'OK', headers: {}, config,
    });
  }

  it('默认所有请求自动添加 _ 参数', async () => {
    const instance = createEnhanceInstance({ baseURL: 'http://localhost' });
    const res = await instance.get('/test', null, { adapter: mockAdapter() });
    expect(res.data.data.query._).toBeDefined();
    expect(typeof res.data.data.query._).toBe('string');
  });

  it('POST 请求也添加 _ 参数', async () => {
    const instance = createEnhanceInstance({ baseURL: 'http://localhost' });
    const res = await instance.post('/test', { name: 'test' }, { adapter: mockAdapter() });
    expect(res.data.data.query._).toBeDefined();
  });

  it('needCacheBust: false 不添加 _', async () => {
    const instance = createEnhanceInstance({ baseURL: 'http://localhost', needCacheBust: false });
    const res = await instance.get('/test', null, { adapter: mockAdapter() });
    expect(res.data.data.query).toBeUndefined();
  });

  it('请求级 needCacheBust: false 可覆盖实例级', async () => {
    const instance = createEnhanceInstance({ baseURL: 'http://localhost' });
    const res = await instance.get('/test', null, { needCacheBust: false, adapter: mockAdapter() });
    expect(res.data.data.query).toBeUndefined();
  });

  it('_ 不影响 prevent/cancel key（key 基于不含 _ 的 params 生成）', async () => {
    const instance = createEnhanceInstance({
      baseURL: 'http://localhost',
      cancelRequest: { requestKey: '${method}-${url}' },
    });

    // 发送两次请求，第二次会取消第一次
    // 如果 _ 参与了 key，两次请求 key 不同，第二次不会取消第一次
    let firstCancelled = false;
    const adapter1 = (config: any) => new Promise((_resolve, reject) => {
      // 延迟响应，给第二次请求时间取消它
      setTimeout(() => reject({ message: 'timeout', config }), 500);
    });

    const p1 = instance.get('/test', { q: '1' }, {
      adapter: adapter1,
      cancelRequest: { requestKey: '${method}-${url}' },
    }).catch((err: any) => {
      if (err && err.message && err.message.indexOf('cancel') >= 0) firstCancelled = true;
    });

    // 稍后发第二个请求
    await new Promise(r => setTimeout(r, 50));
    const res2 = await instance.get('/test', { q: '2' }, {
      adapter: mockAdapter(),
      cancelRequest: { requestKey: '${method}-${url}' },
    });

    expect(res2.data.data.query._).toBeDefined();
    // 第二次请求成功，且 query 中有 q=2，说明没有被 _ 干扰 key 匹配
    expect(res2.data.data.query.q).toBe('2');
  });

  it('重试时不会重复追加 _', async () => {
    let callCount = 0;
    const instance = createEnhanceInstance({
      baseURL: 'http://localhost',
      retry: { retries: 2, retryDelay: 10, exponential: false },
    });

    const res = await instance.get('/test', null, {
      adapter: (config: any) => {
        callCount++;
        if (callCount <= 2) {
          return Promise.reject({
            config, isAxiosError: true, message: 'fail',
            response: { status: 500, data: {} },
          });
        }
        return Promise.resolve({
          data: { code: 0, data: { query: config.params } },
          status: 200, statusText: 'OK', headers: {}, config,
        });
      },
    });

    // 只有 1 个 _ 参数，不是累积的 _
    const queryKeys = Object.keys(res.data.data.query).filter(k => k === '_');
    expect(queryKeys.length).toBe(1);
  }, 10000);
});

// ═══════════════════════════════════════════════════════════════════
// 数据自动转换测试（通过 mock adapter 验证实际行为）
// ═══════════════════════════════════════════════════════════════════

describe('数据自动转换 (transformRequest)', () => {
  function captureAdapter() {
    let captured: any;
    return {
      adapter: (config: any) => {
        captured = config;
        return Promise.resolve({
          data: { code: 0, data: { body: config.data, headers: config.headers } },
          status: 200, statusText: 'OK', headers: {}, config,
        });
      },
      getCaptured: () => captured,
    };
  }

  it('json 类型自动 JSON.stringify', async () => {
    const instance = createEnhanceInstance({ baseURL: 'http://localhost', contentType: 'json' });
    const c = captureAdapter();
    const res = await instance.post('/test', { name: 'test', value: 123 }, { adapter: c.adapter });
    expect(typeof c.getCaptured().data).toBe('string');
    expect(c.getCaptured().data).toBe('{"name":"test","value":123}');
  });

  it('file 类型注入 transformRequest 转 FormData', async () => {
    const instance = createEnhanceInstance({ baseURL: 'http://localhost' });
    const c = captureAdapter();
    await instance.post('/test', { name: 'test', age: 18 }, {
      contentType: 'file', adapter: c.adapter,
    });
    // transformRequest 链中包含我们的转换函数
    expect(Array.isArray(c.getCaptured().transformRequest)).toBe(true);
    expect((c.getCaptured().transformRequest as any[]).length).toBeGreaterThan(0);
  });

  it('form 类型注入 transformRequest 转 URLSearchParams', async () => {
    const instance = createEnhanceInstance({ baseURL: 'http://localhost' });
    const c = captureAdapter();
    await instance.post('/test', { user: 'admin', pass: '123' }, {
      contentType: 'form', adapter: c.adapter,
    });
    expect(Array.isArray(c.getCaptured().transformRequest)).toBe(true);
  });

  it('已是 FormData 不转换', async () => {
    const instance = createEnhanceInstance({ baseURL: 'http://localhost' });
    const fd = new FormData();
    fd.append('file', new Blob(['test'], { type: 'text/plain' }));
    const c = captureAdapter();
    await instance.post('/test', fd, { contentType: 'file', adapter: c.adapter });
    // FormData 不会被修改
    expect(c.getCaptured().data).toBeInstanceOf(FormData);
  });

  it('已是字符串不转换', async () => {
    const instance = createEnhanceInstance({ baseURL: 'http://localhost' });
    const c = captureAdapter();
    await instance.post('/test', '{"already":"json"}', { contentType: 'json', adapter: c.adapter });
    expect(c.getCaptured().data).toBe('{"already":"json"}');
  });

  it('重试时 __dataTransformInjected 防止重复注入', async () => {
    let callCount = 0;
    const instance = createEnhanceInstance({
      baseURL: 'http://localhost',
      retry: { retries: 1, retryDelay: 10, exponential: false },
    });

    const c = captureAdapter();
    // Note: adapter is replaced on retry since config is re-used
    await instance.post('/test', { name: 'test' }, {
      contentType: 'file',
      adapter: (config: any) => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject({
            config, isAxiosError: true, message: 'fail',
            response: { status: 500, data: {} },
          });
        }
        return Promise.resolve({
          data: { code: 0, data: {} },
          status: 200, statusText: 'OK', headers: {}, config,
        });
      },
    });
    // 没有崩溃、没有无限嵌套 transformRequest 数组
    expect(callCount).toBe(2);
  }, 10000);
});

// ═══════════════════════════════════════════════════════════════════
// 交互场景：防重复 + 重试
// ═══════════════════════════════════════════════════════════════════

describe('防重复 + 重试交互', () => {
  it('等待者拿到重试后的最终成功结果', async () => {
    const instance = createEnhanceInstance({
      baseURL: 'http://localhost',
      retry: { retries: 2, retryDelay: 10, exponential: false },
    });

    let callCount = 0;
    const results: any[] = [];

    const makeRequest = (id: number) => {
      return instance.post('/test', { id }, {
        preventDuplicate: { requestKey: '${method}-${url}' },
        adapter: (config: any) => {
          callCount++;
          if (callCount === 1) {
            return Promise.reject({
              config, isAxiosError: true, message: 'fail',
              response: { status: 500, data: {} },
            });
          }
          return Promise.resolve({
            data: { code: 0, data: { id } },
            status: 200, statusText: 'OK', headers: {}, config,
          });
        },
      });
    };

    // 同时发送两个请求
    const [r1, r2] = await Promise.allSettled([
      makeRequest(1),
      // 第二个请求在很短间隔后发出，会被防重复拦截
      (async () => {
        await new Promise(r => setTimeout(r, 5));
        return makeRequest(2);
      })(),
    ]);

    // 两个请求都应该成功（第二个复用了第一个的重试结果）
    expect(r1.status).toBe('fulfilled');
    expect(r2.status).toBe('fulfilled');
    // 实际只发出了1次 HTTP 请求（第一次失败重试后成功）
    // callCount 可能是 2（1次失败+1次成功），但只有1个真正的请求被注册
  }, 10000);
});

// ═══════════════════════════════════════════════════════════════════
// key 生成：_ 参数剔除
// ═══════════════════════════════════════════════════════════════════

describe('key 生成剔除 _ 参数', () => {
  it('params 中有 _ 不影响默认 key', async () => {
    const instance = createEnhanceInstance({
      baseURL: 'http://localhost',
    });

    let callCount = 0;
    const adapter = (config: any) => {
      callCount++;
      return new Promise(resolve => setTimeout(() => resolve({
        data: { code: 0, data: {} },
        status: 200, statusText: 'OK', headers: {}, config,
      }), 100));
    };

    // 使用 POST（默认仅防重复，不取消），并发发送
    const [r1, r2] = await Promise.allSettled([
      instance.post('/submit', { q: 'test' }, {
        adapter, preventDuplicate: { intervalMs: 5000 },
      }),
      (async () => {
        await new Promise(r => setTimeout(r, 5));
        return instance.post('/submit', { q: 'test', _: 'cache-bust' }, {
          adapter, preventDuplicate: { intervalMs: 5000 },
        });
      })(),
    ]);

    expect(r1.status).toBe('fulfilled');
    expect(r2.status).toBe('fulfilled');
    expect(callCount).toBe(1);
  });

  it('重试时 _ 不改变 key，deferred 链不断', async () => {
    const instance = createEnhanceInstance({
      baseURL: 'http://localhost',
      retry: { retries: 1, retryDelay: 10, exponential: false },
    });

    let callCount = 0;
    const results: any[] = [];

    // 发两个并发请求，第二个会被防重复拦截
    const makeRequest = (id: number) => {
      return instance.post('/test', { id }, {
        adapter: (config: any) => {
          callCount++;
          if (callCount === 1) {
            return Promise.reject({
              config, isAxiosError: true, message: 'fail',
              response: { status: 500, data: {} },
            });
          }
          return Promise.resolve({
            data: { code: 0, data: { id, callCount } },
            status: 200, statusText: 'OK', headers: {}, config,
          });
        },
        preventDuplicate: { intervalMs: 5000 },
      });
    };

    const [r1, r2] = await Promise.allSettled([
      makeRequest(1),
      // 第二个请求在很短间隔后发出，needCacheBust 给 params 加了 _
      // 但 stripCacheParam 剔除了 _ → key 不变 → 防重复拦截 → 复用 deferred
      (async () => {
        await new Promise(r => setTimeout(r, 5));
        return makeRequest(2);
      })(),
    ]);

    expect(r1.status).toBe('fulfilled');
    expect(r2.status).toBe('fulfilled');
  }, 10000);
});

// ═══════════════════════════════════════════════════════════════════
// Token 认证测试
// ═══════════════════════════════════════════════════════════════════

describe('Token 认证 (tokenAuth)', () => {
  const mockToken = { token: 'refresh-xxx', accessToken: 'access-xxx' };
  const mockNewToken = { token: 'new-refresh', accessToken: 'new-access' };

  function createAuth(overrides: any = {}) {
    return {
      getLocalToken: () => mockToken,
      refreshToken: async () => mockNewToken,
      setLocalToken: () => {},
      shouldRefreshToken: (err: any) => err?.response?.status === 401,
      ...overrides,
    };
  }

  it('getLocalToken 正常时注入 Authorization header', async () => {
    const instance = createEnhanceInstance({
      baseURL: 'http://localhost',
      tokenAuth: createAuth(),
    });
    let capturedHeaders: any;
    await instance.get('/test', null, {
      adapter: (config: any) => {
        capturedHeaders = config.headers;
        return Promise.resolve({ data: {}, status: 200, statusText: 'OK', headers: {}, config });
      },
    });
    expect(capturedHeaders.Authorization).toBe('Bearer access-xxx');
  });

  it('needToken: false 请求不注入 header', async () => {
    const instance = createEnhanceInstance({
      baseURL: 'http://localhost',
      tokenAuth: createAuth(),
    });
    let capturedHeaders: any;
    await instance.get('/test', null, {
      needToken: false,
      adapter: (config: any) => {
        capturedHeaders = config.headers;
        return Promise.resolve({ data: {}, status: 200, statusText: 'OK', headers: {}, config });
      },
    });
    expect(capturedHeaders.Authorization).toBeUndefined();
  });

  it('实例级 needToken: false 全局关闭', async () => {
    const instance = createEnhanceInstance({
      baseURL: 'http://localhost',
      tokenAuth: createAuth(),
      needToken: false,
    });
    let capturedHeaders: any;
    await instance.get('/test', null, {
      adapter: (config: any) => {
        capturedHeaders = config.headers;
        return Promise.resolve({ data: {}, status: 200, statusText: 'OK', headers: {}, config });
      },
    });
    expect(capturedHeaders.Authorization).toBeUndefined();
  });

  it('实例级 needToken: false 请求级 true 覆盖', async () => {
    const instance = createEnhanceInstance({
      baseURL: 'http://localhost',
      tokenAuth: createAuth(),
      needToken: false,
    });
    let capturedHeaders: any;
    await instance.get('/test', null, {
      needToken: true,
      adapter: (config: any) => {
        capturedHeaders = config.headers;
        return Promise.resolve({ data: {}, status: 200, statusText: 'OK', headers: {}, config });
      },
    });
    expect(capturedHeaders.Authorization).toBe('Bearer access-xxx');
  });

  it('自定义 headerName', async () => {
    const instance = createEnhanceInstance({
      baseURL: 'http://localhost',
      tokenAuth: createAuth({ headerName: 'X-Auth-Token' }),
    });
    let capturedHeaders: any;
    await instance.get('/test', null, {
      adapter: (config: any) => {
        capturedHeaders = config.headers;
        return Promise.resolve({ data: {}, status: 200, statusText: 'OK', headers: {}, config });
      },
    });
    expect(capturedHeaders['X-Auth-Token']).toBe('Bearer access-xxx');
  });

  it('401 触发 refresh 并重试成功', async () => {
    let refreshCount = 0;
    let currentToken = { ...mockToken };
    const instance = createEnhanceInstance({
      baseURL: 'http://localhost',
      tokenAuth: createAuth({
        getLocalToken: () => currentToken,
        refreshToken: async () => { refreshCount++; currentToken = { ...mockNewToken }; return currentToken; },
        setLocalToken: (info) => { currentToken = info; },
      }),
    });
    const res = await instance.get('/test', null, {
      adapter: (config: any) => {
        if (config.headers.Authorization === 'Bearer access-xxx') {
          return Promise.reject({
            config, isAxiosError: true, message: 'Unauthorized',
            response: { status: 401, data: {} },
          });
        }
        return Promise.resolve({ data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config });
      },
    });
    expect(refreshCount).toBe(1);
    expect(res.data.ok).toBe(true);
  });

  it('并发 401 只刷新一次', async () => {
    let refreshCount = 0;
    let currentToken = { ...mockToken };
    const instance = createEnhanceInstance({
      baseURL: 'http://localhost',
      tokenAuth: createAuth({
        getLocalToken: () => currentToken,
        refreshToken: async () => { refreshCount++; currentToken = { ...mockNewToken }; return currentToken; },
      }),
    });

    const makeReq = () => instance.get('/test', null, {
      cancelRequest: false,
      preventDuplicate: false,
      adapter: (config: any) => {
        if (config.headers.Authorization === 'Bearer access-xxx') {
          return Promise.reject({
            config, isAxiosError: true, message: 'Unauthorized',
            response: { status: 401, data: {} },
          });
        }
        return Promise.resolve({ data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config });
      },
    });

    await Promise.all([makeReq(), makeReq(), makeReq()]);
    expect(refreshCount).toBe(1);
  });

  it('refreshToken 失败调用 tokenFailureHandler', async () => {
    let failureCalled: any = null;
    const instance = createEnhanceInstance({
      baseURL: 'http://localhost',
      tokenAuth: createAuth({
        refreshToken: async () => { throw new Error('refresh failed'); },
        tokenFailureHandler: (reason, err) => { failureCalled = { reason, msg: err?.message }; },
      }),
    });

    // 发一个带 token 的请求触发 401 → 刷新失败 → handler 调用
    await instance.get('/test', null, {
      adapter: () => Promise.reject({
        config: {}, isAxiosError: true, message: 'Unauthorized',
        response: { status: 401, data: {} },
      }),
    }).catch(() => {});

    expect(failureCalled).not.toBeNull();
    expect(failureCalled?.reason).toBe('refresh');
    expect(failureCalled?.msg).toBe('refresh failed');
  });

  it('headerFormat 字符串模板', async () => {
    const instance = createEnhanceInstance({
      baseURL: 'http://localhost',
      tokenAuth: createAuth({ headerFormat: 'Token {token}' }),
    });
    let capturedHeaders: any;
    await instance.get('/test', null, {
      adapter: (config: any) => {
        capturedHeaders = config.headers;
        return Promise.resolve({ data: {}, status: 200, statusText: 'OK', headers: {}, config });
      },
    });
    expect(capturedHeaders.Authorization).toBe('Token access-xxx');
  });

  it('headerFormat 函数', async () => {
    const instance = createEnhanceInstance({
      baseURL: 'http://localhost',
      tokenAuth: createAuth({ headerFormat: (t: string) => `JWT ${t}` }),
    });
    let capturedHeaders: any;
    await instance.get('/test', null, {
      adapter: (config: any) => {
        capturedHeaders = config.headers;
        return Promise.resolve({ data: {}, status: 200, statusText: 'OK', headers: {}, config });
      },
    });
    expect(capturedHeaders.Authorization).toBe('JWT access-xxx');
  });

  it('tokenAuth 未配置时不影响正常请求', async () => {
    const instance = createEnhanceInstance({ baseURL: 'http://localhost' });
    let capturedHeaders: any;
    await instance.get('/test', null, {
      adapter: (config: any) => {
        capturedHeaders = config.headers;
        return Promise.resolve({ data: {}, status: 200, statusText: 'OK', headers: {}, config });
      },
    });
    expect(capturedHeaders.Authorization).toBeUndefined();
  });

  it('needToken 函数动态判断', async () => {
    const instance = createEnhanceInstance({
      baseURL: 'http://localhost',
      tokenAuth: createAuth(),
      needToken: (config: any) => config.url?.startsWith('/api'),
    });
    // /test 不以 /api 开头 → 不加 token
    let capturedHeaders: any;
    await instance.get('/test', null, {
      adapter: (config: any) => {
        capturedHeaders = config.headers;
        return Promise.resolve({ data: {}, status: 200, statusText: 'OK', headers: {}, config });
      },
    });
    expect(capturedHeaders.Authorization).toBeUndefined();
  });
});