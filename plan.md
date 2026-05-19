# enhance-axios 开发计划

## Context

axios 增强包装库，支持防重复提交、取消请求和重试功能。两个功能默认开启，支持实例和请求级别配置。

---

## 目录结构

```
enhance-axios/
├── src/
│   ├── core/
│   │   ├── index.ts              # 入口，createEnhanceInstance
│   │   └── requestManager.ts     # 请求管理器
│   ├── types/
│   │   └── index.ts               # 类型定义
│   ├── utils/
│   │   ├── index.ts               # 工具导出
│   │   └── keyGenerator.ts       # requestKey 模板解析
├── tests/
│   └── index.test.ts             # 测试文件
├── package.json
├── tsconfig.json
├── eslint.config.js
├── vitest.config.ts
├── browserslist
└── plan.md
```

---

## API 设计

### 两种调用方式

```typescript
const api = createEnhanceInstance({ baseURL: '/api' });

// 方式1：axios(config) 风格
api({
  url: '/submit',
  method: 'POST',
  data: { name: 'test' },
  preventDuplicate: { requestKey: 'submit-form' },
  cancelRequest: false
});

// 方式2：RESTful 方法统一格式 (url, data, config?)
// GET/DELETE/HEAD/OPTIONS: api.get(url, params?, config?)
api.get('/search', { q: 'keyword', page: 1 }, { cancelRequest: true });

// POST/PUT/PATCH: api.post(url, data?, config?)
api.post('/submit', { name: 'test' }, { preventDuplicate: true });
api.put('/update', { id: 1, name: 'new' }, { preventDuplicate: false });
api.delete('/user/123', null, { cancelRequest: true });
```

---

## 已实现功能 ✅

### 1. 防重复提交 (preventDuplicate)
- 快速多次点击时保持第一次请求，忽略后续重复请求
- 默认开启，可通过 `preventDuplicate: false` 关闭

### 2. 取消请求 (cancelRequest)
- 搜索类场景，多次发送时自动取消旧请求，保留最新请求
- 默认开启，可通过 `cancelRequest: false` 关闭

### 3. requestKey 模板
支持 `${method}`、`${url}`、`${params}`、`${data}`、`${data.xxx}`、`${params.xxx}` 等占位符

### 4. 多格式构建
| 格式 | 非压缩 | 压缩版 |
|------|--------|--------|
| ESM | `dist/esm/index.js` | `dist/esm/min/index.mjs` |
| CJS | `dist/cjs/index.js` | `dist/cjs/min/index.js` |
| IIFE | `dist/iife/index.global.js` | `dist/iife/min/index.global.js` |

### 5. 独立配置文件
- `tsconfig.json` - TypeScript 配置
- `eslint.config.js` - ESLint 配置
- `vitest.config.ts` - Vitest 配置
- `browserslist` - 浏览器兼容性

---

## 配置项类型

### PreventDuplicateConfig

```typescript
interface PreventDuplicateConfig {
  enabled?: boolean;      // 默认 true
  requestKey?: string | ((config: AxiosRequestConfig) => string);
  methods?: string[];
  intervalMs?: number;      // 重复判定间隔(ms)，默认 1000
}
```

### CancelRequestConfig

```typescript
interface CancelRequestConfig {
  enabled?: boolean;
  requestKey?: string | ((config: AxiosRequestConfig) => string);
  methods?: string[];
}
```

---

## 已实现文件

| 文件 | 说明 |
|------|------|
| `src/types/index.ts` | 类型定义，扩展 axios 配置 |
| `src/core/requestManager.ts` | 请求管理器逻辑 |
| `src/utils/keyGenerator.ts` | requestKey 模板解析 |
| `src/core/index.ts` | 入口，createEnhanceInstance |
| `src/index.ts` | 主导出 |
| `tests/index.test.ts` | 测试文件 (28 tests) |

---

## 进行中 🔄

### 扩展功能配置约定

扩展功能的配置键（preventDuplicate、cancelRequest、retry）遵循以下约定：

| 值类型 | 处理方式 |
|--------|----------|
| `undefined` | 视为未传递，使用默认值 |
| `null` | 视为未传递，使用默认值 |
| `boolean` | 直接作为 enabled 值 |
| `string/function/array/number` | 根据配置类型归一化映射 |
| `object` | 合并到配置对象 |

**示例：**
```typescript
// 未传递（使用默认值）
api.get('/test', null);  // preventDuplicate: undefined -> 默认开启

// 显式传递
api.get('/test', null, { preventDuplicate: undefined });  // 同上
api.get('/test', null, { preventDuplicate: null });  // 同上
api.get('/test', null, { preventDuplicate: false });  // 关闭
```

---

### 1. 配置归一化

设计目标：配置支持多种格式，自动归一化到标准结构

```typescript
// bool 值 -> enabled
preventDuplicate: true  // { enabled: true }

// 函数 -> requestKey
preventDuplicate: (config) => `${config.method}-${config.url}`

// 字符串 -> requestKey
preventDuplicate: '${method}-${url}'

// 数组 -> methods
preventDuplicate: ['GET', 'POST']

// 数字 -> intervalMs
preventDuplicate: 2000

// 对象 -> 直接使用（保持原有）
preventDuplicate: { enabled: true, intervalMs: 2000 }
```

实现位置：`src/core/index.ts` - 新增 `normalizeConfig` 工具函数

**任务列表**
- [ ] 新增 `normalizeConfig<T>` 工具函数
  - 支持 boolean → enabled
  - 支持 string/function → requestKey
  - 支持 string[] → methods
  - 支持 number → intervalMs (prevent) / retryDelay (retry)
  - 支持 object → 保持原样
- [ ] 修改 `mergePreventConfig` 使用 normalizeConfig
- [ ] 修改 `mergeCancelConfig` 使用 normalizeConfig
- [ ] 添加测试用例
- [ ] 提交代码

---

### 2. 新增 Retry 扩展

设计目标：请求失败时自动重试，支持指数退避

```typescript
interface RetryConfig {
  enabled?: boolean;        // 默认 true
  retries?: number;        // 重试次数，默认 3
  retryDelay?: number;     // 初始延迟(ms)，默认 1000
  retryCondition?: (error: AxiosError) => boolean;
  exponential?: boolean;   // 指数增长，默认 true
  maxDelay?: number;       // 最大延迟(ms)，默认 30000
  methods?: string[];      // 生效方法，默认全部
  statusCodes?: number[];  // 需要重试的 HTTP 状态码
}

// 使用示例
api.get('/data', null, { retry: 5 });  // 重试5次
api.get('/data', null, { retry: { retries: 5, exponential: true } });
```

**任务列表**
- [ ] 新增 `RetryConfig` 类型定义
- [ ] 实现重试拦截器
  - 计算重试延迟（支持指数退避）
  - 判断是否应该重试
  - 克隆配置发起新请求
- [ ] 集成到 createEnhanceInstance
- [ ] 配置归一化支持（数字 → retries）
- [ ] 添加测试用例
- [ ] 更新 README
- [ ] 提交代码

---

## 验证方式

1. `npm run typecheck` - TypeScript 类型检查
2. `npm run test` - 测试
3. `npm run build` - 构建

---

## 提交记录

| 日期 | 提交信息 |
|------|----------|
| 2026-05-19 | feat: 初始化 enhance-axios 项目 |
| 2026-05-19 | chore: 更新构建配置支持多格式输出 |
| 2026-05-19 | docs: 更新 README 构建输出说明 |
| 2026-05-19 | refactor: 精简 package.json，使用独立配置文件 |

---

## 使用示例

```typescript
import { createEnhanceInstance } from 'enhance-axios';

// 创建实例，默认开启防重复和取消请求
const api = createEnhanceInstance({ baseURL: '/api' });

// 防重复提交（保持第一次请求）
api.post('/submit', { name: 'test' }, {
  preventDuplicate: { requestKey: 'submit-form' }
});

// 搜索取消（取消旧请求，保留最新）
api.get('/search', { q: 'keyword' }, {
  cancelRequest: { requestKey: 'search-query' }
});

// 使用模板
api.post('/user/update', { user: { id: 123 } }, {
  preventDuplicate: { requestKey: 'update-${data.user.id}' }
});

// 关闭功能
api.get('/no-prevent', null, { preventDuplicate: false });

// 使用 enhance API
api.enhance.cancelRequest('search-query');
api.enhance.clearAll();
```