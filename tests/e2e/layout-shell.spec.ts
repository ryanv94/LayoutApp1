import { test, expect } from './fixtures';

const IDS = ['drop', 'files', 'error', 'unit', 'preset', 'w', 'h', 'flip', 'dpi-preset', 'dpi', 'margin', 'gap', 'bg',
  'shuffle', 'thumbs', 'stage', 'readout', 'export-png', 'export-jpg', 'export-pdf', 'notice'];

test('shell has every control', async ({ page }) => {
  await page.goto('/');
  for (const id of IDS) await expect(page.locator(`#${id}`), id).toHaveCount(1);
});

test('every input is labelled and export starts disabled', async ({ page }) => {
  await page.goto('/');
  const unlabeled = await page.evaluate(() =>
    [...document.querySelectorAll('input:not([type=radio]), select')].filter(
      (el) => !(el as HTMLInputElement).labels?.length,
    ).map((el) => el.id),
  );
  expect(unlabeled).toEqual([]);
  for (const id of ['export-png', 'export-jpg', 'export-pdf']) await expect(page.locator(`#${id}`)).toBeDisabled();
});

test('no horizontal scroll at 360px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
