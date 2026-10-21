import { test, expect } from './fixtures';
import { PRIVACY } from '../../src/data/tools';

test('page loads with title and privacy copy', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await expect(page).toHaveTitle(/Layout/);
  await expect(page.locator('#privacy')).toHaveText(PRIVACY);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(overflow).toBe(true);
});
