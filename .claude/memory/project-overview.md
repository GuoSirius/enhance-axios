---
name: project-overview
description: enhance-axios 项目概述和构建配置
metadata:
  type: project
---

# enhance-axios

## 构建配置

**IIFE 格式使用 esbuild plugin 替换 axios 导入为 window.axios**

```typescript
// Plugin to replace 'axios' import with window.axios in IIFE builds
const windowAxiosPlugin = {
  name: 'window-axios',
  setup(build: any) {
    build.onResolve({ filter: /^axios$/ }, (args: any) => {
      return {
        path: resolve(__dirname, 'src/axios-shim.ts'),
        external: false,
      };
    });
  },
};
```

注意：IIFE 构建时会创建 src/axios-shim.ts，但这是临时文件，提交前需删除。

**输出结构：**
```
dist/
├── esm/          # axios external
├── cjs/          # axios external
└── iife/         # axios 从 window.axios 获取 (~16KB)
```

**重要规则：**
1. IIFE 不打包 axios，使用者需自行加载
2. src/axios-shim.ts 仅构建时使用，构建后删除
3. 版本号在 src/version.ts，手动同步 package.json

## 相关文件
- [[user-role]]