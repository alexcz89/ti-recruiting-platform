// vitest.config.ts - Compatible con Vitest 4 + Next.js server-only
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    
    pool: 'threads',
    testTimeout: 10000,
    hookTimeout: 10000,
    reporters: ['verbose'],
    
    watchExclude: [
      'node_modules/**',
      'dist/**',
      '.next/**',
    ],
    
    retry: 2,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules/**',
        'dist/**',
        '.next/**',
        '**/*.config.{js,ts}',
        '**/*.setup.{js,ts}',
        '**/*.d.ts',
        '**/types/**',
        '**/__tests__/**',
        '**/test-helpers.ts',
        'vitest.mocks.ts',
        'postcss.config.mjs',
        'tailwind.config.ts',
      ],
      include: [
        'lib/**/*.{js,ts}',
        'app/**/*.{js,ts,tsx}',
        'components/**/*.{js,ts,tsx}',
      ],
      all: true,
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
    },
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      // Mock server-only para que no falle en tests
      'server-only': path.resolve(__dirname, './vitest.mocks.ts'),
    },
    conditions: ['node'],
  },
});
