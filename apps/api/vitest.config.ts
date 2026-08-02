import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globalSetup: ['./tests/globalSetup.ts'],
    testTimeout: 15_000,
    hookTimeout: 20_000,
    fileParallelism: false,
  },
});
