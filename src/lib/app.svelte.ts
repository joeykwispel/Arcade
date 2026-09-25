import type { Locale } from './types';
import { localize, stripLocale } from './i18n';

class AppState {
  /** Set by the [[lang]] layout from the URL: / is English, /nl/ is Dutch. */
  locale = $state<Locale>('en');

  /** Remembers the choice, so a later visit to the English home page sends a Dutch reader to /nl/. */
  rememberLocale(l: Locale) {
    try {
      localStorage.setItem('lang', l);
    } catch {
      /* storage unavailable */
    }
  }

  /** The same page in another language. */
  hrefFor(l: Locale, pathname: string) {
    return localize(stripLocale(pathname), l);
  }

  /** Site-absolute href in the current language. */
  href(path: string) {
    return localize(path, this.locale);
  }
}

export const app = new AppState();
