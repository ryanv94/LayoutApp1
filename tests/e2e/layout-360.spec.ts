import { test, expect, fixture } from './fixtures';

const files = Array.from({ length: 8 }, (_, i) => fixture(`photo-${i + 1}.jpg`));

test.use({ viewport: { width: 360, height: 800 } });

test('no horizontal scroll with photos loaded and the cap notice showing', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('#files', files);
  await expect(page.locator('#thumbs li')).toHaveCount(8);
  await page.selectOption('#preset', 'a0');
  await page.selectOption('#dpi-preset', '600');
  await expect(page.locator('#notice')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('hero buttons expose aria-pressed and inputs are labelled', async ({ page }) => {
  await page.goto('/');
  await page.setInputFiles('#files', files);
  await expect(page.locator('#thumbs li')).toHaveCount(8);
  for (const b of await page.getByRole('button', { name: /hero/i }).all()) {
    await expect(b).toHaveAttribute('aria-pressed', /true|false/);
  }
  const unlabeled = await page.evaluate(() =>
    [...document.querySelectorAll('input:not([type=radio]), select')]
      .filter((el) => !(el as HTMLInputElement).labels?.length).map((el) => el.id));
  expect(unlabeled).toEqual([]);
});

test('focus ring uses the accent colour', async ({ page }) => {
  await page.goto('/');
  await page.locator('#w').focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  const color = await page.locator('#w').evaluate((el) => getComputedStyle(el).outlineColor);
  expect(color).toBe('rgb(229, 53, 43)');
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('develop reveal does not animate', async ({ page }) => {
    await page.goto('/');
    const name = await page.locator('.develop').first().evaluate((el) => getComputedStyle(el).animationName);
    expect(name).toBe('none');
  });
});
