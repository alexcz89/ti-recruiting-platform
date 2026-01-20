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