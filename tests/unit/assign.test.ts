import { describe, it, expect } from 'vitest';
import { swapPhotos, nextSeed, cellAt, type Cell } from '../../src/tools/layout/logic';

const cells: Cell[] = [
  { x: 0, y: 0, w: 10, h: 10, photo: 0 },
  { x: 12, y: 0, w: 10, h: 10, photo: 1 },
  { x: 0, y: 12, w: 22, h: 10, photo: 2 },
];

describe('swapPhotos', () => {
  it('exchanges photo fields only', () => {
    const out = swapPhotos(cells, 0, 2);
    expect(out[0]).toEqual({ ...cells[0], photo: 2 });
    expect(out[2]).toEqual({ ...cells[2], photo: 0 });
    expect(out[1]).toEqual(cells[1]);
    expect(cells[0].photo).toBe(0); // input untouched
  });
  it('same index is a no-op', () => expect(swapPhotos(cells, 1, 1)).toEqual(cells));
});

describe('cellAt', () => {
  it('finds a cell', () => expect(cellAt(cells, 15, 5)).toBe(1));
  it('returns -1 in a gap', () => expect(cellAt(cells, 11, 5)).toBe(-1));
  it('returns -1 outside', () => expect(cellAt(cells, 100, 100)).toBe(-1));
});

describe('nextSeed', () => {
  it('is deterministic and different', () => {
    expect(nextSeed(1)).toBe(nextSeed(1));
    expect(nextSeed(1)).not.toBe(1);
  });
});
