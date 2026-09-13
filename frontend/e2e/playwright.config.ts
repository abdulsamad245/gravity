import { defineConfig, devices } from '@playwright/test';

/**
 * Browser e2e suite (Chromium + Firefox + WebKit).
 * Requires:
 *   backend  -> http://localhost:4000  (cd backend && npm run dev)
 *   frontend -> http://localhost:5173  (cd frontend && npm run dev)
 * Or BASE_URL=http://localhost:8080 for Docker.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  retries: 1,
  reporter: 'list',
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    viewport: { width: 1280, height: 800 },
    permissions: ['microphone'],
    launchOptions: {
      args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    },
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
