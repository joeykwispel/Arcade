<script lang="ts">
  import { page } from '$app/state';
  import { Header, headerLabels } from '@joeykwispel/design-kit/svelte';
  import { app } from '$lib/app.svelte';
  import { locales } from '$lib/locales';
  import type { HeaderLink, Locale } from '$lib/types';

  /**
   * The joeyoosenbrug.nl header from the design kit, fed with this site's links and the same page in the other language.
   * Markup, labels and behaviour all come from the package.
   */
  let { links }: { links: HeaderLink[] } = $props();

  const languages = $derived(locales.map((code) => ({ code, href: app.hrefFor(code, page.url.pathname), current: code === app.locale })));
</script>

<Header {links} {languages} labels={headerLabels[app.locale]} onLanguage={(code) => app.rememberLocale(code as Locale)} />
