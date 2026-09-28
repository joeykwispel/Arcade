/**
 * Starts the Elm app (compiled by `elm make` into elm.js, loaded before this file) and connects it to the page:
 * the saved game from localStorage, the hub's language and theme, and the `save` port.
 */
import '@fontsource-variable/jetbrains-mono';
import './style.css';

const SAVE_KEY = 'play:deploy-tycoon:save';

const read = (key) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode: progress just won't stick */
  }
};

/** Same order as the design kit: the jo-theme cookie shared by *.joeyoosenbrug.nl, then localStorage, then dark. */
const setTheme = (theme) => {
  document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark';
};
setTheme(document.cookie.match(/(?:^|; )jo-theme=(dark|light)/)?.[1] ?? read('theme'));
if (window.top === window.self) document.documentElement.classList.add('standalone');

const param = new URLSearchParams(location.search).get('lang');
const lang = param === 'en' || param === 'nl' ? param : navigator.language.startsWith('nl') ? 'nl' : 'en';
document.documentElement.lang = lang;

let saved = null;
try {
  saved = JSON.parse(read(SAVE_KEY) ?? 'null');
} catch {
  /* a broken save: start fresh */
}

const app = window.Elm.Main.init({
  node: document.getElementById('root'),
  flags: { save: saved, lang, now: Date.now(), seed: Math.floor(Math.random() * 2 ** 31) }
});

let latest = null;
app.ports.save.subscribe((state) => {
  latest = JSON.stringify(state);
  write(SAVE_KEY, latest);
});
// the app saves every two seconds; this catches the last moment before the tab closes
window.addEventListener('pagehide', () => latest && write(SAVE_KEY, latest));

window.addEventListener('message', (e) => {
  if (e.origin !== location.origin || e.data?.type !== 'play:settings') return;
  if (e.data.theme === 'light' || e.data.theme === 'dark') setTheme(e.data.theme);
  if (e.data.lang === 'en' || e.data.lang === 'nl') {
    document.documentElement.lang = e.data.lang;
    app.ports.language.send(e.data.lang);
  }
});
window.addEventListener('storage', (e) => {
  if (e.key === 'theme') setTheme(e.newValue);
});
