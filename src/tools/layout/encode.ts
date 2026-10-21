/** Hand-written PNG/JPEG metadata patchers and a single-page PDF writer. No libraries. */

const enc = new TextEncoder();
const concat = (parts: Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
};

let crcTable: Uint32Array | null = null;
export function crc32(bytes: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (const b of bytes) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const be32 = (n: number) => new Uint8Array([n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);

export function setPngDpi(png: Uint8Array, dpi: number): Uint8Array {
  const ppm = Math.round(dpi / 0.0254);
  const body = concat([enc.encode('pHYs'), be32(ppm), be32(ppm), new Uint8Array([1])]);
  const phys = concat([be32(9), body, be32(crc32(body))]);
  const parts: Uint8Array[] = [png.slice(0, 8)];
  let inserted = false;
  for (let o = 8; o < png.length; ) {
    const len = ((png[o] << 24) | (png[o + 1] << 16) | (png[o + 2] << 8) | png[o + 3]) >>> 0;
    const type = String.fromCharCode(png[o + 4], png[o + 5], png[o + 6], png[o + 7]);
    const end = o + 12 + len;
    if (type === 'IDAT' && !inserted) {
      parts.push(phys);
      inserted = true;
    }
    if (type !== 'pHYs') parts.push(png.slice(o, end));
    o = end;
  }
  return concat(parts);
}

export function setJpegDpi(jpg: Uint8Array, dpi: number): Uint8Array {
  const d = Math.round(dpi);
  const isJfif =
    jpg[2] === 0xff && jpg[3] === 0xe0 && jpg[6] === 0x4a && jpg[7] === 0x46 && jpg[8] === 0x49 && jpg[9] === 0x46;
  if (isJfif) {
    const out = jpg.slice();
    out[13] = 1;
    out[14] = d >> 8;
    out[15] = d & 255;
    out[16] = d >> 8;
    out[17] = d & 255;
    return out;
  }
  const app0 = new Uint8Array([
    0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 1, d >> 8, d & 255, d >> 8, d & 255, 0, 0,
  ]);
  return concat([jpg.slice(0, 2), app0, jpg.slice(2)]);
}

const pt = (mm: number) => ((mm / 25.4) * 72).toFixed(2);

export function buildPdf(jpg: Uint8Array, pxW: number, pxH: number, wMm: number, hMm: number): Uint8Array {
  const W = pt(wMm), H = pt(hMm);
  const content = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`;
  const objs: Uint8Array[][] = [
    [enc.encode('<< /Type /Catalog /Pages 2 0 R >>')],
    [enc.encode('<< /Type /Pages /Kids [3 0 R] /Count 1 >>')],
    [enc.encode(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`)],
    [
      enc.encode(`<< /Type /XObject /Subtype /Image /Width ${pxW} /Height ${pxH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`),
      jpg,
      enc.encode('\nendstream'),
    ],
    [enc.encode(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`)],
  ];
  const parts: Uint8Array[] = [enc.encode('%PDF-1.4\n%\xe2\xe3\xcf\xd3\n')];
  // note: header comment is encoded as UTF-8; it only needs to contain high-bit bytes
  const offsets: number[] = [];
  let pos = parts[0].length;
  objs.forEach((o, i) => {
    offsets.push(pos);
    const piece = concat([enc.encode(`${i + 1} 0 obj\n`), ...o, enc.encode('\nendobj\n')]);
    parts.push(piece);
    pos += piece.length;
  });
  const xref =
    `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` +
    offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('') +
    `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${pos}\n%%EOF\n`;
  parts.push(enc.encode(xref));
  return concat(parts);
}
