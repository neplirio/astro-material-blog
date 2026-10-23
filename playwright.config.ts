import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: '**/*.spec.ts', fullyParallel: true,
  forbidOnly: !!process.env.CI, retries: process.env.CI ? 1 : 0,
  reporter: 'list', use: { baseURL: 'http://127.0.0.1:4321/astro-material-blog/', trace: 'retain-on-failure' },
  projects: [{name:'chromium',use:{...devices['Desktop Chrome']}}],
  webServer: { command:'npm run preview', url:'http://127.0.0.1:4321/astro-material-blog/', reuseExistingServer:!process.env.CI },
});
