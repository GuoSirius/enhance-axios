# enhance-axios

一个强大的 axios 增强库，支持防重复提交和取消请求功能。

## 特性

- **防重复提交**：快速多次点击时保持第一次请求，忽略后续重复请求
- **取消请求**：搜索类场景，多次发送时自动取消旧请求，保留最新请求
- **配置灵活**：支持实例级别和请求级别的配置
- **requestKey 模板**：支持 `${method}`、`${url}`、`${data.xxx}` 等占位符
- **类型安全**：完整的 TypeScript 支持
- **多格式构建**：支持 ESM、CJS、IIFE 格式

## 安装

```bash
npm install enhance-axios
```

```bash
yarn add enhance-axios
```

```bash
pnpm add enhance-axios
```

## 快速开始

```typescript
import { createEnhanceInstance } from 'enhance-axios';

const api = createEnhanceInstance({ baseURL: '/api' });

// 防重复提交（保持第一次请求）
api.post('/submit', { name: 'test' }, {
  preventDuplicate: { requestKey: 'submit-form' }
});

// 搜索取消（取消旧请求，保留最新）
api.get('/search', { q: 'keyword' }, {
  cancelRequest: { requestKey: 'search-query' }
});
```

## API 使用

### createEnhanceInstance

创建一个增强的 axios 实例。

```typescript
import { createEnhanceInstance } from 'enhance-axios';

const api = createEnhanceInstance({
  baseURL: '/api',
  timeout: 10000,
  // 实例级别配置（默认开启）
  preventDuplicate: true,
  cancelRequest: true,
});
```

### 调用方式

两种调用方式，参数格式统一：

```typescript
// 方式1：api(config)
api({
  url: '/submit',
  method: 'POST',
  data: { name: 'test' },
  preventDuplicate: { requestKey: 'submit-form' },
  cancelRequest: false
});

// 方式2：RESTful 方法
// GET/DELETE/HEAD/OPTIONS: api.method(url, params?, config?)
api.get('/search', { q: 'keyword', page: 1 }, { cancelRequest: true });

// POST/PUT/PATCH: api.method(url, data?, config?)
api.post('/submit', { name: 'test' }, { preventDuplicate: true });
api.put('/update', { id: 1, name: 'new' }, { preventDuplicate: false });
api.delete('/user/123', { force: true }, { cancelRequest: true });
```

## 配置项

### 防重复提交 (preventDuplicate)

```typescript
{
  enabled?: boolean;      // 默认 true
  requestKey?: string;     // 字符串模板，支持 ${method}、${url}、${data.xxx} 等
  methods?: string[];      // 生效的请求方法，默认全部
  intervalMs?: number;    // 重复判定间隔(ms)，默认 1000
}

// 示例
api.post('/submit', data, {
  preventDuplicate: {
    enabled: true,
    requestKey: '${method}-${url}-${data.userId}',  // 使用模板
    methods: ['POST', 'PUT'],
    intervalMs: 2000
  }
});

// 简写
api.post('/submit', data, { preventDuplicate: true });
api.post('/submit', data, { preventDuplicate: false });  // 关闭
```

### 取消请求 (cancelRequest)

```typescript
{
  enabled?: boolean;      // 默认 true
  requestKey?: string;     // 字符串模板，支持 ${method}、${url}、${params.xxx} 等
  methods?: string[];      // 生效的请求方法，默认全部
}

// 示例
api.get('/search', { q: 'keyword' }, {
  cancelRequest: {
    enabled: true,
    requestKey: 'search-${params.type}',  // 使用模板
    methods: ['GET']
  }
});

// 简写
api.get('/search', { q: 'keyword' }, { cancelRequest: true });
api.get('/search', { q: 'keyword' }, { cancelRequest: false });  // 关闭
```

### requestKey 模板

支持的占位符：

| 占位符 | 说明 | 示例 |
|--------|------|------|
| `${method}` | 请求方法 | `POST` |
| `${url}` | 请求URL | `/api/submit` |
| `${params}` | 查询参数对象 | `{id: 123}` |
| `${data}` | 请求体对象 | `{name: 'test'}` |
| `${data.xxx}` | 嵌套属性 | `${data.user.id}` |
| `${params.xxx}` | 查询参数嵌套 | `${params.id}` |

```typescript
// 使用模板
preventDuplicate: { requestKey: '${method}-${url}-${data.userId}' }

// 不使用模板，直接字符串
preventDuplicate: { requestKey: 'submit-form-key' }
```

## enhance API

```typescript
const api = createEnhanceInstance({ baseURL: '/api' });

// 取消指定请求
api.enhance.cancelRequest('search-query');

// 清空所有待处理请求
api.enhance.clearAll();

// 获取请求状态
const status = api.enhance.getRequestStatus('search-query');
if (status) {
  console.log('Request is pending');
}

// 访问请求管理器
const manager = api.enhance.requestManager;
```

## 实例配置

```typescript
// 关闭所有增强功能
const api1 = createEnhanceInstance({
  baseURL: '/api',
  preventDuplicate: false,
  cancelRequest: false
});

// 配置默认值
const api2 = createEnhanceInstance({
  baseURL: '/api',
  preventDuplicate: { intervalMs: 2000 },
  cancelRequest: { methods: ['GET'] }
});
```

## 构建输出

| 格式 | 非压缩 | 压缩版 | 用途 |
|------|--------|--------|------|
| ESM | `dist/esm/index.js` | `dist/esm/min/index.mjs` | ES Module 环境 |
| CJS | `dist/cjs/index.js` | `dist/cjs/min/index.js` | CommonJS 环境 |
| IIFE | `dist/iife/index.global.js` | `dist/iife/min/index.global.js` | 浏览器直接引用 |

### CDN 使用

```html
<!-- 压缩版 (推荐) -->
<script src="https://unpkg.com/enhance-axios@latest/dist/iife/min/index.global.js"></script>

<!-- 非压缩版 (开发调试) -->
<script src="https://unpkg.com/enhance-axios@latest/dist/iife/index.global.js"></script>
```

## 类型

```typescript
import {
  createEnhanceInstance,
  type PreventDuplicateConfig,
  type CancelRequestConfig,
  type EnhanceInstance
} from 'enhance-axios';
```

## License

MIT