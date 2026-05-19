import { defineConfig, Options } from 'tsup';

const cjsEsmConfig = defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  outDir: 'dist',
  splitting: false,
  sourcemap: true,
  minify: true,
  dts: true,
  clean: true,
  outExtension({ format }: Options) {
    return {
      cjs: '.js',
      esm: '.js',
    };
  },
  external: ['axios'],
});

const iifeConfig = defineConfig({
  entry: ['src/index.ts'],
  format: ['iife'],
  outDir: 'dist/iife',
  splitting: false,
  sourcemap: true,
  minify: true,
  clean: true,
  outExtension() {
    return {
      iife: '.global.js',
    };
  },
  globalName: 'EnhanceAxios',
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  external: ['axios'],
});

const iifeDevConfig = defineConfig({
  entry: ['src/index.ts'],
  format: ['iife'],
  outDir: 'dist/iife',
  splitting: false,
  sourcemap: true,
  clean: true,
  outExtension() {
    return {
      iife: '.global.js',
    };
  },
  globalName: 'EnhanceAxios',
  define: {
    'process.env.NODE_ENV': '"development"',
  },
  external: ['axios'],
});

export default [cjsEsmConfig, iifeConfig];