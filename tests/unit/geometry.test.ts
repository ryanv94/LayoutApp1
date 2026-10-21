import { describe, it, expect } from 'vitest';
import { innerRect, clampGap } from '../../src/tools/layout/logic';

describe('innerRect', () => {
  it('applies margin', () => {
    expect(innerRect(210, 297, 10)).toEqual({ x: 10, y: 10, w: 190, h: 277 });
  });
  it('clamps oversized margin so the rect stays positive', () => {
    const r = innerRect(100, 100, 500);
    expect(r.w).toBeGreaterThan(0);
    expect(r.h).toBeGreaterThan(0);
  });
  it('treats NaN and negative margin as 0', () => {
    expect(innerRect(100, 100, NaN)).toEqual({ x: 0, y: 0, w: 100, h: 100 });
    expect(innerRect(100, 100, -5)).toEqual({ x: 0, y: 0, w: 100, h: 100 });
  });
});

describe('clampGap', () => {
  const inner = { x: 0, y: 0, w: 100, h: 100 };
  it('passes through a sane gap', () => expect(clampGap(inner, 1, 8)).toBe(1));
  it('limits a huge gap', () => expect(clampGap(inner, 999, 8)).toBeLessThan(10));
  it('zero stays zero; NaN/negative become 0', () => {
    expect(clampGap(inner, 0, 8)).toBe(0);
    expect(clampGap(inner, NaN, 8)).toBe(0);
    expect(clampGap(inner, -3, 8)).toBe(0);
  });
});
