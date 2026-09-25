<script lang="ts">
  // Self-hosted fonts (no requests to Google, so no visitor IPs shared with third parties)
  import '@fontsource-variable/inter';
  import '@fontsource-variable/jetbrains-mono';
  import '$lib/jo/jo-kit.css';
  import '$lib/jo/jo-header.css';
  import '../app.css';
  import { page } from '$app/state';
  import { app } from '$lib/app.svelte';
  import { localeOf } from '$lib/i18n';
  import { t } from '$lib/locales';
  import type { HeaderLink } from '$lib/types';
  import Header from '$lib/components/Header.svelte';
  import Footer from '$lib/components/Footer.svelte';

  let { children } = $props();

  // Read the language from the URL during render as well, so the prerendered HTML is already in the right language.
  const sync = () => {
    app.locale = localeOf(page.url.pathname);
  };
  sync();
  $effect.pre(sync);

  $effect(() => {
    document.documentElement.lang = app.locale;
  });

  const isHome = $derived(page.route.id === '/[[lang=lang]]');
  // On the home page the links jump to its sections (the header marks the one in view); elsewhere they lead back to them.
  const links: HeaderLink[] = $derived.by(() => {
    const h = t(app.locale).header;
    return isHome
      ? [
          { label: h.games, href: '#games' },
          { label: h.how, href: '#how' }
        ]
      : [
          { label: h.games, href: app.href('/'), current: page.route.id?.includes('/play/') },
          { label: h.how, href: app.href('/#how') }
        ];
  });
</script>

<!-- Re-created per page and language, so jo-header.js picks up the new links and labels. -->
{#key `${page.url.pathname}`}
  <Header {links} />
{/key}

<main id="main">
  {@render children()}
</main>

<Footer />
