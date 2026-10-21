import { describe, it, expect } from 'vitest';
import { crc32, setPngDpi, setJpegDpi, buildPdf } from '../../src/tools/layout/encode';

const ascii = (s: string) => new TextEncoder().encode(s);
const dec = (b: Uint8Array) => new TextDecoder('latin1').decode(b);
const u32 = (b: Uint8Array, o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;

function chunk(type: string, data: number[]): number[] {
  const t = [...ascii(type)];
  const crc = crc32(new Uint8Array([...t, ...data]));
  const len = data.length;
  return [len >>> 24, (len >> 16) & 255, (len >> 8) & 255, len & 255, ...t, ...data,
    crc >>> 24, (crc >> 16) & 255, (crc >> 8) & 255, crc & 255];
}
// minimal valid 1x1 grayscale PNG
const IHDR = [0, 0, 0, 1, 0, 0, 0, 1, 8, 0, 0, 0, 0];
const IDAT = [0x78, 0x9c, 0x63, 0x60, 0, 0, 0, 2, 0, 1];
const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, ...chunk('IHDR', IHDR), ...chunk('IDAT', IDAT), ...chunk('IEND', [])]);

function chunks(png: Uint8Array) {
  const out: { type: string; data: Uint8Array; ok: boolean }[] = [];
  for (let o = 8; o < png.length; ) {
    const len = u32(png, o);
    const type = dec(png.slice(o + 4, o + 8));
    const data = png.slice(o + 8, o + 8 + len);
    const crc = u32(png, o + 8 + len);
    out.push({ type, data, ok: crc === crc32(png.slice(o + 4, o + 8 + len)) });
    o += 12 + len;
  }
  return out;
}

describe('crc32', () => {
  it('matches the IEND constant', () => expect(crc32(ascii('IEND'))).toBe(0xae426082));
});

describe('setPngDpi', () => {
  it('inserts pHYs before IDAT with 300 dpi = 11811 px/m and valid CRCs', () => {
    const out = chunks(setPngDpi(PNG, 300));
    const types = out.map((c) => c.type);
    expect(types.indexOf('pHYs')).toBeGreaterThan(-1);
    expect(types.indexOf('pHYs')).toBeLessThan(types.indexOf('IDAT'));
    const p = out.find((c) => c.type === 'pHYs')!;
    expect(u32(p.data, 0)).toBe(11811);
    expect(u32(p.data, 4)).toBe(11811);
    expect(p.data[8]).toBe(1);
    expect(out.every((c) => c.ok)).toBe(true);
  });
  it('replaces an existing pHYs instead of duplicating', () => {
    const twice = setPngDpi(setPngDpi(PNG, 72), 300);
    const out = chunks(twice);
    expect(out.filter((c) => c.type === 'pHYs')).toHaveLength(1);
    expect(u32(out.find((c) => c.type === 'pHYs')!.data, 0)).toBe(11811);
  });
});

describe('setJpegDpi', () => {
  const JFIF = [0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9];
  it('patches JFIF units and density', () => {
    const out = setJpegDpi(new Uint8Array(JFIF), 300);
    expect(out[13]).toBe(1);
    expect((out[14] << 8) | out[15]).toBe(300);
    expect((out[16] << 8) | out[17]).toBe(300);
    expect(out.length).toBe(JFIF.length);
  });
  it('inserts a JFIF segment when absent and keeps SOI/EOI', () => {
    const out = setJpegDpi(new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0, 2, 0xff, 0xd9]), 240);
    expect([out[0], out[1]]).toEqual([0xff, 0xd8]);
    expect([out[out.length - 2], out[out.length - 1]]).toEqual([0xff, 0xd9]);
    expect(dec(out.slice(6, 11))).toBe('JFIF\0');
    expect((out[14] << 8) | out[15]).toBe(240);
  });
});

describe('buildPdf', () => {
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const pdf = buildPdf(jpg, 10, 20, 210, 297);
  const text = dec(pdf);
  it('has header, A4 MediaBox, DCT filter and EOF', () => {
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('/MediaBox [0 0 595.28 841.89]');
    expect(text).toContain('/Filter /DCTDecode');
    expect(text.trimEnd().endsWith('%%EOF')).toBe(true);
  });
  it('startxref points at the xref keyword and entries point at objects', () => {
    const sx = Number(/startxref\s+(\d+)/.exec(text)![1]);
    expect(text.slice(sx, sx + 4)).toBe('xref');
    const entries = [...text.slice(sx).matchAll(/(\d{10}) 00000 n/g)].map((m) => Number(m[1]));
    expect(entries.length).toBeGreaterThanOrEqual(5);
    entries.forEach((off, i) => expect(text.slice(off, off + 8)).toMatch(new RegExp(`^${i + 1} 0 obj`)));
  });
});
