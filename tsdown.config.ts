import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'dist',
  format: 'cjs',
  platform: 'node',
  target: 'node24',
  sourcemap: false,
  minify: true,
  clean: true,
  dts: false,
  external: [/^node:/],
  noExternal: ['@actions/core', '@actions/github', 'yaml', 'zod', 'gifenc']
})
