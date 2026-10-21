import { describe, it, expect } from 'vitest';
import { toMm, fromMm, mmToPx, flip, PRESETS } from '../../src/tools/layout/logic';

describe('units and presets', () => {
  it('converts inches to mm', () => expect(toMm(1, 'in')).toBe(25.4));
  it('mm is identity', () => expect(toMm(5, 'mm')).toBe(5));
  it('A4 preset is 210x297', () => {
    const a4 = PRESETS.find((p) => p.id === 'a4')!;
    expect([a4.wMm, a4.hMm]).toEqual([210, 297]);
  });
  it('mmToPx at 300 dpi', () => {
    expect(mmToPx(297, 300)).toBe(3508);
    expect(mmToPx(420, 300)).toBe(4961);
  });
  it('round-trips inches', () => {
    expect(Math.abs(fromMm(toMm(8, 'in'), 'in') - 8)).toBeLessThan(1e-9);
  });
  it('flip swaps and is an involution', () => {
    const s = { wMm: 210, hMm: 297 };
    expect(flip(s)).toEqual({ wMm: 297, hMm: 210 });
    expect(flip(flip(s))).toEqual(s);
  });
  it('has 7 inch presets, 8x10 = 203.2x254', () => {
    expect(PRESETS.filter((p) => p.group === 'Inch')).toHaveLength(7);
    const p = PRESETS.find((x) => x.id === '8x10')!;
    expect([p.wMm, p.hMm]).toEqual([203.2, 254]);
  });
  it('includes A0-A6 and the metric presets', () => {
    for (const id of ['a0', 'a1', 'a2', 'a3', 'a4', 'a5', 'a6', '10x15cm', '13x18cm', '20x30cm']) {
      expect(PRESETS.some((p) => p.id === id), id).toBe(true);
    }
  });
});
