<script lang="ts">
  import { app } from '$lib/app.svelte';
  import { t } from '$lib/locales';
  import type { Upcoming } from '$lib/types';
  import { reveal } from '$lib/utils/actions';

  /** A game that isn't built yet: the same card as a game, dashed and not a link, with a "coming soon" note. */
  let { game, index }: { game: Upcoming; index: number } = $props();
  const c = $derived(t(app.locale).games);
</script>

<li use:reveal={{ delay: (index % 3) * 90 }}>
  <article class="card" aria-labelledby="soon-{game.slug}">
    <div class="chrome mono" aria-hidden="true">
      <span class="dots"><i></i><i></i><i></i></span><span class="file">~/games/<b>{game.slug}</b>/</span>
    </div>
    <div class="thumb" aria-hidden="true"><span class="glyph mono">{game.icon}</span></div>
    <div class="row">
      <span class="tag fw"><span class="sr-only">{c.builtWith} </span>{game.framework}</span>
      <span class="genre mono">{game.genre[app.locale]}</span>
    </div>
    <h3 id="soon-{game.slug}">{game.title[app.locale]}</h3>
    <p class="desc">{game.description[app.locale]}</p>
    <span class="soon mono"><span class="com">// </span>{c.soon}</span>
  </article>
</li>

<style>
  li {
    display: grid;
  }
  .card {
    display: grid;
    gap: 0.6rem;
    align-content: start;
    padding: 0 1.2rem 1.2rem;
    border: 1px dashed color-mix(in srgb, var(--muted) 45%, transparent);
    border-radius: var(--radius);
    background: color-mix(in srgb, var(--surface) 50%, transparent);
    overflow: hidden;
  }
  .chrome {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    margin: 0 -1.2rem 0.3rem;
    padding: 0.45rem 0.9rem;
    font-size: 0.68rem;
    color: var(--muted);
    border-bottom: 1px dashed color-mix(in srgb, var(--muted) 35%, transparent);
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
    flex: none;
  }
  .dots i {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 1px solid var(--border);
  }
  .thumb {
    display: grid;
    place-items: center;
    height: 96px;
    border: 1px dashed color-mix(in srgb, var(--muted) 30%, transparent);
    border-radius: var(--radius-sm);
  }
  /* The same brand gradient as the game thumbnails, on a code glyph instead of an icon */
  .glyph {
    font-size: 2.2rem;
    font-weight: 800;
    letter-spacing: -0.04em;
    background: linear-gradient(90deg, var(--accent), var(--accent-2));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    opacity: 0.8;
  }
  .row {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    flex-wrap: wrap;
    align-items: center;
  }
  .fw {
    color: var(--accent-text);
    border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  }
  .genre {
    color: var(--muted);
    font-size: 0.75rem;
  }
  h3 {
    font-family: var(--mono);
    font-size: 1.15rem;
    letter-spacing: -0.03em;
  }
  .desc {
    color: var(--muted);
    font-size: 0.88rem;
  }
  .soon {
    font-size: 0.78rem;
    color: var(--muted);
  }
  .com {
    color: var(--syn-com, var(--muted));
  }
</style>
