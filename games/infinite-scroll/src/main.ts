/**
 * Infinite Scroll: wires the world (rules) to the scene (3D) and the page: the loop, keyboard and touch steering,
 * the HUD and overlay, theme and language from the hub, and the best score in localStorage.
 */
import '@fontsource-variable/jetbrains-mono';
import './style.css';
import { World } from './world';
import { type Colors, TunnelScene } from './scene';
import { type Lang, fill, isLang, text } from './i18n';

const BEST_KEY = 'play:infinite-scroll:best';
const $ = (id: string) => document.getElementById(id)!;
const stage = $('stage');
const canvas = $('game') as HTMLCanvasElement;
const overlay = $('overlay');
const live = $('live');

const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private mode: the best score just won't stick */
    }
  }
};

const params = new URLSearchParams(location.search);
let lang: Lang = isLang(params.get('lang')) ? (params.get('lang') as Lang) : navigator.language.startsWith('nl') ? 'nl' : 'en';
let best = Number(store.get(BEST_KEY)) || 0;
let world = new World();
let overLine = 0;
let newBest = false;

function readColors(): Colors {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string) => cs.getPropertyValue(`--c-${n}`).trim();
  return {
    bg: v('bg'),
    code: v('code'),
    keyword: v('keyword'),
    str: v('str'),
    comment: v('comment'),
    accent: v('accent'),
    accent2: v('accent2'),
    danger: v('danger'),
    warn: v('warn'),
    info: v('info'),
    success: v('success'),
    ink: v('ink')
  };
}

const themeFromCookie = document.cookie.match(/(?:^|; )jo-theme=(dark|light)/)?.[1];
document.documentElement.dataset.theme = (themeFromCookie ?? store.get('theme')) === 'light' ? 'light' : 'dark';
document.documentElement.lang = lang;
if (window.top === window.self) document.documentElement.classList.add('standalone');

let scene: TunnelScene;
try {
  scene = new TunnelScene(canvas, readColors());
} catch (e) {
  console.error(e);
  $('fallback').hidden = false;
  throw e;
}

function setTheme(theme: string | null) {
  const t = theme === 'light' ? 'light' : 'dark';
  if (document.documentElement.dataset.theme === t) return;
  document.documentElement.dataset.theme = t;
  scene.setColors(readColors());
}

function setLang(l: Lang) {
  lang = l;
  document.documentElement.lang = l;
  showOverlay();
}

/* ---------- overlay and HUD ---------- */

function showOverlay() {
  const t = text[lang];
  overlay.hidden = world.phase === 'running';
  overlay.dataset.phase = world.phase;
  stage.dataset.phase = world.phase;
  const [title, sub, hint, small] =
    world.phase === 'ready'
      ? [t.title, t.tagline, t.start, `${t.controls} ${t.legend}`]
      : world.phase === 'paused'
        ? [t.paused, fill(t.result, { score: world.score }), t.resume, '']
        : world.phase === 'over'
          ? [t.over[overLine % t.over.length], fill(newBest ? t.newBest : t.result, { score: world.score }), t.retry, '']
          : ['', '', '', ''];
  $('title').textContent = title;
  $('sub').textContent = sub;
  $('hint').textContent = hint;
  $('small').textContent = small;
  $('score-label').textContent = t.score;
  $('best-label').textContent = t.best;
}

let hudAt = 0;
function hud(now: number) {
  if (now - hudAt < 100) return; // ten times a second is plenty for text
  hudAt = now;
  const t = text[lang];
  $('score').textContent = String(world.score);
  $('best').textContent = String(Math.max(best, world.phase === 'over' ? 0 : world.score));
  const status = [world.shield ? `{ } ${t.shield}` : '', world.slow > 0 ? `☕ ${t.slow}` : ''].filter(Boolean).join('   ');
  $('status').textContent = world.phase === 'running' ? status || `${t.speed} ${Math.round(world.speed)}` : '';
}

/* ---------- input ---------- */

const held = { left: false, right: false };
let touchSide = 0;
const steer = () => (held.right ? 1 : 0) - (held.left ? 1 : 0) + touchSide;
let endedAt = 0;

function press() {
  if (world.phase === 'ready') world.start();
  else if (world.phase === 'paused') world.togglePause();
  else if (world.phase === 'over') {
    if (performance.now() - endedAt < 500) return;
    world = new World();
    world.start();
  }
  showOverlay();
}

function pause() {
  if (world.phase === 'running') {
    world.togglePause();
    showOverlay();
  }
  held.left = held.right = false;
  touchSide = 0;
}

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (LEFT.has(e.code)) held.left = true;
  else if (RIGHT.has(e.code)) held.right = true;
  else if (e.code === 'Space' || e.code === 'Enter') {
    if (!e.repeat) press();
  } else if (e.code === 'KeyP' || e.code === 'Escape') {
    world.togglePause();
    showOverlay();
  } else return;
  e.preventDefault();
});
window.addEventListener('keyup', (e) => {
  if (LEFT.has(e.code)) held.left = false;
  if (RIGHT.has(e.code)) held.right = false;
});

// touch and mouse: hold the left or right half to steer; a tap on the overlay starts
stage.addEventListener('pointerdown', (e) => {
  if (!e.isPrimary) return;
  e.preventDefault();
  window.focus();
  if (world.phase !== 'running') return press();
  const r = stage.getBoundingClientRect();
  touchSide = e.clientX - r.left < r.width / 2 ? -1 : 1;
  stage.setPointerCapture(e.pointerId);
});
stage.addEventListener('pointermove', (e) => {
  if (!touchSide) return;
  const r = stage.getBoundingClientRect();
  touchSide = e.clientX - r.left < r.width / 2 ? -1 : 1;
});
const release = () => (touchSide = 0);
stage.addEventListener('pointerup', release);
stage.addEventListener('pointercancel', release);
stage.addEventListener('contextmenu', (e) => e.preventDefault());

window.addEventListener('blur', pause);
document.addEventListener('visibilitychange', () => document.hidden && pause());

window.addEventListener('message', (e) => {
  if (e.origin !== location.origin || e.data?.type !== 'play:settings') return;
  if (e.data.theme === 'light' || e.data.theme === 'dark') setTheme(e.data.theme);
  if (isLang(e.data.lang)) setLang(e.data.lang);
});
window.addEventListener('storage', (e) => {
  if (e.key === 'theme') setTheme(e.newValue);
});

/* ---------- loop ---------- */

let size = '';
let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const { width, height } = stage.getBoundingClientRect();
  if (`${width}x${height}` !== size && width && height) {
    size = `${width}x${height}`;
    scene.resize(width, height);
  }
  const s = steer();
  world.update(dt, s);
  for (const ev of world.events) {
    if (ev === 'pickup:shield') live.textContent = text[lang].sayShield;
    if (ev === 'shield') live.textContent = text[lang].sayLost;
    if (ev === 'over') {
      endedAt = now;
      overLine = Math.floor(Math.random() * 4);
      newBest = world.score > best;
      if (newBest) {
        best = world.score;
        store.set(BEST_KEY, String(best));
      }
      showOverlay();
      live.textContent = `${$('title').textContent}. ${$('sub').textContent}`;
    }
  }
  world.events.length = 0;
  scene.render(world, s, now / 1000);
  hud(now);
  requestAnimationFrame(frame);
}

showOverlay();
requestAnimationFrame(frame);
