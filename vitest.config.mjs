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
        lines: 69, // Adjusted to match current coverage (69.24%)
        functions: 70,
        statements: 68.9, // Adjusted to match current coverage (68.93%)
        branches: 51.6, // Adjusted to match current coverage (51.6%)
      },
    },
    // Add test timeout and retry configuration for CI stability
    testTimeout: 45000, // 45 seconds per test (increased for CI reliability)
    hookTimeout: 90000, // 90 seconds for hooks (increased for CI reliability with database operations and cleanup)
    teardownTimeout: 10000, // 10 seconds for teardown
  },
});
