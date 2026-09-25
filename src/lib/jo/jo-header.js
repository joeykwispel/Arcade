/**
 * jo-header.js: behaviour of the joeyoosenbrug.nl header (markup in header.html, styles in jo-header.css).
 * No dependencies. Works with any framework: render the markup, then call initJoHeader() once on the client.
 *
 *   import { initJoHeader } from './jo-header.js';
 *   const destroy = initJoHeader(document.querySelector('.jo-nav'), { onSearch: () => openMyCommandMenu() });
 */

const COOKIE = 'jo-theme';
const DOMAIN = 'joeyoosenbrug.nl';

/**
 * The visitor's theme. A cookie on .joeyoosenbrug.nl is shared by every subdomain (localStorage is not),
 * so switching to light on one app keeps it light on the others.
 * @returns {'dark' | 'light'}
 */
export function readTheme() {
  const fromCookie = document.cookie.match(new RegExp(`(?:^|; )${COOKIE}=(dark|light)`))?.[1];
  if (fromCookie) return /** @type {'dark' | 'light'} */ (fromCookie);
  try {
    const t = localStorage.getItem('theme');
    if (t === 'light' || t === 'dark') return t;
  } catch {
    /* storage unavailable */
  }
  return 'dark';
}

/** @param {'dark' | 'light'} theme */
export function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem('theme', theme);
  } catch {
    /* storage unavailable */
  }
  const onSite = location.hostname === DOMAIN || location.hostname.endsWith(`.${DOMAIN}`);
  document.cookie = `${COOKIE}=${theme}; path=/; max-age=31536000; SameSite=Lax${onSite ? `; domain=.${DOMAIN}; Secure` : ''}`;
}

/**
 * @param {HTMLElement | null} root the <header class="jo-nav"> element
 * @param {{ onSearch?: () => void }} [options] onSearch shows the Ctrl K button and binds Ctrl/Cmd+K
 * @returns {() => void} cleanup
 */
export function initJoHeader(root = document.querySelector('.jo-nav'), options = {}) {
  if (!root) return () => {};
  const cleanups = [];
  const on = (target, type, fn, opts) => {
    target.addEventListener(type, fn, opts);
    cleanups.push(() => target.removeEventListener(type, fn, opts));
  };

  /* Scroll progress bar + frosted background once the page is scrolled */
  const bar = root.querySelector('.jo-nav__progress');
  let raf = 0;
  const onScroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      const max = document.documentElement.scrollHeight - innerHeight;
      if (bar) bar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`;
      root.classList.toggle('is-scrolled', scrollY > 12);
    });
  };
  on(window, 'scroll', onScroll, { passive: true });
  on(window, 'resize', onScroll, { passive: true });
  onScroll();

  /* Mobile menu (below 1120px) */
  const menu = root.querySelector('.jo-nav__menu');
  const burger = root.querySelector('.jo-nav__burger');
  const setOpen = (open) => {
    menu?.classList.toggle('is-open', open);
    burger?.setAttribute('aria-expanded', String(open));
  };
  if (burger) on(burger, 'click', () => setOpen(burger.getAttribute('aria-expanded') !== 'true'));
  if (menu) on(menu, 'click', (e) => e.target instanceof Element && e.target.closest('a') && setOpen(false));
  on(document, 'keydown', (e) => e.key === 'Escape' && setOpen(false));

  /* Theme toggle */
  const themeBtn = root.querySelector('.jo-nav__theme');
  const syncLabel = () => {
    const theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
    themeBtn?.setAttribute('aria-label', themeBtn.dataset[theme === 'light' ? 'labelLight' : 'labelDark'] ?? '');
  };
  if (themeBtn) {
    on(themeBtn, 'click', () => {
      setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
      syncLabel();
    });
    syncLabel();
  }

  /* Optional command menu */
  const search = root.querySelector('.jo-nav__search');
  if (search && options.onSearch) {
    search.hidden = false;
    on(search, 'click', () => options.onSearch());
    on(document, 'keydown', (e) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        options.onSearch();
      }
    });
  }

  /* Links to #sections on this page: mark the one in view, like the portfolio does */
  const hashLinks = [...root.querySelectorAll('.jo-nav__link[href^="#"]')];
  const targets = hashLinks.map((a) => document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)))).filter(Boolean);
  if (targets.length) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          for (const a of hashLinks) {
            if (a.getAttribute('href') === `#${e.target.id}`) a.setAttribute('aria-current', 'true');
            else a.removeAttribute('aria-current');
          }
        }
      },
      { rootMargin: '-40% 0px -55% 0px' }
    );
    targets.forEach((t) => io.observe(t));
    cleanups.push(() => io.disconnect());
  }

  return () => {
    cancelAnimationFrame(raf);
    cleanups.forEach((fn) => fn());
  };
}
