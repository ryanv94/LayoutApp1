import { coverSource, type Photo } from '../../lib/image';
import { buildPdf, setJpegDpi, setPngDpi } from './encode';
import { mmToPx, type Cell } from './logic';

export type Format = 'png' | 'jpg' | 'pdf';
export interface ExportPlan { pxW: number; pxH: number; dpi: number; capped: boolean }

const DEFAULT_MAX_AREA = 268_000_000;
const IOS_MAX_AREA = 16_000_000;
const MAX_SIDE = 16384;

/** Browser canvas limits: Safari on iOS caps the canvas area at ~16 MP. */
export function canvasCaps(): { maxArea: number; maxSide: number } {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
  const ios = /iP(hone|ad|od)/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  return { maxArea: ios ? IOS_MAX_AREA : DEFAULT_MAX_AREA, maxSide: MAX_SIDE };
}

export function planExport(
  wMm: number,
  hMm: number,
  dpi: number,
  maxArea = DEFAULT_MAX_AREA,
  maxSide = MAX_SIDE,
): ExportPlan {
  if (![wMm, hMm, dpi].every((n) => Number.isFinite(n) && n > 0)) {
    throw new RangeError('Width, height and DPI must be positive numbers.');
  }
  let pxW = mmToPx(wMm, dpi);
  let pxH = mmToPx(hMm, dpi);
  const k = Math.min(1, Math.sqrt(maxArea / (pxW * pxH)), maxSide / pxW, maxSide / pxH);
  if (k >= 1) return { pxW, pxH, dpi, capped: false };
  pxW = Math.floor(pxW * k);
  pxH = Math.floor(pxH * k);
  return { pxW, pxH, dpi: dpi * k, capped: true };
}

export const exportFilename = (wMm: number, hMm: number, dpi: number, fmt: Format): string =>
  `layout-${Math.round(wMm)}x${Math.round(hMm)}mm-${Math.round(dpi)}dpi.${fmt}`;

export interface ExportInput {
  photos: Photo[];
  cells: Cell[];
  wMm: number;
  hMm: number;
  dpi: number;
  bg: string;
  format: Format;
  onProgress?: (done: number, total: number) => void;
}

const toBlob = (c: HTMLCanvasElement, type: string, q?: number) =>
  new Promise<Blob>((res, rej) =>
    c.toBlob((b) => (b ? res(b) : rej(new Error('Your browser could not encode an image this large. Try a lower DPI.'))), type, q),
  );

/**
 * Renders at full resolution. Source photos are decoded one at a time and released straight
 * after drawing, so memory stays bounded by the canvas plus a single photo.
 */
export async function renderExport(i: ExportInput): Promise<{ blob: Blob; plan: ExportPlan }> {
  const { maxArea, maxSide } = canvasCaps();
  const plan = planExport(i.wMm, i.hMm, i.dpi, maxArea, maxSide);
  const canvas = document.createElement('canvas');
  canvas.width = plan.pxW;
  canvas.height = plan.pxH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not allocate a canvas this large. Try a lower DPI.');
  ctx.fillStyle = i.bg;
  ctx.fillRect(0, 0, plan.pxW, plan.pxH);
  ctx.imageSmoothingQuality = 'high';
  const scale = plan.pxW / i.wMm;

  for (let n = 0; n < i.cells.length; n++) {
    const c = i.cells[n];
    const photo = i.photos[c.photo];
    const bmp = await createImageBitmap(photo.file, { imageOrientation: 'from-image' });
    const { sx, sy, sw, sh } = coverSource(bmp.width, bmp.height, c.w, c.h);
    ctx.drawImage(bmp, sx, sy, sw, sh, c.x * scale, c.y * scale, c.w * scale, c.h * scale);
    bmp.close();
    i.onProgress?.(n + 1, i.cells.length);
  }

  const bytes = async (type: string, q?: number) => new Uint8Array(await (await toBlob(canvas, type, q)).arrayBuffer());
  if (i.format === 'png') {
    return { blob: new Blob([setPngDpi(await bytes('image/png'), plan.dpi) as BlobPart], { type: 'image/png' }), plan };
  }
  const jpg = setJpegDpi(await bytes('image/jpeg', 0.92), plan.dpi);
  if (i.format === 'jpg') return { blob: new Blob([jpg as BlobPart], { type: 'image/jpeg' }), plan };
  return { blob: new Blob([buildPdf(jpg, plan.pxW, plan.pxH, i.wMm, i.hMm) as BlobPart], { type: 'application/pdf' }), plan };
}
