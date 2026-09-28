<script lang="ts">
  import { app } from '$lib/app.svelte';
  import { localize } from '$lib/i18n';
  import { locales } from '$lib/locales';

  /**
   * Title, description, canonical URL, hreflang alternates and share image for a page, in the current language.
   * `image` is a site-absolute path to a 1200 × 630 PNG in static/ (generated with `npm run og`).
   */
  let {
    title,
    description,
    path = '/',
    image = '/og/play.png',
    imageAlt = 'Play: small games, different stacks'
  }: { title: string; description: string; path?: string; image?: string; imageAlt?: string } = $props();

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
  <meta property="og:image" content={siteUrl + image} />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content={imageAlt} />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:image" content={siteUrl + image} />
  <meta name="twitter:image:alt" content={imageAlt} />
</svelte:head>
