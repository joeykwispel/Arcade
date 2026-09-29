/**
 * Merge Conflict Tetris: the page around the Go game. go/wasm/main.go is compiled by TinyGo to game.wasm, a module
 * with plain exported functions and no imports; this file calls them, reads the state from its memory and draws it.
 */
import '@fontsource-variable/jetbrains-mono';
import './style.css';
import wasmUrl from '../game.wasm?url';
import { followHub, initialLang, loadBest, saveBest } from './host.js';

const W = 10;
const H = 20;
// offsets into the state buffer, as in go/wasm/main.go
const S = { phase: 0, score: 1, lines: 2, level: 3, choiceLeft: 4, choiceTime: 5, side: 9, cleared: 10, ff: 11, cur: 16, ghost: 24, ours: 32, theirs: 40 };
const PHASES = ['choosing', 'falling', 'over'];
const INPUT = { left: 1, right: 2, rotate: 3, soft: 4, hard: 5 };

const TEXT = {
  en: {
    conflict: 'CONFLICT',
    current: 'Accept Current Change',
    incoming: 'Accept Incoming Change',
    both: 'Accept Both Changes',
    currentShort: '(Current Change)',
    incomingShort: '(Incoming Change)',
    score: 'score',
    lines: 'lines',
    level: 'level',
    best: 'best',
    tagline: 'Every piece is a merge conflict. Pick a side, fast.',
    how: '↑ or 1: current change · ↓ or 2: incoming · Space or 3: both (double the trouble). Then ← → move, ↑ rotate, ↓ drop, Space slams. Too slow, and git keeps both.',
    start: 'Press Space or tap to start the merge',
    over: 'fatal: Exiting because of an unresolved conflict.',
    result: 'score {score} · {lines} lines · {ff} fast-forwards',
    newBest: 'New best score!',
    again: 'Press Space or tap to try again',
    paused: 'git merge --pause',
    resume: 'Press Space or tap to go on'
  },
  nl: {
    conflict: 'CONFLICT',
    current: 'Huidige wijziging accepteren',
    incoming: 'Inkomende wijziging accepteren',
    both: 'Beide wijzigingen accepteren',
    currentShort: '(Huidige wijziging)',
    incomingShort: '(Inkomende wijziging)',
    score: 'score',
    lines: 'regels',
    level: 'level',
    best: 'record',
    tagline: 'Elk blok is een mergeconflict. Kies een kant, snel.',
    how: '↑ of 1: huidige wijziging · ↓ of 2: inkomende · spatie of 3: beide (dubbele ellende). Dan ← → schuiven, ↑ draaien, ↓ zakken, spatie knalt hem neer. Te traag, en git houdt ze allebei.',
    start: 'Druk op spatie of tik om de merge te starten',
    over: 'fatal: Exiting because of an unresolved conflict.',
    result: 'score {score} · {lines} regels · {ff} fast-forwards',
    newBest: 'Nieuw record!',
    again: 'Druk op spatie of tik om het opnieuw te proberen',
    paused: 'git merge --pause',
    resume: 'Druk op spatie of tik om verder te gaan'
  }
};

// a line of code for every row, so the board reads like the file you're merging
const CODE = [
  'import { merge } from "git";',
  'const ours = await load("HEAD");',
  'const theirs = await load("main");',
  'if (ours === theirs) return ours;',
  'for (const hunk of diff(a, b)) {',
  '  if (hunk.conflict) panic();',
  '  else apply(hunk);',
  '}',
  'export default resolve(ours);',
  '// TODO: this can never happen',
  'try { rebase(); } catch {}',
  'const x = y ?? z ?? 42;',
  'console.log("here 2");',
  'return new Promise(r => r());',
  'let i = 0; while (i < 10) i++;',
  'fetch(url).then(r => r.json());',
  'user?.profile?.name ?? "anon";',
  '/* eslint-disable */',
  'await sleep(1000); // flaky fix',
  'module.exports = { merge };'
];

const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));
const stage = $('stage');
const canvas = /** @type {HTMLCanvasElement} */ ($('board'));
const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
const timer = /** @type {HTMLProgressElement} */ ($('timer'));

let lang = initialLang();
let best = loadBest();
/** @type {'title' | 'playing' | 'paused' | 'over'} */
let mode = 'title';
let newBest = false;
let flash = 0;
let flashRows = 0;
let lastCleared = 0;
let lastPhase = -1;

const { instance } = await WebAssembly.instantiateStreaming(fetch(wasmUrl), {});
const wasm = /** @type {any} */ (instance.exports);
wasm._initialize();
const state = () => new Int32Array(wasm.memory.buffer, wasm.state_ptr(), 48);
const board = () => new Uint8Array(wasm.memory.buffer, wasm.board_ptr(), W * H);

const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

function applyLang() {
  const t = TEXT[lang];
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll('[data-t]')) el.textContent = t[/** @type {HTMLElement} */ (el).dataset.t ?? ''];
  $('best').textContent = String(best);
  overlay();
}

function overlay() {
  const t = TEXT[lang];
  stage.dataset.phase = mode === 'playing' ? PHASES[state()[S.phase]] : mode;
  const s = state();
  const lines = {
    title: ['Merge Conflict Tetris', t.tagline, t.how, t.start],
    paused: [t.paused, '', '', t.resume],
    over: [t.over, fill(t.result, { score: s[S.score], lines: s[S.lines], ff: s[S.ff] }), newBest ? t.newBest : '', t.again],
    playing: ['', '', '', '']
  }[mode];
  $('o-title').textContent = lines[0];
  $('o-sub').textContent = lines[1];
  $('o-how').textContent = lines[2];
  $('o-hint').textContent = lines[3];
}

function start() {
  wasm.start((Date.now() % 2 ** 31) | 1);
  wasm.update();
  mode = 'playing';
  newBest = false;
  lastCleared = 0;
  overlay();
}

function choose(c) {
  if (mode !== 'playing' || state()[S.phase] !== 0) return;
  wasm.choose(c);
  wasm.update();
  const t = TEXT[lang];
  $('live').textContent = [t.current, t.incoming, t.both][c - 1];
}

function act(a) {
  if (mode !== 'playing') return;
  wasm.input(a);
  wasm.update();
}

// ---------- drawing ----------

function cellSize() {
  return canvas.height / H;
}

function drawCell(x, y, side, alpha = 1, outline = false) {
  const c = cellSize();
  const gutter = canvas.width - W * c;
  const px = gutter + x * c;
  const py = y * c;
  const color = side === 1 ? css('--ours') : css('--theirs');
  ctx.globalAlpha = alpha;
  if (outline) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 2, py + 2, c - 4, c - 4);
  } else {
    ctx.fillStyle = color;
    ctx.fillRect(px + 1, py + 1, c - 2, c - 2);
    // the code underneath shows through
    ctx.fillStyle = css('--on-cell');
    ctx.font = `${Math.round(c * 0.55)}px "JetBrains Mono Variable", monospace`;
    ctx.fillText(CODE[y % CODE.length][x] ?? ' ', px + c * 0.3, py + c * 0.7);
  }
  ctx.globalAlpha = 1;
}

function draw() {
  const s = state();
  const b = board();
  const c = cellSize();
  const gutter = canvas.width - W * c;
  ctx.fillStyle = css('--editor');
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // line numbers and faint code
  ctx.font = `${Math.round(c * 0.45)}px "JetBrains Mono Variable", monospace`;
  for (let y = 0; y < H; y++) {
    ctx.fillStyle = css('--gutter');
    ctx.textAlign = 'right';
    ctx.fillText(String(y + 1), gutter - 6, y * c + c * 0.68);
    ctx.textAlign = 'left';
  }
  ctx.strokeStyle = css('--grid');
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(gutter + 0.5, 0);
  ctx.lineTo(gutter + 0.5, canvas.height);
  ctx.stroke();

  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (b[y * W + x]) drawCell(x, y, b[y * W + x]);

  if (mode === 'playing' && s[S.phase] === 1) {
    for (let i = 0; i < 4; i++) drawCell(s[S.ghost + 2 * i], s[S.ghost + 2 * i + 1], s[S.side], 0.5, true);
    for (let i = 0; i < 4; i++) {
      const y = s[S.cur + 2 * i + 1];
      if (y >= 0) drawCell(s[S.cur + 2 * i], y, s[S.side]);
    }
  }
  // rows that just merged flash
  if (flash > 0) {
    ctx.fillStyle = css('--text');
    ctx.globalAlpha = flash * 0.6;
    for (let y = 0; y < H; y++) if (flashRows & (1 << y)) ctx.fillRect(gutter, y * c, W * c, c);
    ctx.globalAlpha = 1;
  }
}

function drawPreview(id, offset, side) {
  const cv = /** @type {HTMLCanvasElement} */ ($(id));
  const g = /** @type {CanvasRenderingContext2D} */ (cv.getContext('2d'));
  const s = state();
  g.clearRect(0, 0, cv.width, cv.height);
  const size = 24;
  const xs = [0, 1, 2, 3].map((i) => s[offset + 2 * i]);
  const ys = [0, 1, 2, 3].map((i) => s[offset + 2 * i + 1]);
  const w = (Math.max(...xs) - Math.min(...xs) + 1) * size;
  const h = (Math.max(...ys) - Math.min(...ys) + 1) * size;
  g.fillStyle = side === 1 ? css('--ours') : css('--theirs');
  for (let i = 0; i < 4; i++) {
    g.fillRect((cv.width - w) / 2 + (xs[i] - Math.min(...xs)) * size + 1, (cv.height - h) / 2 + (ys[i] - Math.min(...ys)) * size + 1, size - 2, size - 2);
  }
}

function hud() {
  const s = state();
  $('score').textContent = String(s[S.score]);
  $('lines').textContent = String(s[S.lines]);
  $('level').textContent = String(s[S.level]);
  $('ff').textContent = String(s[S.ff]);
  const choosing = mode === 'playing' && s[S.phase] === 0;
  $('conflict').classList.toggle('open', choosing);
  timer.value = choosing ? Math.max(0, s[S.choiceLeft] / s[S.choiceTime]) : 0;
  if (choosing) {
    drawPreview('prev-ours', S.ours, 1);
    drawPreview('prev-theirs', S.theirs, 2);
  }
  stage.dataset.score = String(s[S.score]);
  stage.dataset.lines = String(s[S.lines]);
}

// ---------- the loop ----------

let prev = performance.now();
function frame(now) {
  const dt = Math.min(100, now - prev);
  prev = now;
  if (mode === 'playing') {
    wasm.tick(Math.round(dt));
    wasm.update();
    const s = state();
    if (s[S.cleared] && s[S.cleared] !== lastCleared) {
      flashRows = s[S.cleared];
      flash = 1;
    }
    lastCleared = s[S.cleared];
    if (s[S.phase] === 2) {
      mode = 'over';
      if (s[S.score] > best) {
        best = s[S.score];
        newBest = true;
        saveBest(best);
        $('best').textContent = String(best);
      }
    }
    if (s[S.phase] !== lastPhase) {
      lastPhase = s[S.phase];
      overlay();
    }
  }
  flash = Math.max(0, flash - dt / 250);
  draw();
  hud();
  requestAnimationFrame(frame);
}

// ---------- input ----------

function primary() {
  if (mode === 'title' || mode === 'over') start();
  else if (mode === 'paused') {
    mode = 'playing';
    overlay();
  }
}

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key;
  if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
  if (mode !== 'playing') {
    if (k === ' ' || k === 'Enter') primary();
    return;
  }
  if (k === 'p' || k === 'P' || k === 'Escape') {
    mode = 'paused';
    overlay();
    return;
  }
  const choosing = state()[S.phase] === 0;
  if (choosing) {
    if (k === 'ArrowUp' || k === '1') choose(1);
    else if (k === 'ArrowDown' || k === '2') choose(2);
    else if (k === ' ' || k === '3') choose(3);
    return;
  }
  const map = {
    ArrowLeft: INPUT.left,
    a: INPUT.left,
    ArrowRight: INPUT.right,
    d: INPUT.right,
    ArrowUp: INPUT.rotate,
    w: INPUT.rotate,
    ArrowDown: INPUT.soft,
    s: INPUT.soft,
    ' ': INPUT.hard
  };
  if (k in map && !(k === ' ' && e.repeat)) act(map[k]);
});

$('overlay').addEventListener('click', primary);
$('ours').addEventListener('click', () => choose(1));
$('theirs').addEventListener('click', () => choose(2));
$('both').addEventListener('click', () => choose(3));
for (const b of document.querySelectorAll('[data-input]')) {
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    act(Number(/** @type {HTMLElement} */ (b).dataset.input));
  });
}

// swipes on the board: left/right move, up rotates, down drops; a tap rotates
let touch = /** @type {{ x: number, y: number } | null} */ (null);
canvas.addEventListener('pointerdown', (e) => {
  touch = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('pointerup', (e) => {
  if (!touch) return;
  const dx = e.clientX - touch.x;
  const dy = e.clientY - touch.y;
  touch = null;
  if (mode !== 'playing') return primary();
  if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return act(INPUT.rotate);
  if (Math.abs(dx) > Math.abs(dy)) {
    const steps = Math.max(1, Math.round(Math.abs(dx) / (canvas.getBoundingClientRect().width / W)));
    for (let i = 0; i < steps; i++) act(dx > 0 ? INPUT.right : INPUT.left);
  } else act(dy > 0 ? INPUT.hard : INPUT.rotate);
});

window.addEventListener('blur', () => {
  if (mode === 'playing') {
    mode = 'paused';
    overlay();
  }
});

followHub((l) => {
  lang = l;
  applyLang();
});
wasm.start(1);
wasm.update();
applyLang();
requestAnimationFrame(frame);
