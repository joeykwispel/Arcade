/**
 * Rubber Duck Run: wires the engine to the page. Canvas sizing, input, theme, language, the loop and the overlay.
 * No framework on purpose: this is the baseline the framework versions get compared against.
 */
import '@fontsource-variable/jetbrains-mono';
import './style.css';
import { WORLD_H, createState, jump, resize, start, update } from './engine.js';
import { render } from './render.js';
import { fill, isLang, text } from './i18n.js';

const HI_KEY = 'play:duck:hi';
/** Seconds after a crash before a key restarts, so a held jump doesn't skip the game over screen */
const RESTART_DELAY = 0.35;
/** A touch that moves down this far (CSS px) is a swipe: duck instead of jump */
const SWIPE = 24;

const stage = /** @type {HTMLElement} */ (document.getElementById('stage'));
const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('game'));
const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
const overlay = /** @type {HTMLElement} */ (document.getElementById('overlay'));
const titleEl = /** @type {HTMLElement} */ (document.getElementById('title'));
const subEl = /** @type {HTMLElement} */ (document.getElementById('sub'));
const hintEl = /** @type {HTMLElement} */ (document.getElementById('hint'));
const live = /** @type {HTMLElement} */ (document.getElementById('live'));

/* ---------- storage, theme, language ---------- */

const store = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* private mode: the high score just won't stick */
    }
  }
};

/** Same order as the design kit: the jo-theme cookie shared by *.joeyoosenbrug.nl, then localStorage, then dark. */
function initialTheme() {
  const fromCookie = document.cookie.match(/(?:^|; )jo-theme=(dark|light)/)?.[1];
  const t = fromCookie ?? store.get('theme');
  return t === 'light' ? 'light' : 'dark';
}

const params = new URLSearchParams(location.search);
/** @type {import('./i18n.js').Lang} */
let lang = isLang(params.get('lang')) ? /** @type {'en' | 'nl'} */ (params.get('lang')) : navigator.language.startsWith('nl') ? 'nl' : 'en';

const COLOR_VARS = ['duck', 'beak', 'wing', 'eye', 'ink', 'bug', 'bugStripe', 'paper', 'badge', 'muted', 'cloud', 'ground', 'accent', 'accent2', 'conflictBg'];
/** @type {Record<string, string>} */
let colors = {};
function readColors() {
  const cs = getComputedStyle(document.documentElement);
  colors = Object.fromEntries(COLOR_VARS.map((k) => [k, cs.getPropertyValue(`--g-${k}`).trim()]));
}

/** @param {'dark' | 'light'} theme */
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  readColors();
}

/** @param {'en' | 'nl'} l */
function setLang(l) {
  lang = l;
  document.documentElement.lang = l;
  showOverlay();
}

/* ---------- state ---------- */

const state = createState({ worldW: 450, hi: Number(store.get(HI_KEY)) || 0 });
const input = { jump: false, duck: false };
let overMessage = 0;

/* ---------- sizing ---------- */

function fit() {
  const { width, height } = stage.getBoundingClientRect();
  if (!width || !height) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  // 150 world units fill the height, unless the screen is narrow; then at least 300 fit across.
  const scale = Math.min(height / WORLD_H, width / 300);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  resize(state, width / scale, height / scale);
}
new ResizeObserver(fit).observe(stage);

/* ---------- overlay ---------- */

function showOverlay() {
  const t = text[lang];
  const phase = state.phase;
  overlay.hidden = phase === 'running';
  overlay.dataset.phase = phase;
  if (phase === 'ready') {
    titleEl.textContent = t.title;
    subEl.textContent = t.start;
    hintEl.textContent = '';
  } else if (phase === 'paused') {
    titleEl.textContent = t.paused;
    subEl.textContent = t.resume;
    hintEl.textContent = '';
  } else if (phase === 'over') {
    titleEl.textContent = t.over[overMessage % t.over.length];
    subEl.textContent = fill(state.newBest ? t.newBest : t.shipped, { score: state.score });
    hintEl.textContent = t.retry;
  }
}

/* ---------- input ---------- */

function press() {
  if (state.phase === 'ready') {
    start(state);
    jump(state);
  } else if (state.phase === 'paused') {
    state.phase = 'running';
  } else if (state.phase === 'over') {
    if (state.overFor < RESTART_DELAY) return;
    start(state);
  } else {
    jump(state);
  }
  showOverlay();
}

function pause() {
  if (state.phase !== 'running') return;
  state.phase = 'paused';
  input.jump = input.duck = false;
  showOverlay();
}

const JUMP_KEYS = new Set(['Space', 'ArrowUp', 'KeyW', 'Enter']);
const DUCK_KEYS = new Set(['ArrowDown', 'KeyS']);

window.addEventListener('keydown', (e) => {
  if (JUMP_KEYS.has(e.code)) {
    e.preventDefault();
    input.jump = true;
    if (!e.repeat) press();
  } else if (DUCK_KEYS.has(e.code)) {
    e.preventDefault();
    input.duck = true;
  } else if (e.code === 'Escape' || e.code === 'KeyP') {
    pause();
  }
});
window.addEventListener('keyup', (e) => {
  if (JUMP_KEYS.has(e.code)) input.jump = false;
  else if (DUCK_KEYS.has(e.code)) input.duck = false;
});

/** @type {{ id: number, y: number } | null} */
let touch = null;
stage.addEventListener('pointerdown', (e) => {
  if (!e.isPrimary) return;
  e.preventDefault();
  window.focus();
  touch = { id: e.pointerId, y: e.clientY };
  stage.setPointerCapture(e.pointerId);
  input.jump = true;
  press();
});
stage.addEventListener('pointermove', (e) => {
  if (!touch || e.pointerId !== touch.id) return;
  if (e.clientY - touch.y > SWIPE) {
    input.jump = false;
    input.duck = true;
  }
});
const release = (/** @type {PointerEvent} */ e) => {
  if (!touch || e.pointerId !== touch.id) return;
  touch = null;
  input.jump = false;
  input.duck = false;
};
stage.addEventListener('pointerup', release);
stage.addEventListener('pointercancel', release);

// Losing focus (a click outside the iframe, another tab) pauses, so the duck doesn't die unattended.
window.addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => document.hidden && pause());

/* ---------- messages from the hub (optional) ---------- */

window.addEventListener('message', (e) => {
  if (e.origin !== location.origin || e.data?.type !== 'play:settings') return;
  if (e.data.theme === 'light' || e.data.theme === 'dark') setTheme(e.data.theme);
  if (isLang(e.data.lang)) setLang(e.data.lang);
});
// Standalone, in another tab: follow theme changes made on the hub.
window.addEventListener('storage', (e) => {
  if (e.key === 'theme' && (e.newValue === 'light' || e.newValue === 'dark')) setTheme(e.newValue);
});

/* ---------- loop ---------- */

let last = performance.now();
function frame(now) {
  const dt = (now - last) / 1000;
  last = now;
  const event = update(state, dt, input);
  if (event === 'crash') {
    overMessage = Math.floor(Math.random() * text[lang].over.length);
    store.set(HI_KEY, String(state.hi));
    showOverlay();
    live.textContent = `${titleEl.textContent} ${subEl.textContent}`;
  }
  const t = text[lang];
  render(ctx, state, colors, { score: t.score, best: t.best });
  requestAnimationFrame(frame);
}

if (window.top === window.self) document.documentElement.classList.add('standalone');
setTheme(initialTheme());
setLang(lang);
fit();
// Draw with the real font once it is in; the first frames fall back to the system mono.
document.fonts?.load("700 10px 'JetBrains Mono Variable'").catch(() => {});
requestAnimationFrame(frame);
