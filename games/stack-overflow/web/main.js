/**
 * Stack Overflow: the page around the Zig rules. zig/wasm.zig is compiled to game.wasm, a module with plain exports
 * and no imports; this file calls them, reads the stack from its memory, and draws it as a growing stack trace.
 */
import '@fontsource-variable/jetbrains-mono';
import './style.css';
import wasmUrl from '../game.wasm?url';
import { followHub, initialLang, loadBest, saveBest } from './host.js';

const PHASES = ['ready', 'playing', 'segfault', 'overflow'];
const DROPS = ['none', 'cut', 'perfect', 'tailCall', 'missed'];

const TEXT = {
  en: {
    depth: 'depth',
    score: 'score',
    best: 'best',
    tagline: 'Drop each stack frame onto the one below. Whatever hangs over is cut off.',
    how: 'Space, Enter, click or tap to drop. Three perfect drops in a row and tail call optimization gives you some width back. Reach 64 frames deep, and the stack overflows. That is the goal.',
    start: 'Press Space or tap to call main()',
    perfect: 'perfect',
    tailCall: 'tail call optimized: +width',
    segfault: 'Segmentation fault (core dumped)',
    segfaultSub: 'at depth {depth}: that frame landed on nothing.',
    question: 'Q: Why does my call stack keep growing?',
    answer: '✓ Accepted answer: you recursed {depth} frames deep and overflowed the stack. Score {score}.',
    newBest: 'New best score!',
    again: 'Press Space or tap to try again'
  },
  nl: {
    depth: 'diepte',
    score: 'score',
    best: 'record',
    tagline: 'Laat elk stackframe op het frame eronder vallen. Wat uitsteekt, wordt eraf geknipt.',
    how: 'Spatie, Enter, klik of tik om te laten vallen. Drie keer perfect op rij en tail call optimization geeft je wat breedte terug. Haal 64 frames diep, en de stack loopt over. Dat is het doel.',
    start: 'Druk op spatie of tik om main() aan te roepen',
    perfect: 'perfect',
    tailCall: 'tail call optimized: +breedte',
    segfault: 'Segmentation fault (core dumped)',
    segfaultSub: 'op diepte {depth}: dat frame landde op niets.',
    question: 'V: Waarom blijft mijn call stack groeien?',
    answer: '✓ Geaccepteerd antwoord: je ging {depth} frames diep en liet de stack overlopen. Score {score}.',
    newBest: 'Nieuw record!',
    again: 'Druk op spatie of tik om het opnieuw te proberen'
  }
};

// every frame is a line of a stack trace; after a while it's recursion all the way up
const CALLS = [
  ['main', 'index.js'],
  ['bootstrap', 'index.js'],
  ['createApp', 'app.js'],
  ['render', 'react-dom.js'],
  ['useEffect', 'react-dom.js'],
  ['fetchData', 'api.js'],
  ['handleResponse', 'api.js'],
  ['parseJSON', 'utils.js'],
  ['retry', 'api.js'],
  ['retry', 'api.js'],
  ['retry', 'api.js'],
  ['logError', 'logger.js'],
  ['formatError', 'logger.js'],
  ['toString', 'logger.js'],
  ['recurse', 'recurse.js']
];
const label = (i) => {
  const [fn, file] = CALLS[Math.min(i, CALLS.length - 1)];
  return `at ${fn} (${file}:${i < CALLS.length ? 7 + ((i * 13) % 90) : 3})`;
};

/** Frame height in canvas pixels: about 22 frames fit on screen, whatever the size or pixel ratio. */
let FRAME_H = 24;
const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));
const stage = $('stage');
const canvas = /** @type {HTMLCanvasElement} */ ($('view'));
const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));

const { instance } = await WebAssembly.instantiateStreaming(fetch(wasmUrl), {});
const zig = /** @type {any} */ (instance.exports);
const WORLD = zig.world_width();
const MAX = zig.max_depth();

let lang = initialLang();
/** ?demo=N plays itself, perfectly, until the stack is N frames deep (for the share image and the tests) */
const demo = Number(new URLSearchParams(location.search).get('demo')) || 0;
let demoOff = 0;
let best = loadBest();
/** @type {'title' | 'playing' | 'segfault' | 'overflow'} */
let mode = 'title';
let newBest = false;
/** when the last run ended: a press right after that shouldn't start a new one by accident */
let endedAt = -Infinity;
let camera = 0;
let toastTime = 0;
/** @type {{ x: number, y: number, w: number, vy: number, depth: number }[]} */
let debris = [];

const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
const t = () => TEXT[lang];
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const frames = () => new Float32Array(zig.memory.buffer, zig.frames_ptr(), MAX * 2);

function applyLang() {
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll('[data-t]')) el.textContent = t()[/** @type {HTMLElement} */ (el).dataset.t ?? ''];
  overlay();
}

function overlay() {
  stage.dataset.phase = mode;
  const d = zig.depth();
  const set = (title, sub, how, hint) => {
    $('o-title').textContent = title;
    $('o-sub').textContent = sub;
    $('o-how').textContent = how;
    $('o-hint').textContent = hint;
  };
  $('card').classList.toggle('answer', mode === 'overflow');
  if (mode === 'title') set('Stack Overflow', t().tagline, t().how, t().start);
  else if (mode === 'segfault') set(t().segfault, fill(t().segfaultSub, { depth: d }), newBest ? t().newBest : '', t().again);
  else if (mode === 'overflow') set(t().question, fill(t().answer, { depth: d, score: zig.score() }), newBest ? t().newBest : '', t().again);
  else set('', '', '', '');
}

function hud() {
  $('depth').textContent = String(zig.depth());
  /** @type {HTMLMeterElement} */ ($('meter')).value = zig.depth();
  $('score').textContent = String(zig.score());
  $('best').textContent = String(best);
  stage.dataset.depth = String(zig.depth());
  stage.dataset.score = String(zig.score());
}

function toast(text) {
  $('toast').textContent = text;
  toastTime = 1.2;
}

function start() {
  zig.start();
  mode = 'playing';
  newBest = false;
  debris = [];
  camera = 0;
  overlay();
  hud();
}

function drop() {
  if (mode !== 'playing') return;
  const beforeX = zig.slider_x();
  const beforeW = zig.slider_w();
  const d = zig.depth();
  zig.drop();
  const what = DROPS[zig.last_drop()];
  if (what === 'cut') {
    // the part that hung over falls away
    const f = frames();
    const nx = f[d * 2];
    const nw = f[d * 2 + 1];
    const piece = beforeX < nx ? { x: beforeX, w: nx - beforeX } : { x: nx + nw, w: beforeX + beforeW - (nx + nw) };
    debris.push({ ...piece, y: d * FRAME_H, vy: 0, depth: d });
  } else if (what === 'perfect') toast(t().perfect);
  else if (what === 'tailCall') toast(t().tailCall);
  else if (what === 'missed') debris.push({ x: beforeX, w: beforeW, y: d * FRAME_H, vy: 0, depth: d });
  const phase = PHASES[zig.phase()];
  if (phase === 'segfault' || phase === 'overflow') {
    mode = phase;
    endedAt = performance.now();
    if (zig.score() > best) {
      best = zig.score();
      newBest = true;
      saveBest(best);
    }
    overlay();
  }
  hud();
}

// ---------- drawing ----------

function colour(i) {
  // cool at the bottom of the stack, hot near the limit
  const k = i / (MAX - 1);
  return k < 0.6 ? css('--cool') : k < 0.85 ? css('--warm') : css('--hot');
}

function drawFrame(x, w, i, sx, groundY) {
  const y = groundY - (i + 1) * FRAME_H;
  ctx.fillStyle = colour(i);
  ctx.fillRect(x * sx, y + 1, w * sx, FRAME_H - 2);
  ctx.fillStyle = css('--on-frame');
  ctx.save();
  ctx.beginPath();
  ctx.rect(x * sx + 4, y, Math.max(0, w * sx - 8), FRAME_H);
  ctx.clip();
  ctx.fillText(label(i), x * sx + 8, y + FRAME_H * 0.68);
  ctx.restore();
}

function draw(dt) {
  const W = canvas.width;
  const H = canvas.height;
  const sx = W / WORLD;
  const depth = zig.depth();
  // keep the top of the stack in view
  const want = Math.max(0, (depth + 3) * FRAME_H - H * 0.7);
  camera += (want - camera) * Math.min(1, dt * 6);
  const groundY = H + camera;

  ctx.fillStyle = css('--bg');
  ctx.fillRect(0, 0, W, H);
  // the stack limit
  const limitY = groundY - MAX * FRAME_H;
  if (limitY > -10) {
    ctx.strokeStyle = css('--hot');
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(0, limitY);
    ctx.lineTo(W, limitY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = css('--hot');
    ctx.fillText('RangeError: Maximum call stack size exceeded', 10, limitY - 8);
  }

  ctx.font = `${Math.round(FRAME_H * 0.5)}px "JetBrains Mono Variable", monospace`;
  const f = frames();
  for (let i = 0; i < depth; i++) drawFrame(f[i * 2], f[i * 2 + 1], i, sx, groundY);
  if (mode === 'playing') drawFrame(zig.slider_x(), zig.slider_w(), depth, sx, groundY);

  // cut-off pieces fall
  for (const p of debris) {
    p.vy += 1400 * dt;
    p.y -= p.vy * dt;
    ctx.globalAlpha = 0.7;
    drawFrame(p.x, p.w, p.depth, sx, groundY + (p.depth * FRAME_H - p.y));
    ctx.globalAlpha = 1;
  }
  debris = debris.filter((p) => p.depth * FRAME_H - p.y < H + camera + 100);
}

function resize() {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round(r.width * dpr));
  canvas.height = Math.max(1, Math.round(r.height * dpr));
  FRAME_H = Math.max(16, canvas.height / 22);
}

let prev = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - prev) / 1000);
  prev = now;
  if (mode === 'playing') zig.step(dt * 1000);
  if (demo && mode === 'title') start();
  if (demo && mode === 'playing' && zig.depth() < demo) {
    // drop the moment the frame lines up with (or slides past) the one below
    const off = zig.slider_x() - frames()[(zig.depth() - 1) * 2];
    if (Math.abs(off) < 3 || off * demoOff < 0) drop();
    demoOff = zig.slider_x() - frames()[(zig.depth() - 1) * 2];
  }
  toastTime = Math.max(0, toastTime - dt);
  $('toast').classList.toggle('show', toastTime > 0);
  draw(dt);
  requestAnimationFrame(frame);
}

// ---------- input ----------

function primary() {
  if (mode === 'playing') drop();
  else if (performance.now() - endedAt > 600) start();
}
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
  if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowDown') {
    e.preventDefault();
    primary();
  }
});
stage.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  primary();
});

new ResizeObserver(resize).observe(canvas);
followHub((l) => {
  lang = l;
  applyLang();
});
zig.start();
resize();
applyLang();
hud();
requestAnimationFrame(frame);
