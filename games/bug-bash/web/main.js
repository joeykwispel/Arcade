/**
 * Bug Bash: the page side. Deliberately thin: it loads the WebAssembly module, forwards input, the clock, theme and
 * language, and replays the draw list the Rust code leaves in memory each frame. There is no game logic in here.
 */
import '@fontsource-variable/jetbrains-mono';
import './style.css';

const STARS_KEY = 'play:bug-bash:stars';
/** The world the Rust code draws in; it is letterboxed into the page. */
const WORLD_W = 960;
const WORLD_H = 600;
const MONO = "'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

/** Keyboard codes → the small numbers `Key::from_code` in src/ui.rs understands */
const KEYS = {
  ArrowUp: 1,
  ArrowDown: 2,
  ArrowLeft: 3,
  ArrowRight: 4,
  Enter: 5,
  NumpadEnter: 5,
  Space: 6,
  KeyN: 6,
  Escape: 7,
  KeyU: 20,
  KeyS: 21,
  Delete: 21,
  Backspace: 21,
  KeyP: 22,
  KeyF: 23,
  KeyR: 24,
  KeyL: 25
};
for (let n = 1; n <= 9; n++) KEYS[`Digit${n}`] = KEYS[`Numpad${n}`] = 10 + n;

const stage = /** @type {HTMLElement} */ (document.getElementById('stage'));
const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('game'));
const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
const live = /** @type {HTMLElement} */ (document.getElementById('live'));
const fallback = /** @type {HTMLElement} */ (document.getElementById('fallback'));

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
      /* private mode: progress just won't stick */
    }
  }
};

/** Same order as the design kit: the jo-theme cookie shared by *.joeyoosenbrug.nl, then localStorage, then dark. */
function initialTheme() {
  const fromCookie = document.cookie.match(/(?:^|; )jo-theme=(dark|light)/)?.[1];
  return (fromCookie ?? store.get('theme')) === 'light' ? 'light' : 'dark';
}

const isLang = (/** @type {unknown} */ v) => v === 'en' || v === 'nl';
const langCode = (/** @type {string} */ l) => (l === 'nl' ? 1 : 0);
const params = new URLSearchParams(location.search);
let lang = isLang(params.get('lang')) ? params.get('lang') : navigator.language.startsWith('nl') ? 'nl' : 'en';

/** @type {string[]} CSS colors, indexed like `draw::Color` */
let palette = [];
/** @type {string[]} */
let colorNames = [];
function readColors() {
  const cs = getComputedStyle(document.documentElement);
  palette = colorNames.map((n) => cs.getPropertyValue(`--c-${n}`).trim() || '#f0f');
}

/** @param {'dark' | 'light'} theme */
function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  readColors();
}

/* ---------- the module ---------- */

/** @type {any} */
let wasm;
const decoder = new TextDecoder();
const readString = (/** @type {number} */ ptr, /** @type {number} */ len) => decoder.decode(new Uint8Array(wasm.memory.buffer, ptr, len));

async function load() {
  // next to the bundle: dist/assets/
  const url = new URL('./bug_bash.wasm', import.meta.url);
  const res = fetch(url);
  try {
    return (await WebAssembly.instantiateStreaming(res, {})).instance.exports;
  } catch {
    // a server without the application/wasm type: fall back to bytes
    return (await WebAssembly.instantiate(await (await fetch(url)).arrayBuffer(), {})).instance.exports;
  }
}

/* ---------- sizing: the world is letterboxed into the stage ---------- */

let view = { scale: 1, ox: 0, oy: 0, dpr: 1 };
function fit() {
  const { width, height } = stage.getBoundingClientRect();
  if (!width || !height) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const scale = Math.min(width / WORLD_W, height / WORLD_H);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  view = { scale, ox: (width - WORLD_W * scale) / 2, oy: (height - WORLD_H * scale) / 2, dpr };
}
new ResizeObserver(fit).observe(stage);

/** @param {PointerEvent} e */
function toWorld(e) {
  const r = canvas.getBoundingClientRect();
  return [(e.clientX - r.left - view.ox) / view.scale, (e.clientY - r.top - view.oy) / view.scale];
}

/* ---------- replaying the draw list ---------- */

function replay() {
  const { scale, ox, oy, dpr } = view;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(scale * dpr, 0, 0, scale * dpr, ox * dpr, oy * dpr);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.textBaseline = 'middle';

  const buf = wasm.memory.buffer;
  const c = new Float32Array(buf, wasm.cmd_ptr(), wasm.cmd_len());
  const text = new Uint8Array(buf, wasm.text_ptr(), wasm.text_len());
  let font = '';

  for (let i = 0; i < c.length;) {
    switch (c[i]) {
      case 1: // rect x y w h color alpha
        ctx.globalAlpha = c[i + 6];
        ctx.fillStyle = palette[c[i + 5]];
        ctx.fillRect(c[i + 1], c[i + 2], c[i + 3], c[i + 4]);
        i += 7;
        break;
      case 2: // rounded rect x y w h r color alpha
        ctx.globalAlpha = c[i + 7];
        ctx.fillStyle = palette[c[i + 6]];
        ctx.beginPath();
        ctx.roundRect(c[i + 1], c[i + 2], c[i + 3], c[i + 4], c[i + 5]);
        ctx.fill();
        i += 8;
        break;
      case 3: // outlined rounded rect x y w h r color alpha width
        ctx.globalAlpha = c[i + 7];
        ctx.strokeStyle = palette[c[i + 6]];
        ctx.lineWidth = c[i + 8];
        ctx.beginPath();
        ctx.roundRect(c[i + 1], c[i + 2], c[i + 3], c[i + 4], c[i + 5]);
        ctx.stroke();
        i += 9;
        break;
      case 4: // circle x y r color alpha
        ctx.globalAlpha = c[i + 5];
        ctx.fillStyle = palette[c[i + 4]];
        ctx.beginPath();
        ctx.arc(c[i + 1], c[i + 2], Math.max(0, c[i + 3]), 0, Math.PI * 2);
        ctx.fill();
        i += 6;
        break;
      case 5: // ring x y r color alpha width dash
        ctx.globalAlpha = c[i + 5];
        ctx.strokeStyle = palette[c[i + 4]];
        ctx.lineWidth = c[i + 6];
        ctx.setLineDash(c[i + 7] > 0 ? [c[i + 7], c[i + 7]] : []);
        ctx.beginPath();
        ctx.arc(c[i + 1], c[i + 2], Math.max(0, c[i + 3]), 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
        i += 8;
        break;
      case 6: // line x1 y1 x2 y2 color alpha width
        ctx.globalAlpha = c[i + 6];
        ctx.strokeStyle = palette[c[i + 5]];
        ctx.lineWidth = c[i + 7];
        ctx.beginPath();
        ctx.moveTo(c[i + 1], c[i + 2]);
        ctx.lineTo(c[i + 3], c[i + 4]);
        ctx.stroke();
        i += 8;
        break;
      case 7: {
        // text x y size color alpha align bold offset length
        const f = `${c[i + 7] ? 700 : 400} ${c[i + 3]}px ${MONO}`;
        if (f !== font) ctx.font = font = f;
        ctx.globalAlpha = c[i + 5];
        ctx.fillStyle = palette[c[i + 4]];
        ctx.textAlign = c[i + 6] === 1 ? 'center' : c[i + 6] === 2 ? 'right' : 'left';
        ctx.fillText(decoder.decode(text.subarray(c[i + 8], c[i + 8] + c[i + 9])), c[i + 1], c[i + 2]);
        i += 10;
        break;
      }
      case 8: // clip x y w h
        ctx.save();
        ctx.beginPath();
        ctx.rect(c[i + 1], c[i + 2], c[i + 3], c[i + 4]);
        ctx.clip();
        i += 5;
        break;
      case 9: // end clip
        ctx.restore();
        font = '';
        i += 1;
        break;
      default:
        throw new Error(`unknown draw command ${c[i]} at ${i}`);
    }
  }
  ctx.globalAlpha = 1;
}

/* ---------- after each frame ---------- */

function sync() {
  const n = wasm.announce_len();
  if (n) {
    live.textContent = readString(wasm.announce_ptr(), n);
    wasm.announce_clear();
  }
  if (wasm.take_save()) store.set(STARS_KEY, [0, 1, 2, 3, 4].map((i) => wasm.stars(i)).join(','));
  stage.dataset.screen = ['menu', 'playing', 'paused', 'won', 'lost'][wasm.screen()];
  stage.style.cursor = wasm.pointer_cursor() ? 'pointer' : 'default';
}

let last = performance.now();
function frame(/** @type {number} */ now) {
  wasm.frame(Math.min((now - last) / 1000, 0.1));
  last = now;
  replay();
  sync();
  requestAnimationFrame(frame);
}

/* ---------- input ---------- */

function listen() {
  window.addEventListener('keydown', (e) => {
    const code = KEYS[e.code];
    if (!code || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    if (!e.repeat || code <= 4) wasm.key(code);
  });

  stage.addEventListener('pointermove', (e) => wasm.pointer_move(...toWorld(e)));
  stage.addEventListener('pointerleave', () => wasm.pointer_leave());
  stage.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary) return;
    e.preventDefault();
    window.focus();
    if (e.button === 2) return wasm.key(KEYS.Escape);
    wasm.pointer_down(...toWorld(e));
    // touch has no hover: forget the position, so no ghost tool stays behind
    if (e.pointerType === 'touch') wasm.pointer_leave();
  });
  stage.addEventListener('contextmenu', (e) => e.preventDefault());

  // Losing focus (a click outside the iframe, another tab) pauses, so nothing reaches production unattended.
  window.addEventListener('blur', () => wasm.blur());
  document.addEventListener('visibilitychange', () => document.hidden && wasm.blur());

  // Settings from the hub (optional): same origin only.
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin || e.data?.type !== 'play:settings') return;
    if (e.data.theme === 'light' || e.data.theme === 'dark') setTheme(e.data.theme);
    if (isLang(e.data.lang)) setLang(e.data.lang);
  });
  // Standalone, in another tab: follow theme changes made on the hub.
  window.addEventListener('storage', (e) => {
    if (e.key === 'theme' && (e.newValue === 'light' || e.newValue === 'dark')) setTheme(e.newValue);
  });
}

/** @param {string} l */
function setLang(l) {
  lang = l;
  document.documentElement.lang = l;
  wasm?.set_lang(langCode(l));
}

/* ---------- start ---------- */

if (window.top === window.self) document.documentElement.classList.add('standalone');
document.documentElement.lang = lang;

try {
  wasm = await load();
  colorNames = readString(wasm.color_names_ptr(), wasm.color_names_len()).split(',');
  setTheme(initialTheme());
  wasm.init(langCode(lang), (Math.random() * 2 ** 32) >>> 0);
  (store.get(STARS_KEY) ?? '').split(',').forEach((s, i) => wasm.load_stars(i, Number(s) || 0));
  fit();
  listen();
  document.fonts?.load(`700 12px ${MONO}`).catch(() => {});
  requestAnimationFrame(frame);
} catch (err) {
  console.error(err);
  fallback.hidden = false;
}
