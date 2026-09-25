import type { Locale } from './types';

/**
 * The optional hub → game protocol, over window.postMessage (same origin only).
 * A game may listen for it to follow the site's theme and language live; it must also work without it,
 * because it can be opened on its own page. Games read `?lang=en|nl` on load for the first frame.
 *
 *   window.addEventListener('message', (e) => {
 *     if (e.origin !== location.origin || e.data?.type !== 'play:settings') return;
 *     applyTheme(e.data.theme); applyLang(e.data.lang);
 *   });
 */
export interface SettingsMessage {
  type: 'play:settings';
  lang: Locale;
  theme: 'dark' | 'light';
}

export const settingsMessage = (lang: Locale, theme: 'dark' | 'light'): SettingsMessage => ({ type: 'play:settings', lang, theme });
