/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { coachApi } from './server/coachApi.ts';

export default defineConfig(({ mode }) => {
  // Server-only variables (no VITE_ prefix): never shipped to the browser.
  const env = { ...process.env, ...loadEnv(mode, process.cwd(), '') };
  return {
    plugins: [react(), coachApi(env)],
    worker: { format: 'es' },
    test: {
      include: ['tests/unit/**/*.test.ts'],
      environment: 'node',
      testTimeout: 60000,
    },
  };
});
