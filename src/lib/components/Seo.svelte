<script lang="ts">
  import { app } from '$lib/app.svelte';
  import { localize } from '$lib/i18n';
  import { locales } from '$lib/locales';

  /** Title, description, canonical URL and hreflang alternates for a page, in the current language. */
  let { title, description, path = '/' }: { title: string; description: string; path?: string } = $props();

  const siteUrl = 'https://play.joeyoosenbrug.nl';
  const url = $derived(siteUrl + localize(path, app.locale));
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />
  <meta name="author" content="Joey Oosenbrug" />
  <link rel="canonical" href={url} />
  {#each locales as l (l)}
    <link rel="alternate" hreflang={l} href={siteUrl + localize(path, l)} />
  {/each}
  <link rel="alternate" hreflang="x-default" href={siteUrl + localize(path, 'en')} />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Play" />
  <meta property="og:url" content={url} />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:locale" content={app.locale === 'nl' ? 'nl_NL' : 'en_US'} />
  <meta name="twitter:card" content="summary" />
</svelte:head>
