import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only run unit tests (no vscode dependency)
    include: ['test/unit/**/*.test.ts'],
    environment: 'node',
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/parser/**', 'src/domain/**', 'src/application/**'],
      exclude: ['src/extension.ts', 'src/editor/**', 'src/infrastructure/**'],
    },
  },
});
