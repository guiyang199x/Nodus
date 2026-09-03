import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'test-fixtures',
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
