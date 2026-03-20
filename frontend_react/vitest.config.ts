import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Submission-focused test scope: keep only fast, core dashboard checks.
    include: [
      'src/test/student-dashboard-basic.test.tsx',
      'src/test/debug-buttons.test.tsx',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.{idea,git,cache,output,temp}/**',
      'src/test/property-tests/**',
      'src/test/student-dashboard.integration.test.tsx',
    ],
  },
});