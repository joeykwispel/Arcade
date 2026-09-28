/** Deploy Tycoon: mounts the app and follows the hub's theme (the language is handled in App). */
import '@fontsource-variable/jetbrains-mono';
import './style.css';
import { mount } from 'svelte';
import App from './App.svelte';
import { isLang } from './lib/i18n';

const read = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

/** Same order as the design kit: the jo-theme cookie shared by *.joeyoosenbrug.nl, then localStorage, then dark. */
const setTheme = (theme: string | null) => {
  document.documentElement.dataset.theme = theme === 'light' ? 'light' : 'dark';
};
setTheme(document.cookie.match(/(?:^|; )jo-theme=(dark|light)/)?.[1] ?? read('theme'));
window.addEventListener('message', (e) => {
  if (e.origin !== location.origin || e.data?.type !== 'play:settings') return;
  if (e.data.theme === 'light' || e.data.theme === 'dark') setTheme(e.data.theme);
});
window.addEventListener('storage', (e) => {
  if (e.key === 'theme') setTheme(e.newValue);
});

if (window.top === window.self) document.documentElement.classList.add('standalone');

const param = new URLSearchParams(location.search).get('lang');
const lang = isLang(param) ? param : navigator.language.startsWith('nl') ? 'nl' : 'en';
document.documentElement.lang = lang;

mount(App, { target: document.getElementById('root')!, props: { initialLang: lang } });
