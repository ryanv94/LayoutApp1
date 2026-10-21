import { storage } from '../../lib/storage';
import { showError, clearError } from '../../lib/errors';
import { validateFile, validateCount, loadPhoto, MAX_PHOTOS, type Photo } from '../../lib/image';
import { decodeState, encodeState, type SettingsState } from '../../lib/url-state';
import {
  PRESETS, toMm, fromMm, mmToPx, flip, innerRect, solveLayout, solveWithHero,
  swapPhotos, nextSeed, cellAt, type Cell, type Unit,
} from './logic';
import { drawLayout, type DragMark } from './preview';
import { canvasCaps, exportFilename, planExport, renderExport, type Format } from './export';
import { download } from '../../lib/download';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const DEFAULTS: SettingsState = { unit: 'mm', wMm: 210, hMm: 297, dpi: 300, marginMm: 10, gapMm: 4, bg: '#0B0A09' };
const DEBUG = new URLSearchParams(location.search).has('debug');
const DPI_PRESETS = [150, 240, 300, 600];

const s: SettingsState = {
  ...DEFAULTS,
  ...storage.get<Partial<SettingsState>>('layout.settings', {}),
  ...decodeState(location.search),
};

let photos: Photo[] = [];
let heroId: string | null = null;
let swaps: [string, string][] = [];
let seed = 1;
let cells: Cell[] = [];
let rafPending = false;
let mark: DragMark | null = null;
let exporting = false;

const canvas = $<HTMLCanvasElement>('stage');
const wrap = $('stage-wrap');
const errorBox = $('error');

// ---------- settings <-> inputs ----------
const fmt = (mm: number, u: Unit) => String(+fromMm(mm, u).toFixed(u === 'in' ? 3 : 1));

function matchPreset(): string {
  const hit = PRESETS.find(
    (p) =>
      (Math.abs(p.wMm - s.wMm) < 0.05 && Math.abs(p.hMm - s.hMm) < 0.05) ||
      (Math.abs(p.hMm - s.wMm) < 0.05 && Math.abs(p.wMm - s.hMm) < 0.05),
  );
  return hit ? hit.id : 'custom';
}

function syncInputs(): void {
  (document.querySelector(`#unit input[value="${s.unit}"]`) as HTMLInputElement).checked = true;
  $<HTMLInputElement>('w').value = fmt(s.wMm, s.unit);
  $<HTMLInputElement>('h').value = fmt(s.hMm, s.unit);
  $<HTMLInputElement>('w').step = $<HTMLInputElement>('h').step = s.unit === 'in' ? '0.1' : '1';
  $<HTMLSelectElement>('preset').value = matchPreset();
  $<HTMLInputElement>('dpi').value = String(s.dpi);
  $<HTMLSelectElement>('dpi-preset').value = DPI_PRESETS.includes(s.dpi) ? String(s.dpi) : 'custom';
  $<HTMLInputElement>('margin').value = String(s.marginMm);
  $('margin-out').textContent = `${s.marginMm} mm`;
  $<HTMLInputElement>('gap').value = String(s.gapMm);
  $('gap-out').textContent = `${s.gapMm} mm`;
  const bg = document.querySelector(`#bg input[value="${s.bg}"]`) as HTMLInputElement | null;
  if (bg) bg.checked = true;
}

function persist(): void {
  storage.set('layout.settings', s);
  history.replaceState(null, '', `?${encodeState(s)}${DEBUG ? '&debug=1' : ''}`);
}

function changed(resetSwaps = false): void {
  if (resetSwaps) swaps = [];
  persist();
  scheduleRender();
}

// ---------- layout ----------
function compute(): Cell[] {
  if (!photos.length) return [];
  const inner = innerRect(s.wMm, s.hMm, s.marginMm);
  const aspects = photos.map((p) => p.w / p.h);
  const heroIdx = heroId ? photos.findIndex((p) => p.id === heroId) : -1;
  let cs =
    heroIdx >= 0 && photos.length > 1
      ? solveWithHero(aspects, heroIdx, inner, s.gapMm, seed)
      : solveLayout(aspects, inner, s.gapMm, seed);
  for (const [a, b] of swaps) {
    const ia = photos.findIndex((p) => p.id === a);
    const ib = photos.findIndex((p) => p.id === b);
    const ka = cs.findIndex((c) => c.photo === ia);
    const kb = cs.findIndex((c) => c.photo === ib);
    if (ka >= 0 && kb >= 0) cs = swapPhotos(cs, ka, kb);
  }
  return cs;
}

function scheduleRender(): void {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(render);
}

function updateReadout(): void {
  try {
    const { maxArea, maxSide } = canvasCaps();
    const p = planExport(s.wMm, s.hMm, s.dpi, maxArea, maxSide);
    $('readout').textContent = `${p.pxW} × ${p.pxH} px · ${((p.pxW * p.pxH) / 1e6).toFixed(1)} MP`;
    const notice = $('notice');
    if (p.capped) {
      notice.textContent = `${s.dpi} DPI at this size exceeds what this browser can render. Exports will use about ${Math.round(p.dpi)} DPI.`;
      notice.hidden = false;
    } else notice.hidden = true;
  } catch {
    $('readout').textContent = '—';
  }
}

function render(): void {
  rafPending = false;
  updateReadout();
  const ready = validateCount(photos.length) === null;
  for (const id of ['export-png', 'export-jpg', 'export-pdf']) $<HTMLButtonElement>(id).disabled = !ready || exporting;
  $<HTMLButtonElement>('shuffle').disabled = photos.length < 2;
  $('count-hint').textContent = `${photos.length} of 6–10 photos`;

  cells = compute();
  if (DEBUG) (window as unknown as { __layoutCells: Cell[] }).__layoutCells = cells;
  canvas.hidden = photos.length === 0;
  $('stage-empty').hidden = photos.length > 0;
  if (!photos.length) return;

  const pad = parseFloat(getComputedStyle(wrap).paddingLeft) * 2;
  const aspect = s.wMm / s.hMm;
  const cssW = Math.max(80, Math.min(wrap.clientWidth - pad, window.innerHeight * 0.75 * aspect));
  const cssH = cssW / aspect;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  draw();
}

function draw(): void {
  const ctx = canvas.getContext('2d')!;
  drawLayout(ctx, canvas.width / s.wMm, s.wMm, s.hMm, cells, photos, s.bg, mark);
}

// ---------- drag a cell onto another to swap ----------
function cellUnder(e: PointerEvent): number {
  const r = canvas.getBoundingClientRect();
  return cellAt(cells, ((e.clientX - r.left) / r.width) * s.wMm, ((e.clientY - r.top) / r.height) * s.hMm);
}
function endDrag(): void {
  mark = null;
  canvas.classList.remove('dragging');
}
canvas.addEventListener('pointerdown', (e) => {
  const from = cellUnder(e);
  if (from < 0) return;
  mark = { from, target: from };
  canvas.setPointerCapture(e.pointerId);
  canvas.classList.add('dragging');
  draw();
});
canvas.addEventListener('pointermove', (e) => {
  if (!mark) return;
  const target = cellUnder(e);
  if (target !== mark.target) {
    mark = { from: mark.from, target };
    draw();
  }
});
canvas.addEventListener('pointerup', (e) => {
  if (!mark) return;
  const { from } = mark;
  const target = cellUnder(e);
  endDrag();
  if (target >= 0 && target !== from) {
    swaps.push([photos[cells[from].photo].id, photos[cells[target].photo].id]);
    scheduleRender();
  } else draw();
});
canvas.addEventListener('pointercancel', () => {
  endDrag();
  draw();
});

// ---------- thumbnails ----------
function renderThumbs(): void {
  const ul = $('thumbs');
  ul.replaceChildren();
  photos.forEach((p, i) => {
    const li = document.createElement('li');
    li.tabIndex = 0;
    li.dataset.id = p.id;
    li.classList.toggle('is-hero', p.id === heroId);
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 144;
    const x = c.getContext('2d')!;
    const k = Math.min(256 / p.preview.width, 144 / p.preview.height);
    const dw = p.preview.width * k, dh = p.preview.height * k;
    x.drawImage(p.preview, (256 - dw) / 2, (144 - dh) / 2, dw, dh);
    const name = document.createElement('span');
    name.className = 'thumb-name';
    name.textContent = p.name;
    const actions = document.createElement('div');
    actions.className = 'thumb-actions';
    const hero = document.createElement('button');
    hero.type = 'button';
    hero.className = 'btn btn-ghost';
    hero.textContent = '★ Hero';
    hero.setAttribute('aria-pressed', String(p.id === heroId));
    hero.addEventListener('click', () => {
      heroId = heroId === p.id ? null : p.id;
      swaps = [];
      renderThumbs();
      changed();
    });
    const rm = document.createElement('button');
    rm.type = 'button';
    rm.className = 'btn btn-ghost';
    rm.textContent = '✕';
    rm.setAttribute('aria-label', `Remove ${p.name}`);
    rm.addEventListener('click', () => {
      p.preview.close();
      photos.splice(i, 1);
      if (heroId === p.id) heroId = null;
      swaps = [];
      refreshMessages([]);
      renderThumbs();
      scheduleRender();
    });
    li.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
      const other = photos[i + d];
      if (!d || !other) return;
      e.preventDefault();
      swaps.push([p.id, other.id]);
      scheduleRender();
    });
    actions.append(hero, rm);
    li.append(c, name, actions);
    ul.append(li);
  });
}

// ---------- adding photos ----------
function refreshMessages(extra: string[]): void {
  const count = photos.length ? validateCount(photos.length) : null;
  const msgs = count ? [...extra, count] : extra;
  if (msgs.length) showError(errorBox, msgs.join(' '));
  else clearError(errorBox);
}

let addQueue: Promise<void> = Promise.resolve();
/** Adds run one after another so the 10-photo limit is checked against the real count. */
function addFiles(list: File[]): Promise<void> {
  addQueue = addQueue.then(() => addFilesNow(list)).catch(() => undefined);
  return addQueue;
}

async function addFilesNow(list: File[]): Promise<void> {
  const msgs: string[] = [];
  let valid: File[] = [];
  for (const f of list) {
    const err = validateFile(f);
    if (err) msgs.push(err);
    else valid.push(f);
  }
  const room = MAX_PHOTOS - photos.length;
  if (valid.length > room) {
    msgs.push(`Layout takes at most ${MAX_PHOTOS} photos; ${valid.length - room} not added.`);
    valid = valid.slice(0, room);
  }
  // One full-size decode at a time keeps peak memory at a single photo.
  for (const f of valid) {
    try {
      photos.push(await loadPhoto(f, 1600));
    } catch {
      msgs.push(`${f.name}: could not be read as an image.`);
    }
  }
  swaps = [];
  refreshMessages(msgs);
  renderThumbs();
  scheduleRender();
}

// ---------- wiring ----------
const drop = $('drop');
const input = $<HTMLInputElement>('files');
input.addEventListener('change', () => {
  void addFiles([...(input.files ?? [])]);
  input.value = '';
});
drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', (e) => {
  e.preventDefault();
  drop.classList.remove('over');
  void addFiles([...(e.dataTransfer?.files ?? [])]);
});

$('unit').addEventListener('change', (e) => {
  s.unit = (e.target as HTMLInputElement).value as Unit;
  syncInputs();
  persist();
});
$('preset').addEventListener('change', () => {
  const p = PRESETS.find((x) => x.id === $<HTMLSelectElement>('preset').value);
  if (!p) return;
  s.wMm = p.wMm;
  s.hMm = p.hMm;
  syncInputs();
  changed();
});
for (const [id, key] of [['w', 'wMm'], ['h', 'hMm']] as const) {
  $(id).addEventListener('input', () => {
    const mm = toMm(parseFloat($<HTMLInputElement>(id).value), s.unit);
    if (!Number.isFinite(mm) || mm < 1 || mm > 5000) return;
    s[key] = mm;
    $<HTMLSelectElement>('preset').value = matchPreset();
    changed();
  });
}
$('flip').addEventListener('click', () => {
  Object.assign(s, flip(s));
  syncInputs();
  changed();
});
$('dpi-preset').addEventListener('change', () => {
  const v = Number($<HTMLSelectElement>('dpi-preset').value);
  if (!Number.isFinite(v)) return $('dpi').focus();
  s.dpi = v;
  syncInputs();
  changed();
});
$('dpi').addEventListener('input', () => {
  const v = parseFloat($<HTMLInputElement>('dpi').value);
  if (!Number.isFinite(v) || v < 36 || v > 1200) return;
  s.dpi = Math.round(v);
  $<HTMLSelectElement>('dpi-preset').value = DPI_PRESETS.includes(s.dpi) ? String(s.dpi) : 'custom';
  changed();
});
for (const [id, key] of [['margin', 'marginMm'], ['gap', 'gapMm']] as const) {
  $(id).addEventListener('input', () => {
    s[key] = Number($<HTMLInputElement>(id).value);
    $(`${id}-out`).textContent = `${s[key]} mm`;
    changed();
  });
}
$('bg').addEventListener('change', (e) => {
  s.bg = (e.target as HTMLInputElement).value;
  changed();
});
$('shuffle').addEventListener('click', () => {
  seed = nextSeed(seed);
  changed(true);
});
const EXPORTS: [string, Format][] = [['export-png', 'png'], ['export-jpg', 'jpg'], ['export-pdf', 'pdf']];
for (const [id, format] of EXPORTS) {
  $(id).addEventListener('click', async () => {
    if (exporting) return;
    const status = $('export-status');
    exporting = true;
    for (const [b] of EXPORTS) $<HTMLButtonElement>(b).disabled = true;
    try {
      // snapshot: photos may be removed or re-laid-out while the export runs
      const { blob, plan } = await renderExport({
        photos: [...photos], cells: cells.map((c) => ({ ...c })), wMm: s.wMm, hMm: s.hMm, dpi: s.dpi, bg: s.bg, format,
        onProgress: (d, t) => (status.textContent = `Rendering ${d} of ${t}…`),
      });
      download(blob, exportFilename(s.wMm, s.hMm, plan.dpi, format));
      status.textContent = `Saved ${(blob.size / 1e6).toFixed(1)} MB at ${plan.pxW} × ${plan.pxH} px.`;
    } catch (err) {
      status.textContent = '';
      showError(errorBox, err instanceof Error ? err.message : 'Export failed.');
    } finally {
      exporting = false;
      scheduleRender(); // re-enables the buttons for a valid photo count
    }
  });
}
new ResizeObserver(scheduleRender).observe(wrap);

syncInputs();
renderThumbs();
scheduleRender();
