import { describe, it, expect } from 'vitest';
import { planExport, exportFilename } from '../../src/tools/layout/export';

describe('planExport', () => {
  it('A4 at 300 dpi is uncapped', () => {
    expect(planExport(210, 297, 300)).toEqual({ pxW: 2480, pxH: 3508, dpi: 300, capped: false });
  });
  it('A0 at 600 dpi is capped by area and side, aspect preserved', () => {
    const p = planExport(841, 1189, 600);
    expect(p.capped).toBe(true);
    expect(p.pxW * p.pxH).toBeLessThanOrEqual(268_000_000);
    expect(Math.max(p.pxW, p.pxH)).toBeLessThanOrEqual(16384);
    expect(Math.abs(p.pxH - (p.pxW * 1189) / 841)).toBeLessThanOrEqual(2);
    expect(p.dpi).toBeLessThan(600);
  });
  it('honours a small max area (iOS-style)', () => {
    const p = planExport(420, 594, 300, 16_000_000);
    expect(p.capped).toBe(true);
    expect(p.pxW * p.pxH).toBeLessThanOrEqual(16_000_000);
    expect(p.pxW * p.pxH).toBeGreaterThan(15_000_000);
  });
  it('throws RangeError on zero, negative or NaN input', () => {
    expect(() => planExport(0, 297, 300)).toThrow(RangeError);
    expect(() => planExport(210, NaN, 300)).toThrow(RangeError);
    expect(() => planExport(210, 297, -1)).toThrow(RangeError);
  });
});

describe('exportFilename', () => {
  it('encodes size and dpi', () => {
    expect(exportFilename(210, 297, 300, 'pdf')).toBe('layout-210x297mm-300dpi.pdf');
    expect(exportFilename(203.2, 254, 300, 'png')).toBe('layout-203x254mm-300dpi.png');
  });
});
