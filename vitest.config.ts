import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    // Default to node for API route handlers and server-side code.
    // Component test files should opt in via `// @vitest-environment jsdom`
    // at the top of the file.
    environment: 'node',
    include: ['test/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['./test/setup.ts'],
    coverage: { provider: 'v8', reporter: ['text', 'html'] },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
