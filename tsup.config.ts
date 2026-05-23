import { defineConfig, Options } from 'tsup';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ═══════════════════════════════════════════════════════════════════════════
// 构建配置说明
// ═══════════════════════════════════════════════════════════════════════════
//
//  输出格式总览：
//  ├── dist/
//  │   ├── esm/
//  │   │   ├── index.mjs         # 非压缩
//  │   │   └── index.min.mjs     # 压缩
//  │   ├── cjs/
//  │   │   ├── index.js          # 非压缩
//  │   │   └── index.min.js      # 压缩
//  │   ├── umd/
//  │   │   ├── index.global.js   # 不含axios，非压缩
//  │   │   └── index.min.global.js # 不含axios，压缩
//  │   └── umd.bundle/
//  │       ├── index.axios.global.js   # 含axios，非压缩
//  │       └── index.axios.min.global.js # 含axios，压缩
//  ═══════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// ESM builds（不包含 axios）
// ─────────────────────────────────────────────────────────────────────────────
const esmNonMinified = defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  outDir: 'dist/esm',
  clean: true,
  minify: false,
  dts: true,
  sourcemap: true,
  external: ['axios'],
  target: 'es2020',
  outExtension: () => ({ js: '.mjs' }),
});

const esmMinified = defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  outDir: 'dist/esm',
  clean: false,
  minify: true,
  dts: false,
  sourcemap: false,
  external: ['axios'],
  target: 'es2020',
  esbuildOptions(opts) {
    opts.entryNames = 'index.min';
  },
  outExtension: () => ({ js: '.mjs' }),
});

// ─────────────────────────────────────────────────────────────────────────────
// CJS builds（不包含 axios）
// ─────────────────────────────────────────────────────────────────────────────
const cjsNonMinified = defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  outDir: 'dist/cjs',
  clean: true,
  minify: false,
  dts: false,
  sourcemap: true,
  external: ['axios'],
  target: 'es2020',
  outExtension: () => ({ js: '.js' }),
});

const cjsMinified = defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  outDir: 'dist/cjs',
  clean: false,
  minify: true,
  dts: false,
  sourcemap: false,
  external: ['axios'],
  target: 'es2020',
  esbuildOptions(opts) {
    opts.entryNames = 'index.min';
  },
  outExtension: () => ({ js: '.js' }),
});

// ─────────────────────────────────────────────────────────────────────────────
// UMD builds：默认不包含 axios（axios 从 window.axios 获取）
// ─────────────────────────────────────────────────────────────────────────────
const windowAxiosPlugin = {
  name: 'window-axios',
  setup(build: any) {
    build.onResolve({ filter: /^axios$/ }, () => ({
      path: resolve(__dirname, 'src/axios-shim.ts'),
      external: false,
    }));
  },
};

const umdNonMinified = defineConfig({
  entry: ['src/index.ts'],
  format: ['iife'],
  outDir: 'dist/umd',
  clean: true,
  minify: false,
  dts: false,
  sourcemap: true,
  target: 'es2020',
  globalName: 'EnhanceAxios',
  define: { 'process.env.NODE_ENV': '"development"' },
  esbuildPlugins: [windowAxiosPlugin],
  esbuildOptions(opts) {
    opts.platform = 'browser';
    opts.entryNames = 'index';
  },
});

const umdMinified = defineConfig({
  entry: ['src/index.ts'],
  format: ['iife'],
  outDir: 'dist/umd',
  clean: false,
  minify: true,
  dts: false,
  sourcemap: false,
  target: 'es2020',
  globalName: 'EnhanceAxios',
  define: { 'process.env.NODE_ENV': '"production"' },
  esbuildPlugins: [windowAxiosPlugin],
  esbuildOptions(opts) {
    opts.platform = 'browser';
    opts.entryNames = 'index.min';
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// UMD builds：包含 axios（axios 打包进 bundle，文件名带 .axios. 后缀）
// ─────────────────────────────────────────────────────────────────────────────
const umdWithAxiosNonMinified = defineConfig({
  entry: ['src/index.ts'],
  format: ['iife'],
  outDir: 'dist/umd.bundle',
  clean: true,
  minify: false,
  dts: false,
  sourcemap: true,
  target: 'es2020',
  globalName: 'EnhanceAxios',
  define: { 'process.env.NODE_ENV': '"development"' },
  esbuildOptions(opts) {
    opts.platform = 'browser';
    opts.entryNames = 'index.axios';
  },
});

const umdWithAxiosMinified = defineConfig({
  entry: ['src/index.ts'],
  format: ['iife'],
  outDir: 'dist/umd.bundle',
  clean: false,
  minify: true,
  dts: false,
  sourcemap: false,
  target: 'es2020',
  globalName: 'EnhanceAxios',
  define: { 'process.env.NODE_ENV': '"production"' },
  esbuildOptions(opts) {
    opts.platform = 'browser';
    opts.entryNames = 'index.axios.min';
  },
});

export default [
  // ESM
  esmNonMinified,
  esmMinified,
  // CJS
  cjsNonMinified,
  cjsMinified,
  // UMD（不包含 axios）
  umdNonMinified,
  umdMinified,
  // UMD with axios（包含 axios）
  umdWithAxiosNonMinified,
  umdWithAxiosMinified,
];