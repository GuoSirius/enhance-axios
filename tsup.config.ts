import { defineConfig, Options } from 'tsup';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// IIFE plugin: 替换 axios 导入为 window.axios
const windowAxiosPlugin = {
  name: 'window-axios',
  setup(build: any) {
    build.onResolve({ filter: /^axios$/ }, () => ({
      path: resolve(__dirname, 'src/axios-shim.ts'),
      external: false,
    }));
  },
};

// ESM builds (axios external)
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
  outExtension({ format }: Options) {
    return { esm: '.mjs' };
  },
});

const esmMinified = defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  outDir: 'dist/esm/min',
  clean: true,
  minify: true,
  dts: false,
  sourcemap: false,
  external: ['axios'],
  target: 'es2020',
  outExtension({ format }: Options) {
    return { esm: '.mjs' };
  },
});

// CJS builds
const cjsNonMinified = defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  outDir: 'dist/cjs',
  clean: false,
  minify: false,
  dts: false,
  sourcemap: true,
  external: ['axios'],
  target: 'es2020',
  outExtension({ format }: Options) {
    return { cjs: '.js' };
  },
});

const cjsMinified = defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  outDir: 'dist/cjs/min',
  clean: true,
  minify: true,
  dts: false,
  sourcemap: false,
  external: ['axios'],
  target: 'es2020',
  outExtension({ format }: Options) {
    return { cjs: '.min.js' };
  },
});

// IIFE builds (axios from window.axios)
const iifeNonMinified = defineConfig({
  entry: ['src/index.ts'],
  format: ['iife'],
  outDir: 'dist/iife',
  clean: true,
  minify: false,
  dts: false,
  sourcemap: true,
  target: 'es2020',
  globalName: 'EnhanceAxios',
  define: { 'process.env.NODE_ENV': '"development"' },
  esbuildPlugins: [windowAxiosPlugin],
  esbuildOptions(opts) { opts.platform = 'browser'; },
  outExtension() {
    return { iife: '.global.js' };
  },
});

const iifeMinified = defineConfig({
  entry: ['src/index.ts'],
  format: ['iife'],
  outDir: 'dist/iife/min',
  clean: true,
  minify: true,
  dts: false,
  sourcemap: false,
  target: 'es2020',
  globalName: 'EnhanceAxios',
  define: { 'process.env.NODE_ENV': '"production"' },
  esbuildPlugins: [windowAxiosPlugin],
  esbuildOptions(opts) { opts.platform = 'browser'; },
  outExtension() {
    return { iife: '.global.min.js' };
  },
});

export default [esmNonMinified, esmMinified, cjsNonMinified, cjsMinified, iifeNonMinified, iifeMinified];