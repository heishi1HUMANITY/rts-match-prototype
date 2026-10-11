import { defineConfig } from 'vitest/config';

export default defineConfig({
  base: './',
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
