import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', workers: 1, timeout: 30000,
  use: { baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3011', browserName: 'chromium', launchOptions: { executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] }, headless: true },
});
