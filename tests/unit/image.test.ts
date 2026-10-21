import { describe, it, expect } from 'vitest';
import { validateFile, validateCount, coverSource } from '../../src/lib/image';

const file = (name: string, type: string) => new File(['x'], name, { type });

describe('validateFile', () => {
  it('rejects HEIC by extension and type', () => {
    expect(validateFile(file('a.heic', ''))).toMatch(/HEIC/i);
    expect(validateFile(file('a.jpg', 'image/heic'))).toMatch(/HEIC/i);
  });
  it('rejects non-images', () => expect(validateFile(file('a.txt', 'text/plain'))).not.toBeNull());
  it('accepts jpeg', () => expect(validateFile(file('a.jpg', 'image/jpeg'))).toBeNull());
});

describe('validateCount', () => {
  it('rejects 5 and 11', () => {
    expect(validateCount(5)).not.toBeNull();
    expect(validateCount(11)).not.toBeNull();
  });
  it('accepts 6 and 10', () => {
    expect(validateCount(6)).toBeNull();
    expect(validateCount(10)).toBeNull();
  });
});

describe('coverSource', () => {
  it('crops a landscape source to a square cell', () => {
    expect(coverSource(4000, 3000, 100, 100)).toEqual({ sx: 500, sy: 0, sw: 3000, sh: 3000 });
  });
  it('crops a portrait source to a wide cell', () => {
    expect(coverSource(3000, 4000, 200, 100)).toEqual({ sx: 0, sy: 1250, sw: 3000, sh: 1500 });
  });
});
