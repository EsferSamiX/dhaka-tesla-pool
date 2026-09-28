import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Every file shares one database, and new rides auto-join open pools,
    // so files run one at a time to keep them from affecting each other.
    fileParallelism: false,
  },
});
