/// <reference types="node" />
import { defineConfig } from 'vitest/config';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const buildInfo = JSON.parse(
  execFileSync(
    process.execPath,
    [fileURLToPath(new URL('./scripts/build-info.mjs', import.meta.url))],
    { encoding: 'utf8' },
  ),
) as {
  commit: string;
  dirty: boolean;
  rulesVersion: string;
  schemaVersion: number;
};

export default defineConfig({
  base: './',
  define: { __G1_BUILD_INFO__: JSON.stringify(buildInfo) },
  // Inherited mock HTML has its own CDN/import-map dependencies.
  optimizeDeps: { entries: ['index.html'] },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      include: ['src/simulation/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
    },
  },
});
