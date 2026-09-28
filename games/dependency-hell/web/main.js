/**
 * Dependency Hell: the page side. The game (rules and Box2D physics) is C++ compiled to WebAssembly; this file loads
 * it, forwards input, and draws what it reports each frame: the packages, the crane, the platform. Plus the HUD,
 * theme and language from the hub, and the best height in localStorage.
 */
import '@fontsource-variable/jetbrains-mono';
import './style.css';
import createModule from './build/dh.mjs';

const BEST_KEY = 'play:dependency-hell:best';
const MONO = "'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace";
const PHASES = ['ready', 'running', 'paused', 'over'];
const EVENT = { landed: 1, fell: 2, unpublished: 4, newBest: 8, over: 16 };

const TEXT = {
  en: {
    title: 'Dependency Hell',
    tagline: 'Stack npm packages as high as you can. Mind left-pad.',
    start: 'Press Space or tap to npm install',
    controls: '← → move · Space or ↓ drop · ↑ or R rotate · P pause. On a phone: drag to move, the buttons to drop and rotate.',
    paused: 'Paused',
    resume: 'Space or tap to continue',
    over: 'npm ERR! ERESOLVE could not resolve dependency tree',
    result: 'Your tower reached {h} m, {n} packages deep.',
    newBest: 'New best: {h} m!',
    retry: '> rm -rf node_modules && npm install  (Space or tap)',
    height: 'height',
    best: 'best',
    size: 'node_modules',
    conflicts: 'conflicts',
    next: 'next',
    drop: 'drop',
    rotate: 'rotate',
    unpublished: '⚠ {name} was unpublished!',
    fell: '✗ peer dependency conflict: a package fell off',
    sayOver: 'Game over. Your tower reached {h} meters.'
  },
  nl: {
    title: 'Dependency Hell',
    tagline: 'Stapel npm-packages zo hoog als je kunt. Let op left-pad.',
    start: 'Druk op spatie of tik voor npm install',
    controls:
      '← → bewegen · spatie of ↓ laten vallen · ↑ of R draaien · P pauze. Op je telefoon: sleep om te bewegen, de knoppen om te laten vallen en te draaien.',
    paused: 'Gepauzeerd',
    resume: 'Spatie of tik om verder te gaan',
    over: 'npm ERR! ERESOLVE could not resolve dependency tree',
    result: 'Je toren haalde {h} m, {n} packages diep.',
    newBest: 'Nieuw record: {h} m!',
    retry: '> rm -rf node_modules && npm install  (spatie of tik)',
    height: 'hoogte',
    best: 'record',
    size: 'node_modules',
    conflicts: 'conflicten',
    next: 'volgende',
    drop: 'laat vallen',
    rotate: 'draai',
    unpublished: '⚠ {name} is ge-unpublished!',
    fell: '✗ peer dependency conflict: er viel een package af',
    sayOver: 'Game over. Je toren haalde {h} meter.'
  }
};
const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (m, k) => String(vars[k] ?? m));

const $ = (id) => document.getElementById(id);
const stage = $('stage');
const canvas = $('game');
const ctx = canvas.getContext('2d');

const store = {
  get(k) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode */
    }
  }
};

const params = new URLSearchParams(location.search);
let lang = ['en', 'nl'].includes(params.get('lang')) ? params.get('lang') : navigator.language.startsWith('nl') ? 'nl' : 'en';
document.documentElement.lang = lang;
if (window.top === window.self) document.documentElement.classList.add('standalone');

let colors = {};
const COLOR_NAMES = ['bg', 'panel', 'grid', 'text', 'muted', 'faint', 'accent', 'danger', 'warn', 'ink'];
const PALETTE = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
function readColors() {
  const cs = getComputedStyle(document.documentElement);
  for (const n of [...COLOR_NAMES, ...PALETTE]) colors[n] = cs.getPropertyValue(`--c-${n}`).trim();
}
function setTheme(theme) {
  document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark';
  readColors();
}
setTheme(document.cookie.match(/(?:^|; )jo-theme=(dark|light)/)?.[1] ?? store.get('theme'));

// ---------- the module ----------

let M;
let kinds = [];
let best = Number(store.get(BEST_KEY)) || 0;
let message = { text: '', until: 0, bad: false };
let endedAt = 0;

function newGame() {
  M._dh_new((Math.random() * 2 ** 32) >>> 0);
}

// ---------- HUD ----------

const phase = () => PHASES[M._dh_phase()];

function showOverlay() {
  const t = TEXT[lang];
  const p = phase();
  $('overlay').hidden = p === 'running';
  $('overlay').dataset.phase = p;
  stage.dataset.phase = p;
  const h = M._dh_best().toFixed(1);
  const [title, sub, hint, small] =
    p === 'ready'
      ? [t.title, t.tagline, t.start, t.controls]
      : p === 'paused'
        ? [t.paused, '', t.resume, '']
        : p === 'over'
          ? [t.over, M._dh_best() > best - 0.001 && M._dh_best() > 0 ? fill(t.newBest, { h }) : fill(t.result, { h, n: M._dh_stacked() }), t.retry, '']
          : ['', '', '', ''];
  $('title').textContent = title;
  $('sub').textContent = sub;
  $('hint').textContent = hint;
  $('small').textContent = small;
  $('drop').textContent = t.drop;
  $('rotate').textContent = t.rotate;
}

let hudAt = 0;
function hud(now) {
  if (now - hudAt < 100) return;
  hudAt = now;
  const t = TEXT[lang];
  $('height').textContent = `${t.height} ${M._dh_height().toFixed(1)} m`;
  $('best').textContent = `${t.best} ${Math.max(best, M._dh_best()).toFixed(1)} m`;
  $('size').textContent = `${t.size} ${M._dh_stacked() * 37} MB`;
  const fallen = M._dh_fallen();
  $('conflicts').textContent = `${t.conflicts} ${'✗'.repeat(fallen)}${'·'.repeat(M._dh_max_fallen() - fallen)}`;
  $('next').textContent = `${t.next}: ${kinds[M._dh_next()].name}`;
  const msg = $('message');
  msg.textContent = now < message.until ? message.text : '';
  msg.classList.toggle('bad', message.bad);
}

// ---------- drawing ----------

let view = { w: 0, h: 0, scale: 40, dpr: 1, camY: -2 };

function fit() {
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  // about 13 m across, or 11 m tall, whichever fits
  view = { ...view, w: r.width, h: r.height, dpr, scale: Math.min(r.width / 13, r.height / 11) };
}

// world (meters, y up) to screen (pixels, y down)
const sx = (x) => view.w / 2 + x * view.scale;
const sy = (y) => view.h - (y - view.camY) * view.scale;

function box(x, y, hw, hh, angle, fillColor, stroke, label, alpha = 1) {
  const s = view.scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(sx(x), sy(y));
  ctx.rotate(-angle);
  ctx.fillStyle = fillColor;
  ctx.beginPath();
  ctx.roundRect(-hw * s, -hh * s, hw * 2 * s, hh * 2 * s, Math.min(6, hh * s * 0.4));
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  if (label) {
    // the name runs along the longer side, and never upside down, however the package landed
    let turn = hh > hw ? -Math.PI / 2 : 0;
    const total = Math.atan2(Math.sin(-angle + turn), Math.cos(-angle + turn));
    if (Math.abs(total) > Math.PI / 2) turn += Math.PI;
    ctx.rotate(turn);
    const long = Math.max(hw, hh) * 2 * s;
    const short = Math.min(hw, hh) * 2 * s;
    const size = Math.min(short * 0.55, (long * 0.9) / (label.length * 0.62), 18);
    ctx.font = `700 ${size}px ${MONO}`;
    ctx.fillStyle = colors.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 1);
  }
  ctx.restore();
}

function draw(time) {
  const { dpr, w, h, scale } = view;
  // the camera keeps the crane near the top of the view, and never goes below the platform
  const target = Math.max(-1.6, M._dh_crane_y() + 1.8 - h / scale);
  view.camY += (target - view.camY) * 0.08;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, w, h);

  // a faint 1 m grid with height marks on the left
  ctx.strokeStyle = colors.grid;
  ctx.fillStyle = colors.faint;
  ctx.lineWidth = 1;
  ctx.font = `500 11px ${MONO}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  for (let y = Math.floor(view.camY); y < view.camY + h / scale + 1; y++) {
    ctx.beginPath();
    ctx.moveTo(0, sy(y));
    ctx.lineTo(w, sy(y));
    ctx.stroke();
    if (y > 0 && y % 2 === 0) ctx.fillText(`${y} m`, 6, sy(y) - 2);
  }

  // node_modules/: the platform, and the drop past its edges
  const half = M._dh_platform_half();
  ctx.fillStyle = colors.panel;
  ctx.fillRect(sx(-half), sy(0), half * 2 * scale, scale * 1.2);
  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(sx(-half), sy(0));
  ctx.lineTo(sx(half), sy(0));
  ctx.stroke();
  ctx.fillStyle = colors.accent;
  ctx.font = `700 ${Math.min(16, scale * 0.4)}px ${MONO}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('node_modules/', sx(0), sy(-0.55));
  ctx.setLineDash([4, 6]);
  ctx.strokeStyle = colors.danger;
  ctx.globalAlpha = 0.5;
  for (const x of [-half, half]) {
    ctx.beginPath();
    ctx.moveTo(sx(x), sy(0));
    ctx.lineTo(sx(x), h);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // the packages
  const n = M._dh_frame();
  const f = new Float32Array(M.HEAPF32.buffer, M._dh_frame_ptr(), n * 7);
  for (let i = 0; i < n; i++) {
    const [kind, x, y, angle, hw, hh, landed] = f.subarray(i * 7, i * 7 + 7);
    const k = kinds[kind];
    box(x, y, hw, hh, angle, colors[PALETTE[kind % PALETTE.length]], null, k.name, landed ? 1 : 0.9);
  }

  // the crane: a rail, the trolley, the rope, and the package waiting to drop
  const cx = M._dh_crane_x();
  const cy = M._dh_crane_y();
  ctx.strokeStyle = colors.muted;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(sx(-6.5), sy(cy + 0.6));
  ctx.lineTo(sx(6.5), sy(cy + 0.6));
  ctx.stroke();
  ctx.fillStyle = colors.text;
  ctx.fillRect(sx(cx) - 12, sy(cy + 0.6) - 6, 24, 12);
  if (phase() !== 'over') {
    const kind = M._dh_current();
    const k = kinds[kind];
    const rot = M._dh_current_rotated();
    const hw = (rot ? k.h : k.w) / 2;
    const hh = (rot ? k.w : k.h) / 2;
    const ready = M._dh_ready();
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx(cx), sy(cy + 0.6));
    ctx.lineTo(sx(cx), sy(cy - 0.4));
    ctx.stroke();
    // where it would land: a dashed guide down to the tower
    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = colors.faint;
    ctx.beginPath();
    ctx.moveTo(sx(cx), sy(cy - 0.4 - hh * 2));
    ctx.lineTo(sx(cx), sy(-0.2));
    ctx.stroke();
    ctx.setLineDash([]);
    box(cx, cy - 0.4 - hh, hw, hh, 0, colors[PALETTE[kind % PALETTE.length]], colors.text, k.name, ready ? 1 : 0.35 + 0.2 * Math.sin(time * 10));
  }
}

// ---------- input ----------

const held = { left: false, right: false };
let pendingDrop = false;
let pendingRotate = false;
let dragX = null;

function press() {
  const p = phase();
  if (p === 'ready') M._dh_start();
  else if (p === 'paused') M._dh_pause();
  else if (p === 'over') {
    if (performance.now() - endedAt < 600) return;
    newGame();
    M._dh_start();
  } else pendingDrop = true;
  showOverlay();
}

function pause() {
  if (phase() === 'running') {
    M._dh_pause();
    showOverlay();
  }
  held.left = held.right = false;
  dragX = null;
}

function listen() {
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        held.left = true;
        break;
      case 'ArrowRight':
      case 'KeyD':
        held.right = true;
        break;
      case 'Space':
      case 'Enter':
      case 'ArrowDown':
      case 'KeyS':
        if (!e.repeat) press();
        break;
      case 'ArrowUp':
      case 'KeyW':
      case 'KeyR':
        if (!e.repeat) pendingRotate = true;
        break;
      case 'KeyP':
      case 'Escape':
        M._dh_pause();
        showOverlay();
        break;
      default:
        return;
    }
    e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') held.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') held.right = false;
  });

  // touch and mouse: drag on the board to move the crane there; the buttons drop and rotate
  canvas.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary) return;
    e.preventDefault();
    window.focus();
    if (phase() !== 'running') return press();
    canvas.setPointerCapture(e.pointerId);
    dragX = e.clientX;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (dragX !== null) dragX = e.clientX;
  });
  const release = () => (dragX = null);
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);
  $('overlay').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    press();
  });
  $('drop').addEventListener('click', () => press());
  $('rotate').addEventListener('click', () => (pendingRotate = true));

  window.addEventListener('blur', pause);
  document.addEventListener('visibilitychange', () => document.hidden && pause());

  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin || e.data?.type !== 'play:settings') return;
    if (e.data.theme === 'light' || e.data.theme === 'dark') setTheme(e.data.theme);
    if (e.data.lang === 'en' || e.data.lang === 'nl') {
      lang = e.data.lang;
      document.documentElement.lang = lang;
      showOverlay();
    }
  });
  window.addEventListener('storage', (e) => {
    if (e.key === 'theme') setTheme(e.newValue);
  });
}

// ---------- loop ----------

let size = '';
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const r = canvas.getBoundingClientRect();
  if (`${r.width}x${r.height}` !== size && r.width) {
    size = `${r.width}x${r.height}`;
    fit();
  }

  let move = (held.right ? 1 : 0) - (held.left ? 1 : 0);
  if (dragX !== null) {
    // steer the crane toward the finger
    const target = (dragX - canvas.getBoundingClientRect().left - view.w / 2) / view.scale;
    const d = target - M._dh_crane_x();
    move = Math.abs(d) < 0.05 ? 0 : Math.max(-1, Math.min(1, d * 3));
  }
  M._dh_input(move, pendingDrop ? 1 : 0, pendingRotate ? 1 : 0, dt);
  pendingDrop = pendingRotate = false;

  const events = M._dh_update(dt);
  const t = TEXT[lang];
  if (events & EVENT.unpublished) message = { text: fill(t.unpublished, { name: M.UTF8ToString(M._dh_unpublished()) }), until: now + 3000, bad: true };
  if (events & EVENT.fell) message = { text: t.fell, until: now + 2500, bad: true };
  if (events & EVENT.over) {
    endedAt = now;
    const reached = M._dh_best();
    showOverlay();
    if (reached > best) {
      best = reached;
      store.set(BEST_KEY, best.toFixed(2));
    }
    $('live').textContent = fill(t.sayOver, { h: reached.toFixed(1) });
  }
  if (events & (EVENT.unpublished | EVENT.fell)) $('live').textContent = message.text;

  draw(now / 1000);
  hud(now);
  requestAnimationFrame(frame);
}

try {
  M = await createModule();
  kinds = Array.from({ length: M._dh_kinds() }, (_, i) => ({ name: M.UTF8ToString(M._dh_kind_name(i)), w: M._dh_kind_w(i), h: M._dh_kind_h(i) }));
  newGame();
  listen();
  showOverlay();
  requestAnimationFrame(frame);
} catch (err) {
  console.error(err);
  $('fallback').hidden = false;
}
