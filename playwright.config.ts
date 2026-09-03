import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  globalSetup: './tests/e2e/global.setup.ts',
  // Each spec seeds its own identities, so retries would collide.
  retries: 0,
  timeout: 60_000,
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'retain-on-failure' },
  webServer: {
    command: 'pnpm --filter @knowledge/web dev',
    url: 'http://127.0.0.1:3000/login',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  // The four widths the specification accepts.
  projects: [
    {
      name: 'mobile-360',
      use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 800 } },
    },
    {
      name: 'tablet-768',
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'desktop-1024',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1024, height: 900 } },
    },
    {
      name: 'desktop-1440',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
    },
  ],
});
