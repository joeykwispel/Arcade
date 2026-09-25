<script lang="ts">
  import { page } from '$app/state';
  import { localeOf, localize } from '$lib/i18n';
  import { t } from '$lib/locales';
  import Scramble from '$lib/components/Scramble.svelte';

  // The error page can render for any URL, so read the language from it.
  const locale = $derived(localeOf(page.url.pathname));
  const e = $derived(t(locale).error);
  const path = $derived(page.url.pathname);
</script>

<svelte:head>
  <title>{page.status} | {e.notFound}</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="wrap">
  <h1 class="mono"><Scramble text={String(page.status)} trigger="mount" duration={900} /></h1>
  <div class="term glass">
    <div class="chrome mono" aria-hidden="true"><span class="dots"><i></i><i></i><i></i></span>bash</div>
    <pre class="mono"><span class="prop">joey@play</span>:<span class="dir">~</span>$ cd {path}
<span class="err">Uncaught Error: {e.notFound}</span>
<span class="com">    at Hub.launch (games.json:404)
    at Router.go ({path})</span
      >

<span class="com">// {e.line}</span>
<span class="prop">joey@play</span>:<span class="dir">~</span>$ <span class="caret"></span></pre>
  </div>
  <a class="btn btn-primary" href={localize('/', locale)}><span aria-hidden="true">&gt;</span> cd ~ <span class="sub">({e.home})</span></a>
</div>

<style>
  .wrap {
    min-height: calc(100svh - var(--nav-h) - 6rem);
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 1.2rem;
    padding: 2rem 1rem;
    text-align: center;
  }
  h1 {
    font-size: clamp(5rem, 22vw, 11rem);
    line-height: 0.9;
    letter-spacing: -0.08em;
    background: linear-gradient(110deg, var(--accent), var(--accent-2));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .term {
    width: min(560px, 100%);
    overflow: hidden;
    text-align: left;
    background: color-mix(in srgb, var(--bg) 75%, transparent);
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
  pre {
    margin: 0;
    padding: 1rem 1.1rem;
    font-size: 0.8rem;
    line-height: 1.7;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .dir {
    color: var(--syn-fn);
  }
  .err {
    color: var(--syn-num);
  }
  .sub {
    opacity: 0.75;
    font-weight: 500;
  }
</style>
