import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// One config file. Vitest reads vite.config.ts by default, so a second file
// would be one more thing to keep in step.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // The client keeps one relative URL and never learns a port, so the same
    // build works in both run modes. ADR-003.
    proxy: {
      '/api': 'http://localhost:4001',
    },
  },
  // The scripts filter by path, the way the mock's do, so each level runs on
  // its own command.
  test: {
    include: ['tests/**/*.test.ts?(x)'],
  },
});
