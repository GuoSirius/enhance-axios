---
name: project-overview
description: enhance-axios 项目概述和构建配置
metadata:
  type: project
---

# enhance-axios

一个 axios 增强库，支持防重复提交、取消请求和失败重试。

## 项目状态
- Node >= 18.0.0
- 依赖 axios >= 1.7.0 作为 peerDependency

## 构建配置 (tsup.config.ts)

**关键决策：所有构建格式都 external axios**
- 使用者需自行安装 axios
- IIFE 格式期望 window.axios 存在
- IIFE 文件大小约 120KB（非内联 axios 时的原始大小）

**输出结构：**
```
dist/
├── esm/
│   ├── index.mjs        # ~14KB
│   └── min/index.mjs    # ~6KB
├── cjs/
│   ├── index.js          # ~16KB
│   └── min/index.js     # ~6KB
└── iife/
    ├── index.global.js  # ~123KB
    └── min/index.global.js
```

**重要：修改 tsup.config.ts 输出路径时，必须同步更新：**
1. README.md 构建输出表格
2. package.json exports 字段

## example 目录
- `server.js` - Mock 服务器，提供 API 和静态文件服务
- `index.html` - 可视化测试页面，支持三种加载方式：
  1. IIFE + node_modules axios
  2. IIFE + CDN axios
  3. ESM 动态导入

## 相关文件
- [[user-role]]
- [[feedback-build-config]]