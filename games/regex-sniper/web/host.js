// The arcade around the game: language and theme (from ?lang, the site's cookie, and its play:settings messages),
// and the best score.

const BEST_KEY = 'play:regex-sniper:best';

/** The language from ?lang=, or the browser's. */
export function initialLang() {
  const p = new URLSearchParams(location.search).get('lang');
  if (p === 'en' || p === 'nl') return p;
  return navigator.language.startsWith('nl') ? 'nl' : 'en';
}

export function loadBest() {
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

/** Follows the site's theme (jo-theme cookie, then localStorage, then dark) and the hub's messages. */
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
