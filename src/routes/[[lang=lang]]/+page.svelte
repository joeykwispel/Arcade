<script lang="ts">
  import { app } from '$lib/app.svelte';
  import { games, upcoming } from '$lib/games';
  import { t } from '$lib/locales';
  import { reveal } from '$lib/utils/actions';
  import GameCard from '$lib/components/GameCard.svelte';
  import UpcomingCard from '$lib/components/UpcomingCard.svelte';
  import SectionHead from '$lib/components/SectionHead.svelte';
  import Seo from '$lib/components/Seo.svelte';

  const c = $derived(t(app.locale));
</script>

<Seo title={c.meta.title} description={c.meta.description} />

<!-- The intro and the grid share one section, so the games are on the first screen. -->
<section class="hero" id="games">
  <div class="container">
    <p class="kicker mono"><span class="prop">joey@play</span>:<span class="dir">~</span>$ ls games/<span class="caret" aria-hidden="true"></span></p>
    <h1>{c.hero.title} <span class="grad">{c.hero.titleAccent}</span></h1>
    <p class="intro">{c.hero.intro}</p>
    <h2 class="sr-only">{c.games.title}</h2>
    <ul class="grid">
      {#each games as game, i (game.slug)}
        <GameCard {game} index={i} />
      {/each}
      <li class="next-wrap" use:reveal={{ delay: (games.length % 3) * 90 }}>
        <div class="next">
          <span class="plus mono" aria-hidden="true">+</span>
          <h3 class="mono">{c.games.next}</h3>
          <p>{c.games.nextDescription}</p>
          <span class="soon mono"><span class="com">// </span>{c.games.soon}</span>
        </div>
      </li>
    </ul>
  </div>
</section>

{#if upcoming.length}
  <section class="section" id="upcoming">
    <div class="container">
      <SectionHead slug="roadmap" ext=".md" title={c.upcoming.title} intro={c.upcoming.intro} />
      <ul class="grid">
        {#each upcoming as game, i (game.slug)}
          <UpcomingCard {game} index={i} />
        {/each}
      </ul>
    </div>
  </section>
{/if}

<section class="section" id="how">
  <div class="container">
    <SectionHead slug="how-it-works" ext=".md" title={c.how.title} intro={c.how.intro} />
    <ol class="steps">
      {#each c.how.steps as step, i (step.title)}
        <li class="step glass" use:reveal={{ delay: i * 90 }}>
          <span class="idx mono" aria-hidden="true">{String(i + 1).padStart(2, '0')}.</span>
          <h3>{step.title}</h3>
          <p>{step.body}</p>
        </li>
      {/each}
    </ol>
    <div class="table-wrap glass" use:reveal>
      <table>
        <caption class="sr-only">{c.how.table.caption}</caption>
        <thead>
          <tr>
            <th scope="col">{c.how.table.game}</th>
            <th scope="col">{c.how.table.framework}</th>
            <th scope="col">{c.how.table.tooling}</th>
          </tr>
        </thead>
        <tbody>
          {#each games as game (game.slug)}
            <tr>
              <th scope="row"><a href={app.href(`/play/${game.slug}/`)}>{game.title[app.locale]}</a></th>
              <td>{game.framework}</td>
              <td>{game.tooling ?? '–'}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
</section>

<style>
  .hero {
    padding-block: clamp(1.5rem, 4vw, 2.5rem) clamp(1rem, 3vw, 2rem);
  }
  .kicker {
    font-size: 0.85rem;
    color: var(--muted);
    margin-bottom: 0.6rem;
  }
  .dir {
    color: var(--syn-fn);
  }
  h1 {
    font-size: clamp(2.1rem, 5vw, 3.4rem);
    line-height: 1;
    letter-spacing: -0.04em;
    animation: fade-up 0.8s var(--ease) both;
  }
  .grad {
    background: linear-gradient(90deg, var(--accent), var(--accent-2));
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .intro {
    margin: 0.8rem 0 1.5rem;
    color: var(--muted);
    font-size: 1.05rem;
    animation: fade-up 0.8s var(--ease) 0.1s both;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1rem;
  }
  .next-wrap {
    display: grid;
  }
  .next {
    display: grid;
    align-content: center;
    justify-items: start;
    gap: 0.6rem;
    padding: 1.4rem 1.2rem;
    border: 1px dashed color-mix(in srgb, var(--muted) 45%, transparent);
    border-radius: var(--radius);
    color: var(--muted);
    background: color-mix(in srgb, var(--surface) 50%, transparent);
  }
  .plus {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border: 1px dashed currentColor;
    border-radius: var(--radius-sm);
    font-size: 1.4rem;
    color: var(--accent-text);
  }
  .next h3 {
    color: var(--text);
    font-size: 1.05rem;
    letter-spacing: -0.03em;
  }
  .next p {
    font-size: 0.9rem;
  }
  .soon {
    font-size: 0.78rem;
  }
  .steps {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1rem;
  }
  .step {
    padding: 1.2rem;
    display: grid;
    align-content: start;
    gap: 0.5rem;
  }
  .step p {
    color: var(--muted);
    font-size: 0.9rem;
  }
  .idx {
    color: var(--accent-text);
    font-size: 0.8rem;
    font-weight: 700;
  }
  .table-wrap {
    margin-top: 1rem;
    overflow-x: auto;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--mono);
    font-size: 0.85rem;
  }
  th,
  td {
    text-align: left;
    padding: 0.7rem 1.2rem;
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }
  thead th {
    color: var(--muted);
    font-weight: 600;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  tbody tr:last-child > * {
    border-bottom: 0;
  }
  tbody th {
    font-weight: 600;
  }
  @media (max-width: 980px) {
    .grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
  @media (max-width: 760px) {
    .steps {
      grid-template-columns: 1fr;
    }
  }
  @media (max-width: 640px) {
    .grid {
      grid-template-columns: 1fr;
    }
  }
</style>
