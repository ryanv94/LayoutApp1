import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: 'tests/e2e',
  use: { baseURL: 'http://localhost:4321/LayoutApp1/' },
  webServer: {
    command: 'npx astro preview --ignore-lock --port 4321',
    url: 'http://localhost:4321/LayoutApp1/',
    reuseExistingServer: !process.env.CI,
  },
});
