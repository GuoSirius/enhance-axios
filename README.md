# enhance-axios

一个强大的 axios 增强库，支持防重复提交、取消请求和失败重试功能。

## 特性

- **防重复提交**：快速多次点击时保持第一次请求，忽略后续重复请求
- **取消请求**：搜索类场景，多次发送时自动取消旧请求，保留最新请求
- **失败重试**：自动重试失败的请求，支持指数退避策略
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

> 注意：`enhance-axios` 依赖 `axios >= 1.7.0`，请确保项目已安装 axios

## 快速开始

```typescript
import { createEnhanceInstance } from 'enhance-axios';
import axios from 'axios';  // 需要安装 axios

const api = createEnhanceInstance({ baseURL: '/api' });

// 防重复提交（保持第一次请求）
api.post('/submit', { name: 'test' }, {
  preventDuplicate: { requestKey: 'submit-form' }
});

// 搜索取消（取消旧请求，保留最新）
api.get('/search', { q: 'keyword' }, {
  cancelRequest: { requestKey: 'search-query' }
});

// 失败重试（自动重试失败的请求）
api.get('/data', null, {
  retry: { retries: 3, retryDelay: 1000 }
});
```

## API 使用

### createEnhanceInstance

创建一个增强的 axios 实例。

```typescript
import { createEnhanceInstance } from 'enhance-axios';
import axios from 'axios';

const api = createEnhanceInstance({
  baseURL: '/api',
  timeout: 10000,
  // 实例级别配置
  preventDuplicate: true,
  cancelRequest: true,
  retry: {
    retries: 3,
    retryDelay: 1000,
    maxDelay: 30000,
    exponential: true,
    statusCodes: [408, 429, 500, 502, 503, 504]
  }
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
  cancelRequest: false,
  retry: false
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
  requestKey?: string;   // 字符串模板，支持 ${method}、${url}、${data.xxx} 等
  methods?: string[];     // 生效的请求方法，默认全部
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
  requestKey?: string;    // 字符串模板，支持 ${method}、${url}、${params.xxx} 等
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

### 失败重试 (retry)

```typescript
{
  enabled?: boolean;           // 默认 true
  retries?: number;           // 重试次数，默认 3
  retryDelay?: number;       // 初始延迟(ms)，默认 1000
  maxDelay?: number;         // 最大延迟(ms)，默认 30000
  exponential?: boolean;     // 指数退避，默认 true
  statusCodes?: number[];    // 需要重试的 HTTP 状态码
  methods?: string[];        // 生效的请求方法，默认全部
  retryCondition?: (error: AxiosError) => boolean;  // 自定义重试条件
}

// 示例：基础重试
api.get('/data', null, {
  retry: {
    enabled: true,
    retries: 3,
    retryDelay: 1000,
    exponential: true
  }
});

// 示例：自定义重试条件（业务码异常也重试）
api.get('/api/action', null, {
  retry: {
    enabled: true,
    retries: 2,
    retryCondition: (error) => {
      // HTTP 500 或业务码非0都重试
      if (!error.response || error.response.status >= 500) return true;
      if (error.response?.status === 200 && error.response?.data?.code !== 0) return true;
      return false;
    }
  }
});

// 简写
api.get('/data', null, { retry: true });
api.get('/data', null, { retry: false });  // 关闭
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
  cancelRequest: false,
  retry: false
});

// 配置默认值
const api2 = createEnhanceInstance({
  baseURL: '/api',
  preventDuplicate: { intervalMs: 2000 },
  cancelRequest: { methods: ['GET'] },
  retry: { retries: 3, exponential: true }
});
```

## 构建输出

| 格式 | 文件 | 说明 |
|------|------|------|
| ESM | `dist/esm/index.mjs` | ES Module 环境 |
| ESM Min | `dist/esm/min/index.mjs` | ES Module 压缩版 |
| CJS | `dist/cjs/index.js` | CommonJS 环境 |
| CJS Min | `dist/cjs/min/index.js` | CommonJS 压缩版 |
| IIFE | `dist/iife/index.global.js` | 浏览器直接引用 |
| IIFE Min | `dist/iife/min/index.global.js` | 浏览器压缩版 |

> 所有格式都需要外部安装/加载 axios 作为依赖

### CDN 使用（浏览器直接引用）

```html
<!-- 1. 先加载 axios -->
<script src="https://unpkg.com/axios@1/dist/axios.min.js"></script>

<!-- 2. 再加载 enhance-axios -->
<script src="https://unpkg.com/enhance-axios@latest/dist/iife/min/index.global.js"></script>

<script>
  const api = EnhanceAxios.createEnhanceInstance({ baseURL: '/api' });
  api.get('/data').then(console.log);
</script>
```

### ESM 使用

```html
<script type="module">
  // 需要先 npm install axios
  import { createEnhanceInstance } from 'https://unpkg.com/enhance-axios@latest/dist/esm/index.mjs';

  const api = createEnhanceInstance({ baseURL: '/api' });
  api.get('/data').then(console.log);
</script>
```

### npm 包导入

```typescript
// 默认导入 (推荐)
// 需要先 npm install axios
import { createEnhanceInstance } from 'enhance-axios';

// ESM 格式
import { createEnhanceInstance } from 'enhance-axios/esm';
import { createEnhanceInstance } from 'enhance-axios/esm/min';

// CJS 格式
const { createEnhanceInstance } = require('enhance-axios/cjs');
const { createEnhanceInstance } = require('enhance-axios/cjs/min');
```

## 类型

```typescript
import {
  createEnhanceInstance,
  type CreateEnhanceOptions,
  type EnhanceInstance,
  type PreventDuplicateConfig,
  type CancelRequestConfig,
  type AxiosRequestConfig
} from 'enhance-axios';
```

## License

MIT