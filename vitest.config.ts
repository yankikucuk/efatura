import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // E2E testleri varsayılan olarak kapalı; EFATURA_E2E=1 ile açılır.
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    exclude: process.env.EFATURA_E2E === '1' ? [] : ['tests/e2e/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/index.ts', 'src/pdf/**'],
      thresholds: { lines: 90, branches: 85, functions: 90, statements: 90 },
    },
  },
})
