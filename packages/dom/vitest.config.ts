import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@lyapjs/reactive': path.resolve(import.meta.dirname, '../reactive/src/index.ts')
    }
  },
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['test/**/*.test.ts'],
    exclude: ['dist/**', 'node_modules/**']
  }
});
