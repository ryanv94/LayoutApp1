import { describe, it, expect } from 'vitest';
import { solveLayout, cropLoss, mulberry32, type Cell, type Rect } from '../../src/tools/layout/logic';

const MIXED = [1.5, 0.667, 1, 1.5, 0.75, 1.33, 0.8, 1.78];
const INNER: Rect = { x: 0, y: 0, w: 297, h: 420 };
const area = (c: Rect) => c.w * c.h;

function overlaps(a: Rect, b: Rect) {
  const e = 1e-6;
  return a.x < b.x + b.w - e && b.x < a.x + a.w - e && a.y < b.y + b.h - e && b.y < a.y + a.h - e;
}

describe('cropLoss', () => {
  it('is 0 for matching aspect', () => expect(cropLoss(1.5, 1.5)).toBe(0));
  it('is 0.5 when aspects differ 2x', () => {
    expect(cropLoss(1, 2)).toBeCloseTo(0.5);
    expect(cropLoss(2, 1)).toBeCloseTo(0.5);
  });
});

describe('mulberry32', () => {
  it('is deterministic and in [0,1)', () => {
    const a = mulberry32(5), b = mulberry32(5);
    for (let i = 0; i < 20; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('solveLayout', () => {
  const cells = solveLayout(MIXED, INNER, 4, 1);

  it('returns one cell per photo, each index once', () => {
    expect(cells).toHaveLength(MIXED.length);
    expect(cells.map((c) => c.photo).sort((a, b) => a - b)).toEqual(MIXED.map((_, i) => i));
  });
  it('keeps cells inside the inner rect and non-overlapping', () => {
    for (const c of cells) {
      expect(c.x).toBeGreaterThanOrEqual(-1e-6);
      expect(c.y).toBeGreaterThanOrEqual(-1e-6);
      expect(c.x + c.w).toBeLessThanOrEqual(INNER.w + 1e-6);
      expect(c.y + c.h).toBeLessThanOrEqual(INNER.h + 1e-6);
    }
    for (let i = 0; i < cells.length; i++)
      for (let j = i + 1; j < cells.length; j++) expect(overlaps(cells[i], cells[j])).toBe(false);
  });
  it('covers at least 85% of the inner area', () => {
    const covered = cells.reduce((s, c) => s + area(c), 0);
    expect(covered / area(INNER)).toBeGreaterThanOrEqual(0.85);
  });
  it('is deterministic per seed and differs across seeds', () => {
    expect(solveLayout(MIXED, INNER, 4, 1)).toEqual(cells);
    expect(solveLayout(MIXED, INNER, 4, 2)).not.toEqual(cells);
  });
  it('keeps average crop loss under 0.35', () => {
    const avg = cells.reduce((s, c) => s + cropLoss(c.w / c.h, MIXED[c.photo]), 0) / cells.length;
    expect(avg).toBeLessThan(0.35);
  });
  it('handles extreme aspects with positive cells', () => {
    const out = solveLayout([10, 0.1, 1, 1, 1, 1], INNER, 4, 3);
    expect(out).toHaveLength(6);
    for (const c of out) {
      expect(c.w).toBeGreaterThan(0);
      expect(c.h).toBeGreaterThan(0);
    }
  });
  it('survives a tiny canvas with a huge gap', () => {
    const out: Cell[] = solveLayout(MIXED, { x: 0, y: 0, w: 20, h: 20 }, 500, 1);
    for (const c of out) {
      expect(c.w).toBeGreaterThan(0);
      expect(c.h).toBeGreaterThan(0);
    }
  });
});

import { solveWithHero } from '../../src/tools/layout/logic';

describe('solveWithHero', () => {
  const HERO = 2;
  const cells = solveWithHero(MIXED, HERO, INNER, 4, 1);
  const heroCell = cells.find((c) => c.photo === HERO)!;

  it('places every photo once with no overlaps', () => {
    expect(cells.map((c) => c.photo).sort((a, b) => a - b)).toEqual(MIXED.map((_, i) => i));
    for (let i = 0; i < cells.length; i++)
      for (let j = i + 1; j < cells.length; j++) expect(overlaps(cells[i], cells[j])).toBe(false);
    for (const c of cells) {
      expect(c.w).toBeGreaterThan(0);
      expect(c.h).toBeGreaterThan(0);
    }
  });
  it('gives the hero the largest cell', () => {
    for (const c of cells) expect(area(heroCell)).toBeGreaterThanOrEqual(area(c) - 1e-6);
  });
  it('centres the hero within 10% on both axes', () => {
    const cx = heroCell.x + heroCell.w / 2, cy = heroCell.y + heroCell.h / 2;
    expect(Math.abs(cx - INNER.w / 2)).toBeLessThanOrEqual(INNER.w * 0.1);
    expect(Math.abs(cy - INNER.h / 2)).toBeLessThanOrEqual(INNER.h * 0.1);
  });
  it('crops the hero less than 10%', () => {
    expect(cropLoss(heroCell.w / heroCell.h, MIXED[HERO])).toBeLessThan(0.1);
  });
  it('is deterministic per seed', () => {
    expect(solveWithHero(MIXED, HERO, INNER, 4, 1)).toEqual(cells);
  });
  it('works with 6 and with 10 photos', () => {
    const six = solveWithHero(MIXED.slice(0, 6), 0, INNER, 4, 1);
    expect(six).toHaveLength(6);
    const ten = solveWithHero([...MIXED, 1, 0.7], 9, INNER, 4, 1);
    expect(ten).toHaveLength(10);
  });
  it('works on landscape canvases and extreme heroes', () => {
    const land = solveWithHero(MIXED, 4, { x: 0, y: 0, w: 420, h: 297 }, 4, 7);
    expect(land).toHaveLength(8);
    const pano = solveWithHero([10, ...MIXED.slice(1)], 0, INNER, 4, 7);
    for (const c of pano) expect(c.w).toBeGreaterThan(0);
  });
});

describe('solveWithHero extreme aspects', () => {
  const squares = Array(8).fill(1);
  const A4: Rect = { x: 0, y: 0, w: 210, h: 297 };
  it('a 10:1 panorama hero spans (nearly) the full width, centred', () => {
    const cs = solveWithHero([10, ...squares], 0, A4, 4, 1);
    const h = cs.find((c) => c.photo === 0)!;
    expect(h.w).toBeGreaterThanOrEqual(A4.w * 0.9);
    expect(Math.abs(h.y + h.h / 2 - A4.h / 2)).toBeLessThan(A4.h * 0.1);
    expect(cs).toHaveLength(9);
  });
  it('a 1:10 tall hero spans (nearly) the full height, centred', () => {
    const cs = solveWithHero([0.1, ...squares], 0, A4, 4, 1);
    const h = cs.find((c) => c.photo === 0)!;
    expect(h.h).toBeGreaterThanOrEqual(A4.h * 0.9);
    expect(Math.abs(h.x + h.w / 2 - A4.w / 2)).toBeLessThan(A4.w * 0.1);
  });
});
