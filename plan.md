# enhance-axios 开发计划

## 项目概述

axios 增强包装库，支持防重复提交、取消请求和重试功能。两个功能默认开启，支持实例和请求级别配置。

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
│   │   └── keyGenerator.ts       # requestKey 模板解析
├── tests/
│   └── index.test.ts             # 测试文件 (45 tests)
├── example/                       # 待实现：测试页面
│   ├── index.html
│   ├── server.js
│   └── mock-api.js
├── dist/                          # 构建输出
│   ├── esm/
│   ├── cjs/
│   └── iife/
├── package.json
├── tsconfig.json
├── eslint.config.js
├── vitest.config.ts
├── browserslist
└── plan.md
```

---

## 已实现功能 ✅

### 1. 防重复提交 (preventDuplicate)
- 快速多次点击时保持第一次请求，忽略后续重复请求
- 默认开启，可通过 `preventDuplicate: false` 关闭
- 配置项：`enabled`、`requestKey`、`methods`、`intervalMs`

### 2. 取消请求 (cancelRequest)
- 搜索类场景，多次发送时自动取消旧请求，保留最新请求
- 默认开启，可通过 `cancelRequest: false` 关闭
- 配置项：`enabled`、`requestKey`、`methods`

### 3. 失败重试 (retry)
- 请求失败时自动重试，支持指数退避
- 默认开启，可通过 `retry: false` 关闭
- 配置项：`enabled`、`retries`、`retryDelay`、`retryCondition`、`exponential`、`maxDelay`、`methods`、`statusCodes`

### 4. requestKey 模板
支持 `${method}`、`${url}`、`${params}`、`${data}`、`${data.xxx}`、`${params.xxx}` 等占位符

### 5. 多格式构建
| 格式 | 非压缩 | 压缩版 |
|------|--------|--------|
| ESM | `dist/esm/index.js` | `dist/esm/min/index.mjs` |
| CJS | `dist/cjs/index.js` | `dist/cjs/min/index.js` |
| IIFE | `dist/iife/index.global.js` | `dist/iife/min/index.global.js` |

### 6. 配置归一化
扩展功能的配置键（preventDuplicate、cancelRequest、retry）遵循以下约定：

| 值类型 | 处理方式 |
|--------|----------|
| `undefined` | 视为未传递，使用默认值 |
| `null` | 视为未传递，使用默认值 |
| `boolean` | 直接作为 enabled 值 |
| `string/function` | 赋给 requestKey |
| `string[]` | 赋给 methods |
| `number` | 防重复->intervalMs，重试->retries |
| `object` | 合并到配置对象 |

### 7. 拦截器逻辑注释
已添加详细注释说明：
- 请求生命周期流程图
- 失败场景分析表（HTTP状态码 vs 是否重试）
- 清理逻辑说明表
- 业务码异常重试的自定义方式说明

---

## 配置项类型

### PreventDuplicateConfig
```typescript
interface PreventDuplicateConfig {
  enabled?: boolean;
  requestKey?: string | ((config: AxiosRequestConfig) => string);
  methods?: string[];
  intervalMs?: number;  // 默认 1000
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

### RetryConfig
```typescript
interface RetryConfig {
  enabled?: boolean;        // 默认 true
  retries?: number;          // 默认 3
  retryDelay?: number;      // 默认 1000ms
  retryCondition?: (error: AxiosError) => boolean;
  exponential?: boolean;    // 默认 true
  maxDelay?: number;         // 默认 30000ms
  methods?: string[];
  statusCodes?: number[];    // [408, 429, 500, 502, 503, 504]
}
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

## 已实现文件

| 文件 | 说明 |
|------|------|
| `src/types/index.ts` | 类型定义，扩展 axios 配置 |
| `src/core/requestManager.ts` | 请求管理器逻辑 |
| `src/utils/keyGenerator.ts` | requestKey 模板解析 |
| `src/core/index.ts` | 入口，createEnhanceInstance，拦截器逻辑 |
| `src/index.ts` | 主导出 |
| `tests/index.test.ts` | 测试文件 (45 tests) |

---

## 待实现功能 🔄

### Example 测试页面

#### 项目结构扩展

```
example/
├── index.html              # 测试页面
├── server.js               # Mock Server
└── mock-api.js            # Mock API 处理器
```

#### Mock Server 接口

| 接口 | 方法 | 功能 | 模拟场景 |
|------|------|------|----------|
| `/api/submit` | POST | 防重复提交测试 | 随机延迟 200-500ms |
| `/api/search` | GET | 取消请求测试 | 随机延迟 500-1500ms |
| `/api/data` | GET | 重试测试 | 随机失败 50% 概率 |
| `/api/slow` | GET | 慢接口 | 延迟 3s |
| `/api/error` | GET | 固定返回 500 | 500 错误 |
| `/api/business-error` | GET | 2xx 但业务码错误 | HTTP 200, code: 1001 |

#### HTML 测试页面布局

```
┌─────────────────────────────────────────────────┐
│                   Header                         │
│              enhance-axios 测试                │
└─────────────────────────────────────────────────┘

┌─────────────────┐ ┌─────────────────────────────┐
│  配置面板       │ │     请求日志区域            │
│                 │ │                             │
│ ○ 防重复        │ │  [时间] GET /api/search    │
│   enabled: ✓    │ │  [时间] POST /api/submit    │
│   interval: 1s  │ │  [时间] 请求已取消          │
│   requestKey    │ │  ...                        │
│                 │ │                             │
│ ○ 取消请求      │ │                             │
│   enabled: ✓    │ │                             │
│   requestKey    │ │                             │
│                 │ │                             │
│ ○ 重试          │ │                             │
│   enabled: ✓    │ │                             │
│   retries: 3    │ │                             │
│   exponential ✓ │ │                             │
│                 │ │                             │
└─────────────────┘ └─────────────────────────────┘

┌─────────────────────────────────────────────────┐
│                  操作按钮                         │
│ [防重复测试] [取消请求测试] [重试测试] [清空日志] │
└─────────────────────────────────────────────────┘
```

#### 启动脚本

```json
"scripts": {
  "example": "node example/server.js"
}
```

---

## 验证方式

1. `npm run typecheck` - TypeScript 类型检查
2. `npm run test` - 测试
3. `npm run build` - 构建
4. `npm run example` - 启动 Mock Server
5. 浏览器打开 `http://localhost:3000`

---

## 提交记录

| 日期 | 提交信息 |
|------|----------|
| 2026-05-19 | feat: 初始化 enhance-axios 项目 |
| 2026-05-19 | chore: 更新构建配置支持多格式输出 |
| 2026-05-19 | docs: 更新 README 构建输出说明 |
| 2026-05-19 | refactor: 精简 package.json，使用独立配置文件 |
| 2026-05-19 | feat: 配置归一化和 Retry 重试扩展 |
| 2026-05-19 | docs: 添加详细的拦截器逻辑注释 |
| 待提交 | feat: Example 测试页面 |

---

## 使用示例

```typescript
import { createEnhanceInstance } from 'enhance-axios';

// 创建实例，默认开启防重复和取消请求
const api = createEnhanceInstance({ baseURL: '/api' });

// 防重复提交
api.post('/submit', { name: 'test' }, {
  preventDuplicate: { requestKey: 'submit-form' }
});

// 搜索取消
api.get('/search', { q: 'keyword' }, {
  cancelRequest: { requestKey: 'search-query' }
});

// 重试配置
api.get('/data', null, {
  retry: {
    retries: 5,
    exponential: true,
    retryCondition: (error) => {
      // HTTP 2xx 但业务码非 0 时重试
      if (error.response?.status === 200 && error.response?.data?.code !== 0) {
        return true;
      }
      return !error.response || error.response.status >= 500;
    }
  }
});

// 使用 enhance API
api.enhance.cancelRequest('search-query');
api.enhance.clearAll();
```