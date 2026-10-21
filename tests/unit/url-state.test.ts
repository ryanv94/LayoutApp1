import { describe, it, expect } from 'vitest';
import { encodeState, decodeState, type SettingsState } from '../../src/lib/url-state';

const S: SettingsState = { unit: 'in', wMm: 203.2, hMm: 254, dpi: 300, marginMm: 10, gapMm: 4.5, bg: '#F5F1EA' };

describe('url-state', () => {
  it('round-trips', () => expect(decodeState(encodeState(S))).toEqual(S));
  it('returns {} for garbage', () => {
    expect(decodeState('%%%&&=')).toEqual({});
    expect(decodeState('')).toEqual({});
  });
  it('drops invalid values but keeps valid ones', () => {
    expect(decodeState('unit=cubits&w=abc&dpi=300&bg=red')).toEqual({ dpi: 300 });
  });
  it('rejects out-of-range numbers', () => {
    expect(decodeState('w=-5&h=1e9&dpi=0')).toEqual({});
  });
});
