# enhance-axios 开发计划

## 项目概述

axios 增强库，提供防重复提交、请求取消、失败重试、缓存破坏、数据自动转换五个核心能力。

---

## 目录结构

```
enhance-axios/
├── src/
│   ├── core/
│   │   ├── index.ts              # 入口，createEnhanceInstance，拦截器实现
│   │   └── requestManager.ts     # 请求管理器
│   ├── types/
│   │   └── index.ts               # 类型定义
│   ├── utils/
│   │   ├── index.ts               # 工具导出
│   │   ├── common.ts             # isPlainObject
│   │   ├── formData.ts           # getFormData
│   │   └── keyGenerator.ts       # requestKey 模板解析 + hash
│   ├── index.ts                   # 主导出
│   ├── axios-shim.ts             # UMD 构建 axios shim
│   └── version.ts                # 自动生成的版本号
├── tests/
│   └── index.test.ts             # 测试文件 (83 tests)
├── example/
│   ├── index.html                 # 测试页面 (10 项测试)
│   ├── server.js                  # Mock Server
│   └── mock-api.js               # Mock API (含 /api/echo)
├── dist/                          # 构建输出
│   ├── esm/                       # ESM (含 .mjs + .mts)
│   ├── cjs/                       # CJS
│   ├── umd/                       # IIFE (不含 axios)
│   └── umd.bundle/               # IIFE (含 axios)
├── .claude/                       # Claude Code 项目配置（必须提交）
│   ├── settings.local.json
│   └── memory/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── .gitignore
├── plan.md
└── README.md
```

---

## 已实现功能 ✅

### 1. 防重复提交 (preventDuplicate)
- 短时间重复请求复用第一次的结果，后续请求拿到相同 Promise
- 重试链复用同一个 deferred，等待者拿到最终结果
- 支持 requestKey 模板、函数、静态字符串、默认 hash
- 默认 methods: POST/PUT/PATCH/DELETE，默认 intervalMs: 1000

### 2. 取消请求 (cancelRequest)
- 新请求到来时取消旧请求，只保留最新
- 使用 AbortController/AbortSignal
- 取消前清除旧 config 的 key 标记，防止误删新请求
- 默认 methods: GET

### 3. 失败重试 (retry)
- `retryCondition` 为唯一决策点，支持指数退避
- 默认条件：网络错误、408、429、5xx
- 2xx 业务码异常在 success handler 中直接重试
- 默认 retries: 3，retryDelay: 1000

### 4. 数据自动转换 (transformRequest 注入)
- `json` → axios 默认 JSON.stringify
- `file` → getFormData 转 FormData
- `form` → URLSearchParams
- `__dataTransformInjected` 标记防重入

### 5. 缓存破坏 (needCacheBust)
- 所有方法自动追加 `_` 参数（时间戳）
- key 生成时自动剔除 `_`，重试/防重复不受影响
- 重试时 `{ ...params, _: stamp }` 覆盖旧值，不累积
- 默认 true，仅 `needCacheBust: false` 关闭

### 6. 配置归一化
- 对象默认 `enabled: ?? true`（传入即 opt-in）
- 非 false 快捷方式暗含 enabled: true
- methods: undefined/null = 所有方法，methods: [] = 不应用

### 7. Content-Type 简化
- `contentType` 配置：'json' | 'form' | 'file' | 自定义字符串
- 大小写不敏感检测已有 Content-Type
- 'file' 不设置 Content-Type（浏览器自动 boundary）

### 8. 辅助功能
- `getFormData(data, fieldName?)` — 任意数据转 FormData
- `hash(str)` — FNV-1a 32-bit 哈希
- `requestKey` 模板：`${method}` `${url}` `${data.xxx}` `${params.xxx}`，支持括号索引
- 增强 API：`api.enhance.cancelRequest()` / `.clearAll()` / `.getRequestStatus()`

### 9. RESTful 方法封装
- GET/HEAD/OPTIONS: `api.get(url, params?, config?)`
- POST/PUT/PATCH: `api.post(url, data?, config?)`
- DELETE: `api.delete(url, params?, config?)`

---

## 配置项类型

### RetryConfig（已移除 statusCodes）
```typescript
interface RetryConfig {
  enabled?: boolean;        // 默认 true（对象传入即 opt-in）
  retries?: number;          // 默认 3
  retryDelay?: number;      // 默认 1000ms
  retryCondition?: (error: AxiosError) => boolean;
  exponential?: boolean;    // 默认 true
  maxDelay?: number;         // 默认 30000ms
  methods?: string[];
}
```

---

## Example 测试页面

### 测试按钮 (10 项)

| 按钮 | 说明 |
|------|------|
| 防重复 | 连续 5 个 POST，只有第 1 个真实发送 |
| 取消请求 | 连续 5 个 GET，只有最后 1 个完成 |
| 随机 500 | 50% 概率 500，验证自动重试 |
| 固定 500 | 固定 500，验证重试耗尽 (指数增长) |
| 网络错误 | 服务端断开连接，验证自动重试 |
| 业务码 | HTTP 200 + code:1001，验证 success handler 重试 |
| 综合 | 同时测试防重复 + 取消 + 重试 |
| 单次 | 禁用增强的普通请求 |
| 缓存破坏 | 验证所有请求自动追加 _ 参数 |
| 数据转换 | 验证 json/form/file 自动转换数据格式 |

### Mock 接口

| 接口 | 方法 | 功能 |
|------|------|------|
| `/api/submit` | POST | 防重复测试 |
| `/api/search` | GET | 取消请求测试 |
| `/api/data` | GET | 随机 500 重试 |
| `/api/error` | GET | 固定 500 |
| `/api/network-error` | GET | 断开连接 |
| `/api/business-error` | GET | 业务码异常 |
| `/api/echo` | GET/POST | 回显请求参数 |
| `/api/success` | GET | 普通成功 |
| `/api/users` | GET | 用户列表 |

---

## 构建输出

| 格式 | 非压缩 | 压缩 |
|------|--------|------|
| ESM | `dist/esm/index.mjs` + `.d.mts` | `dist/esm/index.min.mjs` |
| CJS | `dist/cjs/index.js` | `dist/cjs/index.min.js` |
| UMD (无 axios) | `dist/umd/index.global.js` | `dist/umd/index.min.global.js` |
| UMD (含 axios) | `dist/umd.bundle/index.axios.global.js` | `dist/umd.bundle/index.axios.min.global.js` |

---

## 验证方式

1. `npm run typecheck` — TypeScript 类型检查
2. `npm run test` — 测试 (83 tests)
3. `npm run build` — 构建
4. `npm run example` — 启动 Mock Server
5. 浏览器打开 `http://localhost:3000`
