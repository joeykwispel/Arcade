import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PW_PORT ?? 4180);

/** End-to-end tests against the full build in dist/ (`npm run build` first, or let CI do it). */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  // PW_CHANNEL=msedge (or chrome) runs against an installed browser instead of the downloaded one.
  use: { baseURL: `http://localhost:${port}`, trace: 'retain-on-failure', channel: process.env.PW_CHANNEL },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } }
  ],
  webServer: { command: `npm run preview -- --port ${port}`, port, reuseExistingServer: !process.env.CI }
});
