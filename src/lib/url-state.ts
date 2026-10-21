import type { Unit } from '../tools/layout/logic';

export interface SettingsState {
  unit: Unit;
  wMm: number;
  hMm: number;
  dpi: number;
  marginMm: number;
  gapMm: number;
  bg: string;
}

export function encodeState(s: SettingsState): string {
  const p = new URLSearchParams({
    unit: s.unit, w: String(s.wMm), h: String(s.hMm), dpi: String(s.dpi),
    margin: String(s.marginMm), gap: String(s.gapMm), bg: s.bg,
  });
  return p.toString();
}

const num = (v: string | null, min: number, max: number): number | undefined => {
  if (v === null || v.trim() === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : undefined;
};

export function decodeState(query: string): Partial<SettingsState> {
  const p = new URLSearchParams(query);
  const out: Partial<SettingsState> = {};
  const unit = p.get('unit');
  if (unit === 'mm' || unit === 'in') out.unit = unit;
  const w = num(p.get('w'), 1, 5000);
  if (w !== undefined) out.wMm = w;
  const h = num(p.get('h'), 1, 5000);
  if (h !== undefined) out.hMm = h;
  const dpi = num(p.get('dpi'), 36, 1200);
  if (dpi !== undefined) out.dpi = dpi;
  const margin = num(p.get('margin'), 0, 500);
  if (margin !== undefined) out.marginMm = margin;
  const gap = num(p.get('gap'), 0, 100);
  if (gap !== undefined) out.gapMm = gap;
  const bg = p.get('bg');
  if (bg && /^#[0-9a-fA-F]{6}$/.test(bg)) out.bg = bg;
  return out;
}
