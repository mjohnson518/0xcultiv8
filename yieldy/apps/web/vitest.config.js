import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.jsx'],
    include: [
      'test/unit/**/*.test.{js,jsx}',
      'test/e2e/**/*.test.{js,jsx}',
      'test/api/**/*.test.{js,jsx}',
    ],
    exclude: [
      'node_modules',
      'build',
      '.react-router',
      'test/.pending/**',
      'test/components/**',
      'test/hooks/**',
      'test/feeCalculator.test.js',
      'test/integration.test.js',
      'test/mcp-servers.test.js',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/types/*',
      ],
    },
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '~': path.resolve(__dirname, './src'),
    },
  },
});
