// The few browser things Dev-Ware's Gleam code asks for: a clock, keys, focus, storage, and the hub's settings.

const BEST_KEY = 'play:dev-ware:best';

export const now = () => performance.now();

/** Calls `callback(now)` every `ms` milliseconds. */
export function every(ms, callback) {
  setInterval(() => callback(performance.now()), ms);
}

/** Calls `callback(key)` for key presses (not with Ctrl/Cmd/Alt held); Space and Enter don't scroll. */
export function onKey(callback) {
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape') e.preventDefault();
    if (!e.repeat) callback(e.key);
  });
}

/** Calls `callback()` when the page loses focus (another tab, a click outside the frame). */
export function onBlur(callback) {
  window.addEventListener('blur', () => callback());
  document.addEventListener('visibilitychange', () => document.hidden && callback());
}

export function best() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function saveBest(n) {
  try {
    localStorage.setItem(BEST_KEY, String(n));
  } catch {
    /* private mode */
  }
}

/** The language from ?lang=, or the browser's. */
export function initialLang() {
  const p = new URLSearchParams(location.search).get('lang');
  if (p === 'en' || p === 'nl') return p;
  return navigator.language.startsWith('nl') ? 'nl' : 'en';
}

export function setHtmlLang(lang) {
  document.documentElement.lang = lang;
}

/** The theme: the jo-theme cookie, then localStorage, then dark; follows the hub. Calls `onLang(lang)` for new languages. */
export function followHub(onLang) {
  const read = () => {
    try {
      return localStorage.getItem('theme');
    } catch {
      return null;
    }
  };
  const setTheme = (t) => (document.documentElement.dataset.theme = t === 'light' ? 'light' : 'dark');
  setTheme(document.cookie.match(/(?:^|; )jo-theme=(dark|light)/)?.[1] ?? read());
  if (window.top === window.self) document.documentElement.classList.add('standalone');
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin || e.data?.type !== 'play:settings') return;
    if (e.data.theme === 'light' || e.data.theme === 'dark') setTheme(e.data.theme);
    if (e.data.lang === 'en' || e.data.lang === 'nl') onLang(e.data.lang);
  });
  window.addEventListener('storage', (e) => {
    if (e.key === 'theme') setTheme(e.newValue);
  });
}
