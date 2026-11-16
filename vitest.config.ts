import { defineConfig } from 'vitest/config'

// Test suite: pure logic, serverless handlers, a static contract between the client and the
// database schema, and an in-memory Postgres (PGlite) running every migration to simulate a Carrera.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
})
