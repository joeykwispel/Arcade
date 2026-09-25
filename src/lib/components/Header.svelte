<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { app } from '$lib/app.svelte';
  import { t, locales } from '$lib/locales';
  import { initJoHeader } from '$lib/jo/jo-header.js';
  import type { HeaderLink } from '$lib/types';

  /**
   * The joeyoosenbrug.nl header from the portfolio's design kit (docs/design-kit/header.html), 1:1.
   * Only the links, the current link and the language links change; behaviour comes from jo-header.js.
   */
  let { links }: { links: HeaderLink[] } = $props();
  const l = $derived(t(app.locale).header);
  let root: HTMLElement;

  onMount(() => initJoHeader(root));
</script>

<a class="skip" href="#main">{l.skip}</a>

<header class="jo-nav" bind:this={root}>
  <div class="jo-nav__progress" aria-hidden="true"></div>
  <div class="jo-nav__bar">
    <a class="jo-nav__logo" href="https://joeyoosenbrug.nl/" aria-label={l.home}><span class="jo-nav__br">&lt;</span>JO<span class="jo-nav__br">/&gt;</span></a>

    <nav class="jo-nav__menu" aria-label={l.main}>
      <ul>
        {#each links as link, i (link.href)}
          <li>
            <a class="jo-nav__link" href={link.href} aria-current={link.current ? 'page' : undefined}
              ><span class="jo-nav__idx">{String(i + 1).padStart(2, '0')}.</span>{link.label}</a
            >
          </li>
        {/each}
      </ul>
    </nav>

    <div class="jo-nav__tools">
      <div class="jo-nav__lang" role="group" aria-label={l.language}>
        {#each locales as code (code)}
          <a
            href={app.hrefFor(code, page.url.pathname)}
            hreflang={code}
            aria-current={code === app.locale ? 'true' : undefined}
            onclick={() => app.rememberLocale(code)}
            data-sveltekit-noscroll>{code.toUpperCase()}</a
          >
        {/each}
      </div>

      <button type="button" class="jo-nav__icon jo-nav__theme" aria-label={l.toLight} data-label-dark={l.toLight} data-label-light={l.toDark}>
        <svg
          class="jo-nav__sun"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
        <svg
          class="jo-nav__moon"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      </button>

      <button type="button" class="jo-nav__icon jo-nav__burger" aria-expanded="false" aria-label={l.menu}>
        <svg
          class="jo-nav__open"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
        <svg
          class="jo-nav__close"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  </div>
</header>
