import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';

// Load .env file before anything else
config();

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    reporters: ['default'],
    setupFiles: ['./tests/setup.ts'],
    // Run tests sequentially to avoid database conflicts
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: true,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      all: true,
      thresholds: {
        lines: 70, // Restored to target threshold - add tests to meet this
        functions: 70,
        statements: 70, // Restored to target threshold - add tests to meet this
        branches: 60, // Restored to target threshold - add tests to meet this
      },
    },
    // Add test timeout and retry configuration for CI stability
    testTimeout: 45000, // 45 seconds per test (increased for CI reliability)
    hookTimeout: 90000, // 90 seconds for hooks (increased for CI reliability with database operations and cleanup)
    teardownTimeout: 10000, // 10 seconds for teardown
  },
});
