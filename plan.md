# enhance-axios 实现计划

## Context

这是一个 axios 增强包装库，需要实现两个核心功能：
1. **防重复提交**：快速多次点击时保持第一次请求
2. **取消请求**：搜索类场景，多次发送时取消旧请求，保留最新请求

两个功能默认开启，支持在实例和请求级别配置。

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
└── plan.md
```

---

## API 设计

### 两种调用方式（参数格式统一）

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
api.post('/submit', { name: 'test' }, { preventDuplicate: { requestKey: '${method}-${url}' } });
api.put('/update', { id: 1, name: 'new' }, { preventDuplicate: false });
api.delete('/user/123', null, { cancelRequest: true });
```

---

## requestKey 模板

### 支持的占位符

| 占位符 | 说明 | 示例 |
|--------|------|------|
| `${method}` | 请求方法 | `POST` |
| `${url}` | 请求URL | `/api/submit` |
| `${params}` | 查询参数对象 | `{id: 123}` |
| `${data}` | 请求体对象 | `{name: 'test'}` |
| `${data.xxx}` | 嵌套属性 | `${data.user.id}` |
| `${params.xxx}` | 查询参数嵌套 | `${params.id}` |

---

## 配置项

### 类型定义

```typescript
interface PreventDuplicateConfig {
  enabled?: boolean;      // 默认 true
  requestKey?: string;     // 字符串模板
  methods?: string[];      // 生效的请求方法，默认全部
  intervalMs?: number;    // 重复判定间隔(ms)，默认 1000
}

interface CancelRequestConfig {
  enabled?: boolean;      // 默认 true
  requestKey?: string;     // 字符串模板
  methods?: string[];      // 生效的请求方法，默认全部
}
```

### 配置合并规则

1. 实例级别配置作为默认值
2. 请求级别配置与实例配置合并后应用
3. 单个请求配置只影响当前请求，不修改实例配置

---

## 已实现文件

| 文件 | 说明 |
|------|------|
| `src/types/index.ts` | 类型定义，扩展 axios 配置 |
| `src/core/requestManager.ts` | 请求管理器逻辑 |
| `src/utils/keyGenerator.ts` | requestKey 模板解析 |
| `src/core/index.ts` | 入口，createEnhanceInstance |
| `src/index.ts` | 主导出 |
| `tests/index.test.ts` | 测试文件 |

---

## 构建输出

| 格式 | 文件 |
|------|------|
| ESM | dist/index.mjs |
| CJS | dist/index.js |
| Types | dist/index.d.ts |

---

## 验证结果

| 检查项 | 状态 |
|--------|------|
| TypeScript 类型检查 | ✅ `npm run typecheck` |
| 构建 | ✅ `npm run build` |
| 测试 | ✅ 7 tests passed |

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