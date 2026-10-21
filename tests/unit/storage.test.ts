import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storage } from '../../src/lib/storage';

function fakeStorage(overrides: Partial<Storage> = {}): Storage {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    ...overrides,
  } as Storage;
}

describe('storage', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', fakeStorage());
  });
  it('returns fallback when empty', () => {
    expect(storage.get('k', 5)).toBe(5);
  });
  it('round-trips a value', () => {
    storage.set('k', 7);
    expect(storage.get('k', 5)).toBe(7);
  });
  it('returns fallback when getItem throws', () => {
    vi.stubGlobal('localStorage', fakeStorage({ getItem: () => { throw new Error('blocked'); } }));
    expect(storage.get('k', 5)).toBe(5);
  });
  it('does not throw when setItem throws', () => {
    vi.stubGlobal('localStorage', fakeStorage({ setItem: () => { throw new Error('quota'); } }));
    expect(() => storage.set('k', 1)).not.toThrow();
  });
});
