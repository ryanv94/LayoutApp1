// Dev-time generator: writes tests/fixtures/photo-1..10.jpg (mixed aspects) plus bad inputs. Output is committed.
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const SIZES = [[600, 400], [400, 600], [500, 500], [600, 400], [450, 600], [600, 450], [480, 600], [640, 360], [500, 500], [400, 600]];
const browser = await chromium.launch();
const page = await browser.newPage();
const urls = await page.evaluate((sizes) =>
  sizes.map(([w, h], i) => {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, `hsl(${i * 36}, 70%, 55%)`);
    g.addColorStop(1, `hsl(${i * 36 + 60}, 60%, 25%)`);
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = '#fff'; x.font = `bold ${Math.min(w, h) / 2}px sans-serif`;
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(i + 1), w / 2, h / 2);
    return c.toDataURL('image/jpeg', 0.85);
  }), SIZES);
urls.forEach((u, i) => writeFileSync(`tests/fixtures/photo-${i + 1}.jpg`, Buffer.from(u.split(',')[1], 'base64')));
writeFileSync('tests/fixtures/bad.heic', 'not really heic');
writeFileSync('tests/fixtures/notes.txt', 'not an image');
await browser.close();
