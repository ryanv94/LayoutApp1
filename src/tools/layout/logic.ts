export type Unit = 'mm' | 'in';

export interface Preset {
  id: string;
  label: string;
  wMm: number;
  hMm: number;
  group: 'ISO' | 'Inch' | 'Metric';
}

const MM_PER_IN = 25.4;
const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

export const toMm = (v: number, u: Unit): number => (u === 'in' ? round6(v * MM_PER_IN) : v);
export const fromMm = (mm: number, u: Unit): number => (u === 'in' ? mm / MM_PER_IN : mm);
export const mmToPx = (mm: number, dpi: number): number => Math.round((mm / MM_PER_IN) * dpi);
export const flip = (s: { wMm: number; hMm: number }) => ({ wMm: s.hMm, hMm: s.wMm });

const iso = (n: number, wMm: number, hMm: number): Preset => ({
  id: `a${n}`, label: `A${n}`, wMm, hMm, group: 'ISO',
});
const inch = (w: number, h: number): Preset => ({
  id: `${w}x${h}`, label: `${w}×${h} in`, wMm: toMm(w, 'in'), hMm: toMm(h, 'in'), group: 'Inch',
});
const cm = (w: number, h: number): Preset => ({
  id: `${w}x${h}cm`, label: `${w}×${h} cm`, wMm: w * 10, hMm: h * 10, group: 'Metric',
});

export const PRESETS: Preset[] = [
  iso(0, 841, 1189), iso(1, 594, 841), iso(2, 420, 594), iso(3, 297, 420),
  iso(4, 210, 297), iso(5, 148, 210), iso(6, 105, 148),
  inch(4, 6), inch(5, 7), inch(8, 10), inch(11, 14), inch(12, 16), inch(16, 20), inch(20, 24),
  cm(10, 15), cm(13, 18), cm(20, 30),
];

export interface Rect { x: number; y: number; w: number; h: number }

const finiteNonNeg = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

export function innerRect(wMm: number, hMm: number, marginMm: number): Rect {
  const m = Math.min(finiteNonNeg(marginMm), 0.45 * Math.min(wMm, hMm));
  return { x: m, y: m, w: wMm - 2 * m, h: hMm - 2 * m };
}

export function clampGap(inner: Rect, gapMm: number, count: number): number {
  const max = (0.25 * Math.min(inner.w, inner.h)) / Math.max(1, count);
  return Math.min(finiteNonNeg(gapMm), max);
}

export interface Cell extends Rect { photo: number }

/** Fraction of the photo discarded when it is cover-fitted into a cell. */
export function cropLoss(cellAspect: number, photoAspect: number): number {
  const lo = Math.min(cellAspect, photoAspect);
  const hi = Math.max(cellAspect, photoAspect);
  return hi > 0 ? 1 - lo / hi : 1;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Node =
  | { leaf: number; aspect: number }
  | { dir: 'V' | 'H'; a: Node; b: Node; aspect: number };

const TRIES = 600;

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Random slicing tree over an ordered list; aspect is the tree's natural (crop-free) aspect. */
function buildTree(list: number[], aspects: number[], rng: () => number): Node {
  if (list.length === 1) return { leaf: list[0], aspect: aspects[list[0]] };
  const k = 1 + Math.floor(rng() * (list.length - 1));
  const a = buildTree(list.slice(0, k), aspects, rng);
  const b = buildTree(list.slice(k), aspects, rng);
  const dir = rng() < 0.5 ? 'V' : 'H';
  const aspect = dir === 'V' ? a.aspect + b.aspect : (a.aspect * b.aspect) / (a.aspect + b.aspect);
  return { dir, a, b, aspect };
}

function place(node: Node, r: Rect, gap: number, out: Cell[]): void {
  if ('leaf' in node) {
    out.push({ ...r, photo: node.leaf });
    return;
  }
  if (node.dir === 'V') {
    const avail = r.w - gap;
    const wA = (avail * node.a.aspect) / (node.a.aspect + node.b.aspect);
    place(node.a, { x: r.x, y: r.y, w: wA, h: r.h }, gap, out);
    place(node.b, { x: r.x + wA + gap, y: r.y, w: avail - wA, h: r.h }, gap, out);
  } else {
    const avail = r.h - gap;
    const ia = 1 / node.a.aspect;
    const ib = 1 / node.b.aspect;
    const hA = (avail * ia) / (ia + ib);
    place(node.a, { x: r.x, y: r.y, w: r.w, h: hA }, gap, out);
    place(node.b, { x: r.x, y: r.y + hA + gap, w: r.w, h: avail - hA }, gap, out);
  }
}

/** Lower is better: crop loss plus penalties for extreme or tiny cells. */
export function scoreCells(cells: Cell[], aspects: number[]): number {
  const mean = cells.reduce((s, c) => s + c.w * c.h, 0) / cells.length;
  let score = 0;
  for (const c of cells) {
    const ca = c.w / c.h;
    score += cropLoss(ca, aspects[c.photo]);
    if (ca > 3) score += 0.3 * (ca - 3);
    if (ca < 1 / 3) score += 0.3 * (1 / 3 - ca) * 3;
    const rel = (c.w * c.h) / mean;
    if (rel < 0.45) score += 0.45 - rel;
  }
  return score;
}

export function solveLayout(
  aspects: number[],
  inner: Rect,
  gap: number,
  seed: number,
  tries = TRIES,
): Cell[] {
  const n = aspects.length;
  if (n === 0) return [];
  const g = clampGap(inner, gap, n - 1);
  const rng = mulberry32(seed);
  const ids = aspects.map((_, i) => i);
  let best: Cell[] = [];
  let bestScore = Infinity;
  for (let t = 0; t < tries; t++) {
    const tree = buildTree(shuffle(ids, rng), aspects, rng);
    const cells: Cell[] = [];
    place(tree, inner, g, cells);
    const s = scoreCells(cells, aspects);
    if (s < bestScore) {
      bestScore = s;
      best = cells;
    }
  }
  return best;
}

const HERO_AREA = 0.45;
const MIN_BAND = 0.1; // band's short side as a fraction of the canvas's short side
const HERO_VARIANTS = 30;
const HERO_TRIES = 60;

/** Hero centred at its own aspect; the other photos fill the four bands around it. */
export function solveWithHero(
  aspects: number[],
  hero: number,
  inner: Rect,
  gap: number,
  seed: number,
): Cell[] {
  const n = aspects.length;
  if (n <= 1) return solveLayout(aspects, inner, gap, seed);
  const g = clampGap(inner, gap, n - 1);
  const rest = aspects.map((_, i) => i).filter((i) => i !== hero);
  const ha = aspects[hero];
  const short = Math.min(inner.w, inner.h);

  for (let f = HERO_AREA; f >= 0.15; f -= 0.05) {
    // hero rect with its own aspect, fitted inside the inner rect
    let hw = Math.sqrt(f * inner.w * inner.h * ha);
    let hh = hw / ha;
    // A very wide or tall hero can't be the largest by area; let it span almost the whole canvas instead.
    const fit = Math.min(1, (inner.w * 0.96) / hw, (inner.h * 0.96) / hh);
    const spanLimited = fit < 1;
    hw *= fit;
    hh *= fit;
    const hx = inner.x + (inner.w - hw) / 2;
    const hy = inner.y + (inner.h - hh) / 2;
    const heroCell: Cell = { x: hx, y: hy, w: hw, h: hh, photo: hero };

    const bands: Rect[] = [
      { x: inner.x, y: inner.y, w: inner.w, h: hy - inner.y - g },
      { x: inner.x, y: hy + hh + g, w: inner.w, h: inner.y + inner.h - (hy + hh) - g },
      { x: inner.x, y: hy, w: hx - inner.x - g, h: hh },
      { x: hx + hw + g, y: hy, w: inner.x + inner.w - (hx + hw) - g, h: hh },
    ].filter((b) => b.w > 0 && b.h > 0 && Math.min(b.w, b.h) >= MIN_BAND * short);
    if (bands.length === 0) continue;

    const totalArea = bands.reduce((s, b) => s + b.w * b.h, 0);
    const rng = mulberry32(seed);
    let best: Cell[] | null = null;
    let bestScore = Infinity;

    for (let v = 0; v < HERO_VARIANTS; v++) {
      // photo counts per band: largest remainder on area, with a seeded nudge after variant 0
      const quota = bands.map((b) => (rest.length * b.w * b.h) / totalArea + (v ? (rng() - 0.5) * 1.2 : 0));
      const counts = quota.map((q) => Math.max(0, Math.floor(q)));
      let left = rest.length - counts.reduce((a, c) => a + c, 0);
      const order = quota.map((q, i) => i).sort((a, b) => (quota[b] - counts[b]) - (quota[a] - counts[a]));
      for (let k = 0; left > 0; k++, left--) counts[order[k % order.length]]++;
      for (let k = 0; left < 0; k++) {
        const i = order[order.length - 1 - (k % order.length)];
        if (counts[i] > 0) { counts[i]--; left++; }
      }

      const ids = shuffle(rest, rng);
      const cells: Cell[] = [];
      let at = 0;
      bands.forEach((b, bi) => {
        const mine = ids.slice(at, at + counts[bi]);
        at += counts[bi];
        if (mine.length === 0) return;
        const sub = solveLayout(mine.map((i) => aspects[i]), b, g, seed + 31 * bi + v, HERO_TRIES);
        for (const c of sub) cells.push({ ...c, photo: mine[c.photo] });
      });

      let score = scoreCells(cells, aspects);
      if (!spanLimited) for (const c of cells) if (c.w * c.h > 0.9 * hw * hh) score += 10;
      if (score < bestScore) {
        bestScore = score;
        best = cells;
      }
    }
    if (best) return [heroCell, ...best];
  }
  return solveLayout(aspects, inner, gap, seed);
}

export function swapPhotos(cells: Cell[], a: number, b: number): Cell[] {
  const out = cells.map((c) => ({ ...c }));
  if (a !== b) [out[a].photo, out[b].photo] = [cells[b].photo, cells[a].photo];
  return out;
}

export const nextSeed = (seed: number): number => (Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) >>> 0) + 1;

export function cellAt(cells: Cell[], x: number, y: number): number {
  return cells.findIndex((c) => x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h);
}
