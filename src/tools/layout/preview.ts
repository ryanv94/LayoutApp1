import { coverSource, type Photo } from '../../lib/image';
import type { Cell } from './logic';

export interface DragMark { from: number; target: number }

/** Draws the layout at `scale` canvas-px per mm using the downscaled preview bitmaps. */
export function drawLayout(
  ctx: CanvasRenderingContext2D,
  scale: number,
  wMm: number,
  hMm: number,
  cells: Cell[],
  photos: Photo[],
  bg: string,
  mark?: DragMark | null,
): void {
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, wMm * scale, hMm * scale);
  cells.forEach((c, i) => {
    const p = photos[c.photo];
    if (!p) return;
    const { sx, sy, sw, sh } = coverSource(p.preview.width, p.preview.height, c.w, c.h);
    ctx.globalAlpha = mark && mark.from === i ? 0.45 : 1;
    ctx.drawImage(p.preview, sx, sy, sw, sh, c.x * scale, c.y * scale, c.w * scale, c.h * scale);
    ctx.globalAlpha = 1;
  });
  if (mark && mark.target >= 0 && mark.target !== mark.from) {
    const c = cells[mark.target];
    ctx.strokeStyle = '#e5352b';
    ctx.lineWidth = 3;
    ctx.strokeRect(c.x * scale + 1.5, c.y * scale + 1.5, c.w * scale - 3, c.h * scale - 3);
  }
}
