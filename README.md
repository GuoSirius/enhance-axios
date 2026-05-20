# enhance-axios

axios 增强库，提供防重复提交、请求取消、失败重试三个核心能力。

## 快速开始

```bash
npm install enhance-axios axios
```

```ts
import { createEnhanceInstance } from 'enhance-axios';

const api = createEnhanceInstance({ baseURL: '/api' });

// POST 默认启用防重复
api.post('/submit', { name: 'test' });

// GET 默认启用取消请求
api.get('/search', { q: 'keyword' });

// 失败自动重试
api.get('/data');
```

## 三个核心功能

### 1. 防重复提交 (preventDuplicate)

**场景**：用户快速点击提交按钮，只保留第一次请求，后续重复请求复用第一次的结果。

```ts
// 请求级配置
api.post('/submit', data, {
  preventDuplicate: {
    intervalMs: 2000,                              // 重复判定窗口
    requestKey: '${method}-${url}-${data.userId}', // 请求标识
  }
});

// 简写
api.post('/submit', data, { preventDuplicate: true });   // 启用
api.post('/submit', data, { preventDuplicate: false });  // 关闭
```

**内部流程**：

```
请求 A ──→ 注册 pending ──→ 发送 ──→ 响应成功 ──→ resolve deferred ──→ 清理
请求 B ──→ 检测重复 ──→ 阻止 ──→ 返回 deferred.promise
                         (B 等待 A 的结果，不发送真实请求)
```

- 默认 `methods`: `['POST', 'PUT', 'PATCH', 'DELETE']`
- 默认 `intervalMs`: `1000`
- 使用 `AbortController` 阻止重复请求发出

### 2. 取消请求 (cancelRequest)

**场景**：搜索框连续输入，自动取消旧请求，只保留最新请求。

```ts
api.get('/search', { q: 'keyword' }, {
  cancelRequest: {
    requestKey: '${method}-${url}',
  }
});
```

**内部流程**：

```
请求 A ──→ 已发出，进行中...
请求 B ──→ 检查 pending ──→ 取消 A ──→ 注册 B ──→ 发送
  ↓                                ↓
(A 被取消，返回 CANCEL 错误)    (B 正常完成)
```

- 默认 `methods`: `['GET']`
- 使用 `AbortController.abort()` 取消 HTTP 请求

### Content-Type 简化

默认 `'json'`，自动设置 `Content-Type` 头，无需手动写 `headers`。

```ts
// json（默认，自动设置 application/json;charset=UTF-8）
api.post('/submit', data);

// form（application/x-www-form-urlencoded）
api.post('/login', params, { contentType: 'form' });

// file（multipart/form-data，FormData 时不设置让浏览器自动处理 boundary）
const fd = new FormData();
fd.append('file', file);
api.post('/upload', fd, { contentType: 'file' });

// 自定义
api.post('/data', body, { contentType: 'text/plain' });
```

**规则：**
- `contentType` 未设置 → 默认 `'json'`
- `config.headers['Content-Type']` 已设置 → 跳过，不覆盖
- `contentType: 'file'` + `data` 是 `FormData` → 跳过（浏览器自动处理 boundary）
- `CONTENT_TYPE_MAP['json']` = `application/json;charset=UTF-8`，`form` = `application/x-www-form-urlencoded`，`file` = `multipart/form-data`

### 3. 失败重试 (retry)

**场景**：网络波动或服务暂时不可用时自动重试。

```ts
api.get('/data', null, {
  retry: {
    retries: 3,              // 重试次数
    retryDelay: 1000,        // 初始延迟(ms)
    exponential: true,       // 指数退避
    maxDelay: 30000,         // 最大延迟
  }
});
```

**默认重试条件**：
- 网络错误（无 response）
- 5xx 服务端错误
- 默认 `statusCodes`: `[408, 429, 500, 502, 503, 504]`

**自定义重试条件**：

```ts
retry: {
  retryCondition: (error) => {
    if (!error.response) return true;                  // 网络错误：重试
    if (error.response.status >= 500) return true;     // 5xx：重试
    if (error.response.status === 200
        && error.response.data?.code !== 0) return true; // 业务码异常：重试
    return false;
  }
}
```

## 架构设计

### 请求生命周期

```
请求拦截器                     axios 发送              响应拦截器
    │                            │                        │
    ├─ 1. 读取配置               │                        │
    ├─ 2. 取消请求（取消旧请求）   │                        │
    ├─ 3. 防重复检查             │                        │
    │   └─ 重复 → 阻止并返回      │                        │
    ├─ 4. 注册 pending          │                        │
    │                            │                        │
    └──────────────────→ 发送请求 ──→ 响应成功 ──→ resolve deferred + 清理
                                │     │
                                │     └──→ 响应失败 ──→ case 1: 防重复返回
                                │                  case 2: 被取消, reject + 清理
                                │                  case 3: 需要重试, 保留deferred
                                │                  case 4: 重试耗尽, reject + 清理
```

### 响应错误处理的四种情况

| 情况 | 触发条件 | deferred | 资源 | 行为 |
|------|----------|----------|------|------|
| 1 防重复拦截 | `__preventReturn === true` | 不处理 | 不清理 | 返回原始请求的 Promise |
| 2 请求被取消 | `axios.isCancel(error)` | reject | 清理 | 抛出取消错误 |
| 3 需要重试 | `retryCondition` + 次数未耗尽 | 保留 | 仅清理 requestManager | 延迟后重新发起 |
| 4 无需重试 | 不满足重试条件 | reject | 清理 | 抛出错误 |

### 防重复 Deferred 机制

```
请求 A (第1次 POST)
  │
  ├─ 创建 deferred = { resolve, reject, promise }
  ├─ pendingReturns.set(key, deferred)
  │
  ├─ 请求 A 完成
  │   └─ 成功: deferred.resolve(response)  → 通知等待者
  │   └─ 失败: deferred.reject(error)      → 通知等待者
  │
  └─ 重试链: 保留 deferred, 复用同一个

请求 B (第2次 POST, 同 key)
  │
  ├─ 检测到 pending
  ├─ 阻止当前请求
  └─ 返回 deferred.promise  → B 等待 A 的结果

请求 C (重试后再次 POST, 同 key)
  │
  ├─ pendingReturns 中已有 deferred (A 创建的)
  ├─ 复用, 不创建新的
  └─ C 完成后 resolve 同一个 deferred → 所有等待者同时收到结果
```

### 取消机制

使用 `AbortController` / `AbortSignal`（axios 1.x 推荐）：

- `new AbortController()` 创建控制器
- `config.signal = controller.signal` 绑定到请求
- `controller.abort(reason)` 取消请求
- `axios.isCancel(error)` 判断是否取消（兼容新旧机制）

## 完整配置参考

```ts
import { createEnhanceInstance } from 'enhance-axios';

const api = createEnhanceInstance({
  // ══════════════ axios 原生配置 ══════════════
  baseURL: '/api',
  timeout: 10000,

  // ══════════════ 实例级增强配置 ══════════════
  preventDuplicate: {
    enabled: true,
    requestKey: '${method}-${url}',
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    intervalMs: 1000,
  },

  cancelRequest: {
    enabled: true,
    requestKey: '${method}-${url}',
    methods: ['GET'],
  },

  retry: {
    enabled: true,
    retries: 3,
    retryDelay: 1000,
    exponential: true,
    maxDelay: 30000,
    statusCodes: [408, 429, 500, 502, 503, 504],
    methods: undefined,  // undefined = 所有方法
    retryCondition: (error) => {
      if (!error.response) return true;
      if (error.response.status >= 500) return true;
      return false;
    },
  },
});
```

### 2xx 业务码重试

HTTP 200 响应但业务逻辑失败时，可通过 `retryCondition` + 响应拦截器触发重试：

```ts
// 在响应拦截器中检测业务码
api.interceptors.response.use(
  (response) => {
    if (response.data?.code !== 0) {
      // 抛出一个包含 response 的错误，retryCondition 可检测
      const err = new Error('Business error') as any;
      err.response = response;
      err.config = response.config;
      throw err;
    }
    return response;
  },
  (error) => Promise.reject(error)
);

// retryCondition 检测业务码
api.get('/data', null, {
  retry: {
    retryCondition: (error) => {
      if (error.response?.status === 200 && error.response?.data?.code !== 0) return true;
      if (!error.response || error.response.status >= 500) return true;
      return false;
    },
  }
});
```

> 注意：成功响应处理器（2xx）内建了 `__bizRetry` 检测——如果 `retryCondition(syntheticError)` 返回 true，会自动进入重试流程，并跳过 statusCodes 过滤。

## getFormData

将任意数据转换为 `FormData`：

```ts
import { getFormData } from 'enhance-axios';

// File → 默认字段名 'file'
const fd1 = getFormData(file);

// 自定义字段名
const fd2 = getFormData(file, 'avatar');

// Blob
const fd3 = getFormData(blob);

// FileList → 遍历，字段名 'file'
const fd4 = getFormData(fileInput.files);

// 数组 → 每一项用 'file'
const fd5 = getFormData([file, 'text', 42]);

// 对象 → key 作为字段名
const fd6 = getFormData({ name: 'test', age: 18 });
// → { name: 'test', age: '18' }

// 对象嵌套 File
const fd7 = getFormData({ username: 'john', avatar: file });
// → { username: 'john', avatar: <File> }

// 嵌套对象用 . 连接
const fd8 = getFormData({ user: { name: 'test', email: 'a@b.com' } });
// → { 'user.name': 'test', 'user.email': 'a@b.com' }

// 结合 contentType: 'file'
api.post('/upload', getFormData({ avatar: file, name: 'test' }), {
  contentType: 'file',
});
```

## 配置简写

| 写法 | 效果 |
|------|------|
| `preventDuplicate: true` | 启用，使用默认配置 |
| `preventDuplicate: false` | 关闭 |
| `preventDuplicate: 2000` | 设置 `intervalMs` 为 2000 |
| `preventDuplicate: '${url}'` | 设置 `requestKey` |
| `preventDuplicate: (cfg) => key` | 设置 `requestKey` 生成函数 |
| `preventDuplicate: ['GET', 'POST']` | 设置 `methods` |
| `cancelRequest: true` / `false` | 同上（无 number 简写） |
| `retry: true` / `false` | 启用/关闭 |
| `retry: 5` | 设置 `retries` 为 5 |

## requestKey 模板

| 占位符 | 说明 | 示例值 |
|--------|------|--------|
| `${method}` | HTTP 方法 | `POST` |
| `${url}` | 请求路径 | `/api/submit` |
| `${params.xxx}` | 查询参数 | `{userId}` → `123` |
| `${data.xxx}` | 请求体属性 | `{userId}` → `123` |

```ts
// 复杂模板
preventDuplicate: {
  requestKey: '${method}-${url}-${data.userId}-${params.type}'
}
```

## enhance API

```ts
const api = createEnhanceInstance({ baseURL: '/api' });

// 手动取消指定请求
api.enhance.cancelRequest('search-query');

// 清空所有待处理请求（会 reject 所有等待中的 deferred）
api.enhance.clearAll();

// 查看请求状态
const status = api.enhance.getRequestStatus('submit-form');
// → { key, config, controller: AbortController, promise, timestamp } | undefined

// 访问底层 RequestManager
api.enhance.requestManager.getPendingCount();  // { prevent, cancel, total }
api.enhance.requestManager.getPendingKeys();   // { prevent: [], cancel: [] }
```

## 导出类型

```ts
import {
  createEnhanceInstance,
  getFormData,
} from 'enhance-axios';

import type {
  CreateEnhanceOptions,
  EnhanceInstance,
  PreventDuplicateConfig,
  CancelRequestConfig,
  RetryConfig,
  ContentType,
} from 'enhance-axios';
```

## 示例项目

```bash
cd example
node server.js
# 打开 http://localhost:3000
```

Mock 接口：
| 路径 | 方法 | 说明 |
|------|------|------|
| `/api/submit` | POST | 随机延迟 200-500ms |
| `/api/search` | GET | 慢响应 800-1500ms |
| `/api/data` | GET | 50% 概率返回 500 |
| `/api/error` | GET | 固定 500 |
| `/api/error502` | GET | 固定 502 |
| `/api/error429` | GET | 固定 429 |
| `/api/business-error` | GET | 200 但业务码异常 |
| `/api/slow` | GET | 3 秒延迟 |
| `/api/success` | GET | 固定成功 |
| `/api/users` | GET | 分页数据 |

页面上提供 6 个测试按钮：

- **防重复** — 连续发送 5 个 POST，验证只有第 1 个真实发送
- **取消请求** — 连续发送 5 个 GET，验证只有最后 1 个完成
- **失败重试** — 请求 50% 概率返回 500，验证自动重试
- **固定 500** — 请求固定返回 500，验证重试耗尽
- **综合** — 同时测试防重复 + 取消 + 重试
- **单次** — 禁用所有增强的普通请求

## 问题排查

遇到问题时，收集以下信息：

1. **axios 版本**：`npm ls axios`
2. **enhance-axios 版本**：`npm ls enhance-axios`
3. **运行环境**：Node.js / 浏览器 + 版本
4. **复现代码**：最小可复现的代码片段
5. **错误信息**：完整的 console 输出

将以上信息提交至 [GitHub Issues](https://github.com/anomalyco/enhance-axios/issues)。

## License

MIT
