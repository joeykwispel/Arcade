<script lang="ts">
  import { onMount } from 'svelte';
  import { app } from '$lib/app.svelte';
  import { gameSrc } from '$lib/games';
  import { fill, t } from '$lib/locales';
  import { settingsMessage } from '$lib/messages';
  import Seo from '$lib/components/Seo.svelte';

  let { data } = $props();
  const game = $derived(data.game);
  const c = $derived(t(app.locale));
  const title = $derived(game.title[app.locale]);
  // The language goes along in the URL, so the game has it on its first frame; theme changes follow over postMessage.
  const src = $derived(`${gameSrc(game)}?lang=${app.locale}`);

  let frame: HTMLIFrameElement;

  const theme = () => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
  const send = () => frame?.contentWindow?.postMessage(settingsMessage(app.locale, theme()), location.origin);

  function onload() {
    send();
    // Hand the keyboard to the game, so Space works right away instead of scrolling the page.
    frame.focus();
  }

  onMount(() => {
    // Listen here instead of with an onload attribute: server-rendered, Svelte turns that into an inline
    // `onload="this.__e=event"` handler, which the site's CSP blocks. The frame may have loaded before hydration.
    frame.addEventListener('load', onload);
    if (frame.contentDocument?.readyState === 'complete' && frame.contentWindow?.location.href !== 'about:blank') onload();
    // The header's theme button only changes data-theme on <html>; pass every change on to the game.
    const mo = new MutationObserver(send);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      frame.removeEventListener('load', onload);
      mo.disconnect();
    };
  });
</script>

<Seo
  title={fill(c.meta.gameTitle, { title })}
  description={fill(c.meta.gameDescription, { description: game.description[app.locale], framework: game.framework })}
  path={`/play/${game.slug}/`}
  image={`/og/${game.slug}.png`}
  imageAlt={`${title}: ${game.framework}`}
/>

<div class="container wrap">
  <a class="btn back" href={app.href('/')}><span class="prompt" aria-hidden="true">&gt;</span> cd .. <span class="sub">({c.play.back})</span></a>

  <div class="head">
    <h1>{title}</h1>
    <span class="tag fw"><span class="sr-only">{c.games.builtWith} </span>{game.framework}</span>
    {#if game.tooling}<span class="tool mono">{game.tooling}</span>{/if}
  </div>

  <div class="window glass" style:--aspect={game.aspect ?? '3 / 1'}>
    <div class="chrome mono" aria-hidden="true">
      <span class="dots"><i></i><i></i><i></i></span><span class="file">~/games/<b>{game.slug}</b>/index.html</span>
    </div>
    <iframe bind:this={frame} {src} title={fill(c.play.frame, { title, framework: game.framework })}></iframe>
  </div>

  <div class="below">
    {#if game.controls}
      <p class="controls"><span class="com mono">// {c.play.controls}:</span>&nbsp;{game.controls[app.locale]}</p>
    {/if}
    <a class="standalone mono" href={src} target="_blank" rel="noopener noreferrer"
      >{c.play.standalone} <span aria-hidden="true">↗</span><span class="sr-only"> {c.footer.newTab}</span></a
    >
  </div>
</div>

<style>
  .wrap {
    display: grid;
    gap: 1rem;
    padding-block: clamp(1rem, 3vw, 1.75rem) clamp(2rem, 5vw, 3.5rem);
  }
  .back {
    justify-self: start;
    font-size: 0.85rem;
    --pad: 0.5rem 0.9rem;
  }
  .prompt {
    color: var(--accent-text);
  }
  .sub {
    color: var(--muted);
    font-weight: 500;
  }
  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.9rem;
  }
  h1 {
    font-family: var(--mono);
    font-size: clamp(1.6rem, 3.4vw, 2.3rem);
    letter-spacing: -0.04em;
    margin-right: 0.3rem;
    animation: fade-up 0.8s var(--ease) both;
  }
  .fw {
    color: var(--accent-text);
    border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  }
  .tool {
    color: var(--muted);
    font-size: 0.78rem;
  }
  .window {
    overflow: hidden;
    display: grid;
    border-color: color-mix(in srgb, var(--accent) 30%, var(--border));
  }
  .window:focus-within {
    border-color: color-mix(in srgb, var(--accent) 60%, var(--border));
  }
  .chrome {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    padding: 0.45rem 0.9rem;
    font-size: 0.68rem;
    color: var(--muted);
    border-bottom: 1px solid var(--border);
    background: var(--surface);
    white-space: nowrap;
    overflow: hidden;
  }
  .chrome b {
    color: var(--text);
    font-weight: 600;
  }
  .dots {
    display: flex;
    gap: 5px;
  }
  .dots i {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--border);
  }
  .window:focus-within .dots i:nth-child(1) {
    background: #ff5f57;
  }
  .window:focus-within .dots i:nth-child(2) {
    background: #febc2e;
  }
  .window:focus-within .dots i:nth-child(3) {
    background: #28c840;
  }
  iframe {
    display: block;
    width: 100%;
    aspect-ratio: var(--aspect);
    min-height: 220px;
    /* never taller than the space under the header */
    max-height: calc(100svh - var(--nav-h) - 12rem);
    border: 0;
    background: transparent;
  }
  /* The iframe itself shows focus through the window border and traffic lights. */
  iframe:focus-visible {
    outline: none;
  }
  .below {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.5rem 1.5rem;
  }
  .controls {
    color: var(--muted);
    font-size: 0.9rem;
  }
  .controls .com {
    font-style: normal;
  }
  .standalone {
    font-size: 0.85rem;
    font-weight: 600;
  }
  @media (max-width: 640px) {
    iframe {
      aspect-ratio: 4 / 3;
    }
  }
</style>
