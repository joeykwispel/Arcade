<script lang="ts">
  import { base } from '$app/paths';
  import { app } from '$lib/app.svelte';
  import { t } from '$lib/locales';
  import type { Game } from '$lib/types';
  import { reveal, tilt } from '$lib/utils/actions';

  /** A game tile in the portfolio's card style (window bar, frosted glass, rotating border). The whole card is the link. */
  let { game, index }: { game: Game; index: number } = $props();
  const c = $derived(t(app.locale).games);
</script>

<li use:reveal={{ delay: (index % 3) * 90 }}>
  <a class="card glass ring" href={app.href(`/play/${game.slug}/`)} use:tilt={5}>
    <div class="chrome mono" aria-hidden="true">
      <span class="dots"><i></i><i></i><i></i></span><span class="file">~/games/<b>{game.slug}</b>/index.html</span>
    </div>
    <div class="thumb" aria-hidden="true">
      <span class="icon" style:--icon={`url('${base}${game.thumbnail}')`}></span>
    </div>
    <div class="row">
      <span class="tag fw"><span class="sr-only">{c.builtWith} </span>{game.framework}</span>
      {#if game.tooling}<span class="tool mono">{game.tooling}</span>{/if}
    </div>
    <h3>{game.title[app.locale]}</h3>
    <p class="desc">{game.description[app.locale]}</p>
    <span class="cta mono" aria-hidden="true"><span class="prompt">&gt;</span> {c.play} <span class="arrow">→</span></span>
  </a>
</li>

<style>
  li {
    display: grid;
  }
  .card {
    --mx: 50%;
    --my: 0%;
    padding: 0 1.2rem 1.2rem;
    display: grid;
    gap: 0.6rem;
    align-content: start;
    color: var(--text);
    text-decoration: none;
    overflow: hidden;
    border-color: color-mix(in srgb, var(--accent) 30%, var(--border));
    transition:
      transform 0.25s ease-out,
      border-color 0.3s;
    will-change: transform;
  }
  .card::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(320px circle at var(--mx) var(--my), var(--glow), transparent 70%);
    opacity: 0;
    transition: opacity 0.3s;
    pointer-events: none;
  }
  .card:hover {
    border-color: color-mix(in srgb, var(--accent) 45%, var(--border));
  }
  .card:hover::before {
    opacity: 1;
  }
  .card:focus-visible {
    border-radius: var(--radius);
  }
  .chrome {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    margin: 0 -1.2rem 0.3rem;
    padding: 0.45rem 0.9rem;
    font-size: 0.68rem;
    color: var(--muted);
    border-bottom: 1px solid var(--border);
    background: var(--surface);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
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
    background: var(--border);
    transition: background 0.3s;
  }
  .card:hover .dots i:nth-child(1) {
    background: #ff5f57;
  }
  .card:hover .dots i:nth-child(2) {
    background: #febc2e;
  }
  .card:hover .dots i:nth-child(3) {
    background: #28c840;
  }
  .thumb {
    display: grid;
    place-items: center;
    height: 132px;
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    background:
      linear-gradient(var(--grid-line) 1px, transparent 1px) 0 0 / 12px 12px,
      linear-gradient(90deg, var(--grid-line) 1px, transparent 1px) 0 0 / 12px 12px,
      color-mix(in srgb, var(--bg) 60%, transparent);
  }
  /* The thumbnail is a one-color SVG used as a mask, so it takes the brand gradient in both themes. */
  .icon {
    width: min(220px, 80%);
    height: 96px;
    background: linear-gradient(90deg, var(--accent), var(--accent-2));
    -webkit-mask: var(--icon) center / contain no-repeat;
    mask: var(--icon) center / contain no-repeat;
    transition: transform 0.35s var(--ease);
  }
  .card:hover .icon {
    transform: translateY(-4px);
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
  .tool {
    color: var(--muted);
    font-size: 0.78rem;
  }
  h3 {
    font-family: var(--mono);
    font-size: 1.3rem;
    letter-spacing: -0.03em;
  }
  .desc {
    color: var(--muted);
    font-size: 0.9rem;
  }
  .cta {
    justify-self: start;
    margin-top: 0.3rem;
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--accent-text);
  }
  .prompt {
    opacity: 0.6;
  }
  .arrow {
    display: inline-block;
    transition: transform 0.3s var(--ease);
  }
  .card:hover .arrow {
    transform: translateX(4px);
  }
</style>
