import { defineConfig, Options } from 'tsup';

// ESM builds
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
    return { esm: '.js' };
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
    return { esm: '.min.js' };
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

// IIFE builds (browser)
const iifeNonMinified = defineConfig({
  entry: ['src/index.ts'],
  format: ['iife'],
  outDir: 'dist/iife',
  clean: false,
  minify: false,
  dts: false,
  sourcemap: true,
  external: ['axios'],
  target: 'es2020',
  globalName: 'EnhanceAxios',
  define: {
    'process.env.NODE_ENV': '"development"',
  },
  outExtension() {
    return { iife: '.js' };
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
  external: ['axios'],
  target: 'es2020',
  globalName: 'EnhanceAxios',
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  outExtension() {
    return { iife: '.min.js' };
  },
});

export default [
  esmNonMinified,
  esmMinified,
  cjsNonMinified,
  cjsMinified,
  iifeNonMinified,
  iifeMinified,
];