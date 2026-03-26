import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Run all unit tests (no vscode dependency)
    include: ['test/unit/**/*.test.ts'],
    environment: 'node',
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: [
        'src/scanner/**',
        'src/parser/**',
        'src/resolver/**',
        'src/domain/**',
        'src/application/**',
      ],
      exclude: ['src/extension.ts', 'src/editor/**'],
    },
  },
});
