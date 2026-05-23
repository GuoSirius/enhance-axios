# enhance-axios

axios 增强库，提供防重复提交、请求取消、失败重试三个核心能力。

## 快速开始

```bash
npm install enhance-axios axios
```

```ts
import { createEnhanceInstance } from 'enhance-axios';

const api = createEnhanceInstance({ baseURL: '/api' });

// POST/PUT/PATCH/DELETE 默认启用防重复
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
api.post('/submit', data, {
  preventDuplicate: {
    intervalMs: 2000,
    requestKey: '${method}-${url}-${data.userId}',
  }
});

// 简写
api.post('/submit', data, { preventDuplicate: true });
api.post('/submit', data, { preventDuplicate: false });
```

**内部流程**：
```
请求 A ──→ 注册 pending ──→ 发送 ──→ 成功 ──→ resolve deferred ──→ 清理
请求 B ──→ 检测重复 ──→ 阻止 ──→ 返回 deferred.promise (B 等待 A 的结果)
```

- 默认 `methods`: `['POST', 'PUT', 'PATCH', 'DELETE']`
- 默认 `intervalMs`: `1000`
- 未提供 `requestKey` 时自动根据 method/url/params/data 生成 hash 作为 key

### 2. 取消请求 (cancelRequest)

**场景**：搜索框连续输入，自动取消旧请求，只保留最新请求。

```ts
api.get('/search', { q: 'keyword' }, {
  cancelRequest: { requestKey: '${method}-${url}' }
});
```

**内部流程**：
```
请求 A ──→ 已发出
请求 B ──→ 检测 pending ──→ 取消 A ──→ 注册 B ──→ 发送 (A 取消, B 完成)
```

- 默认 `methods`: `['GET']`
- 使用 `AbortController.abort()` 取消 HTTP 请求

### Content-Type 简化

默认 `'json'`，自动设置 `Content-Type` 头并转换数据格式。

```ts
// json（默认）→ 自动 JSON.stringify
api.post('/submit', { name: 'test' });

// form → 自动转 URLSearchParams
api.post('/login', { username: 'admin', password: '123' }, { contentType: 'form' });

// file → 自动转 FormData
api.post('/upload', { name: 'test', avatar: file }, { contentType: 'file' });

// 自定义 Content-Type（不转换数据）
api.post('/data', body, { contentType: 'text/plain' });
```

**规则：**
- `contentType` 未设置 / `null` → 默认 `'json'`
- `headers` 中已有 `content-type` (大小写不敏感) → 跳过设置，但**仍会根据该 Content-Type 自动转换数据**
- `'json'` / 默认 / 自定义字符串 → `JSON.stringify(data)`（仅当 data 为对象时）
- `'file'` → `getFormData(data)` 转 FormData，不设置 Content-Type（浏览器自动带 boundary）
- `'form'` → `new URLSearchParams(data)` 转查询字符串
- 已是 FormData / URLSearchParams / 字符串 → 不做转换

### 缓存破坏 (needCache)

所有请求默认自动在 params 中添加 `_` 参数（时间戳），防止浏览器或代理缓存。参数在 requestKey 生成之后添加，不影响防重复/取消请求的 key 匹配。

```ts
// 默认开启，所有方法都加
api.get('/data');   // → /data?_=lq8x3f
api.post('/submit', { name: 'test' });  // → /submit?_=lq8x3f

// 关闭（实例级）
const api = createEnhanceInstance({ baseURL: '/api', needCache: false });

// 关闭（请求级）
api.get('/data', null, { needCache: false });
```

### 3. 失败重试 (retry)

**场景**：网络波动、5xx 错误、业务码异常时自动重试。

```ts
api.get('/data', null, {
  retry: {
    retries: 3,
    retryDelay: 1000,
    exponential: true,
    maxDelay: 30000,
  }
});
```

**默认重试条件**：网络错误（无 response）、408（超时）、429（限流）、5xx（服务器错误）

**2xx 业务码重试**：直接在 `retryCondition` 中判断：

```ts
api.get('/data', null, {
  retry: {
    retries: 2,
    retryCondition: (error) => {
      // 2xx 但业务码异常 → 重试
      if (error.response?.status === 200 && error.response?.data?.code !== 0) return true;
      // 网络错误 / 5xx → 重试
      if (!error.response || error.response.status >= 500) return true;
      return false;
    },
  }
});
```

## 架构设计

### 请求拦截器 (5 步)

```
请求拦截器
  │
  ├─ 步骤 1：获取有效配置（请求级 > 实例级）
  ├─ 步骤 2：Content-Type 处理（默认 json，file 不设置）
  ├─ 步骤 3：取消旧请求（同 cancelKey 的旧请求被中止）
  ├─ 步骤 4：防重复检查（同 preventKey 且在 intervalMs 内则阻止）
  ├─ 步骤 5：注册新请求（AbortController 注册到 requestManager）
  │
  └──→ 发送请求
```

防重复优先于取消请求：先执行步骤 3 取消 → 步骤 4 防重复检查 → 步骤 5 注册。

### 响应拦截器

```
成功 (2xx):
  ├─ 检测业务码重试（retryCondition 判断）
  └─ resolve deferred → 清理 pendingReturns + requestManager

错误 (非 2xx / 网络错误 / 取消):
  情况 1 — 防重复拦截：返回 deferred.promise（不清理）
  情况 2 — 请求被取消： reject deferred → 清理 → 抛出
  情况 3 — 满足重试条件：保留 deferred → 清理 requestManager → 延迟后重试
  情况 4 — 重试耗尽：   reject deferred → 清理 → 抛出
```

### pendingReturns vs requestManager

```
pendingReturns: Map<string, PendingDeferred>
  ─ 存储 deferred（promise + resolve/reject 回调）
  ─ 请求 A 创建 deferred → 请求 B 被阻止时拿到 A 的 deferred.promise
  ─ 重试链复用同一个 deferred，等待者拿到最终结果

requestManager: RequestManager 实例
  ─ preventPending: Map<string, PendingRequest>  — 防重复注册
  ─ cancelPending:  Map<string, PendingRequest>  — 取消注册
  ─ 每个 PendingRequest: { key, config, controller, promise, timestamp }
  ─ controller 用于 abort()，promise 指向 pendingReturns 中的 deferred.promise
```

### Deferred 机制

```
请求 A (POST)
  ├─ 创建 deferred
  ├─ pendingReturns.set(key, deferred)
  ├─ A 完成 → deferred.resolve(response) → 通知等待者
  └─ A 重试 → 保留 deferred，重试链复用

请求 B (POST, 同 key)
  ├─ 检测到 pending
  ├─ 阻止当前请求
  └─ 返回 deferred.promise → B 等待 A 的结果
```

### 取消机制

使用 `AbortController` / `AbortSignal`（axios 1.x）：

- `new AbortController()` 创建控制器
- `config.signal = controller.signal` 绑定
- `controller.abort(reason)` 取消
- `axios.isCancel(error)` 判断

## 完整配置参考

```ts
const api = createEnhanceInstance({
  baseURL: '/api',
  timeout: 10000,

  // 缓存破坏（默认开启，GET/HEAD/OPTIONS 自动加 _ 参数）
  needCache: true,

  preventDuplicate: {
    enabled: true,
    methods: ['POST', 'PUT', 'PATCH', 'DELETE'],
    intervalMs: 1000,
  },

  cancelRequest: {
    enabled: true,
    methods: ['GET'],
  },

  retry: {
    enabled: true,
    retries: 3,
    retryDelay: 1000,
    exponential: true,
    maxDelay: 30000,
    retryCondition: (error) => {
      if (!error.response) return true;
      const status = error.response.status;
      if (status === 408 || status === 429) return true;
      if (status >= 500 && status < 600) return true;
      return false;
    },
  },
});
```

> 未提供 `requestKey` 时自动根据 method/url/params/data 生成 hash 作为 key。

## 配置简写

| 写法 | 效果 |
|------|------|
| `preventDuplicate: true` | 启用 |
| `preventDuplicate: false` | 关闭 |
| `preventDuplicate: 2000` | 设置 `intervalMs` |
| `preventDuplicate: '${url}'` | 设置 `requestKey` 模板（结果自动 hash） |
| `preventDuplicate: (cfg, hash) => key` | 设置 `requestKey` 生成函数 |
| `preventDuplicate: ['GET', 'POST']` | 设置 `methods` |
| `cancelRequest: true` / `false` | 启用/关闭 |
| `cancelRequest: '${url}'` | 设置 `requestKey` 模板 |
| `cancelRequest: (cfg, hash) => key` | 设置 `requestKey` 生成函数 |
| `cancelRequest: ['GET']` | 设置 `methods` |
| `retry: true` / `false` | 启用/关闭 |
| `retry: 5` | 设置 `retries` |
| `retry: [408, 429, 500]` | 生成 retryCondition（匹配数组中状态码或网络错误） |
| `retry: (err) => condition` | 设置 `retryCondition` |

> 非 `false` 的快捷方式暗含 `enabled: true`。`methods: undefined` / `null` = 所有方法，`methods: []` = 不应用。

## requestKey 模板

| 占位符 | 说明 | 示例值 |
|--------|------|--------|
| `${method}` | HTTP 方法 | `POST` |
| `${url}` | 请求路径 | `/api/submit` |
| `${params.xxx}` | 查询参数 | `{userId}` → `123` |
| `${data.xxx}` | 请求体属性 | `{userId}` → `123` |

支持括号索引：`${data.users[0].name}`

> 模板解析后的明文结果会经过 `hash()` 处理再作为 key 使用。直接传入的静态字符串不做 hash。

## enhance API

```ts
const api = createEnhanceInstance({ baseURL: '/api' });

// 取消指定请求（返回 boolean 表示是否成功取消）
const cancelled = api.enhance.cancelRequest('search-query');

// 清空所有待处理请求（reject 所有等待中的 deferred）
api.enhance.clearAll();

// 查看请求状态
const status = api.enhance.getRequestStatus('submit-form');
// → { key, config, controller, promise, timestamp } | undefined

// 底层 RequestManager
api.enhance.requestManager.getPendingCount();
api.enhance.requestManager.getPendingKeys();
```

## 导出

```ts
import {
  createEnhanceInstance,
  defaultRetryCondition,
  getFormData,
  hash,
  version,
} from 'enhance-axios';

import type {
  CreateEnhanceOptions, EnhanceInstance,
  PreventDuplicateConfig, CancelRequestConfig, RetryConfig,
  PreventDuplicateOption, CancelRequestOption, RetryOption,
  ContentType,
} from 'enhance-axios';
```

## getFormData

```ts
import { getFormData } from 'enhance-axios';

// File / Blob → 默认字段名 'file'
getFormData(file);
getFormData(blob);

// 自定义字段名
getFormData(file, 'avatar');

// FileList → 遍历
getFormData(fileInput.files);

// 数组
getFormData([file, 'text', 42]);

// 对象 → key 作为字段名
getFormData({ name: 'test', age: 18 });
// → { name: 'test', age: '18' }

// 嵌套 File
getFormData({ username: 'john', avatar: file });
// → { username: 'john', avatar: <File> }

// 嵌套对象用 . 连接
getFormData({ user: { name: 'test', email: 'a@b.com' } });
// → { 'user.name': 'test', 'user.email': 'a@b.com' }
```

## 示例项目

```bash
cd example && node server.js
# 打开 http://localhost:3000
```

| 按钮 | 说明 |
|------|------|
| 防重复 | 连续 5 个 POST，只有第 1 个真实发送 |
| 取消请求 | 连续 5 个 GET，只有最后 1 个完成 |
| 随机 500 | 50% 概率 500，验证自动重试 |
| 固定 500 | 固定 500，验证重试耗尽 |
| 网络错误 | 服务端断开连接，验证自动重试 |
| 业务码 | HTTP 200 + 业务码异常，验证重试 |
| 综合 | 同时测试防重复 + 取消 + 重试 |
| 单次 | 禁用增强的普通请求 |
| 缓存破坏 | 验证所有请求自动追加 _ 参数 |
| 数据转换 | 验证 json/form/file 自动转换数据格式 |

Mock 接口：`/api/submit`、`/api/search`、`/api/data`、`/api/echo`、`/api/error`、`/api/network-error`、`/api/business-error`、`/api/success`、`/api/users`

## 问题排查

遇到问题时，提交至 [GitHub Issues](https://github.com/anomalyco/enhance-axios/issues)，附上：

- axios / enhance-axios 版本、运行环境、复现代码、错误信息

## License

MIT
