<script lang="ts">
  import { onMount } from 'svelte';
  import {
    GENERATORS,
    IPO_AT,
    OPTION_BONUS,
    affordable,
    buy,
    buyUpgrade,
    canIpo,
    clickValue,
    cost,
    duration,
    genMult,
    genRate,
    globalMult,
    ipo,
    money,
    newState,
    offline,
    optionsOnIpo,
    push,
    rate,
    revive,
    rollback,
    tick,
    visibleGens,
    visibleUpgrades,
    type GenId,
    type State,
    type Upgrade
  } from './lib/engine';
  import { type Lang, fill, isLang, text } from './lib/i18n';

  let { initialLang }: { initialLang: Lang } = $props();
  // the hub can switch the language while you play; the prop is only where it starts
  // svelte-ignore state_referenced_locally
  let lang = $state(initialLang);
  const t = $derived(text[lang]);

  const SAVE_KEY = 'play:deploy-tycoon:save';
  const load = (): State => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? revive(JSON.parse(raw)) : newState();
    } catch {
      return newState();
    }
  };
  const save = () => {
    s.lastSeen = Date.now();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify($state.snapshot(s)));
    } catch {
      /* private mode: progress just won't stick */
    }
  };

  let s = $state(load());
  let mode = $state<1 | 10 | 'max'>(1);
  let feed = $state<{ id: number; text: string; kind: string }[]>([]);
  let floats = $state<{ id: number; text: string; x: number }[]>([]);
  let incidentTitle = $state(0);
  let dialog = $state<null | { kind: 'welcome'; seconds: number; earned: number } | { kind: 'ipo' } | { kind: 'reset' }>(null);
  let say = $state('');
  let n = 0;

  const log = (line: string, kind = 'out') => {
    feed = [...feed.slice(-40), { id: ++n, text: line, kind }];
  };

  const genName = (id: GenId) => t.gens[id][0];
  const upgradeText = (u: Upgrade): [string, string] => {
    if (u.effect.kind === 'gen') {
      const tier = Number(u.id.split('-')[1]);
      const name = genName(u.effect.gen);
      return [`${name}: ${t.tiers[tier]}`, fill(t.tierDesc, { name })];
    }
    return t.specials[u.id];
  };

  function doPush(e?: MouseEvent) {
    const v = push(s);
    const x = e && e.currentTarget instanceof HTMLElement ? e.offsetX : 60 + Math.random() * 120;
    const id = ++n;
    floats = [...floats.slice(-12), { id, text: `+$${money(v)}`, x }];
    setTimeout(() => (floats = floats.filter((f) => f.id !== id)), 800);
  }

  function doBuy(id: GenId) {
    const got = buy(s, id, mode === 'max' ? Infinity : mode);
    if (got) log(fill(t.bought, { n: got, name: genName(id) }), 'buy');
  }

  function doUpgrade(u: Upgrade) {
    if (buyUpgrade(s, u.id)) log(`+ ${upgradeText(u)[0]}`, 'buy');
  }

  function doRollback() {
    if (rollback(s)) {
      log(t.resolved, 'ok');
      say = t.resolved;
    }
  }

  function doIpo() {
    const gained = optionsOnIpo(s);
    s = ipo(s);
    dialog = null;
    feed = [];
    log(`🔔 IPO! +${gained} ${t.options}`, 'ok');
    save();
  }

  function doReset() {
    s = newState();
    dialog = null;
    feed = [];
    save();
  }

  /** Price of the next purchase in the current buy mode, and how many that is. */
  function price(id: GenId) {
    const g = GENERATORS.find((x) => x.id === id)!;
    const count = mode === 'max' ? Math.max(1, affordable(g, s.owned[id], s.money)) : mode;
    return { count, price: cost(g, s.owned[id], count) };
  }

  onMount(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.data?.type !== 'play:settings') return;
      if (isLang(e.data.lang)) {
        lang = e.data.lang;
        document.documentElement.lang = lang;
      }
    };
    window.addEventListener('message', onMessage);
    const back = offline(s);
    if (back.earned > 0) dialog = { kind: 'welcome', ...back };
    let last = performance.now();
    const loop = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(5, (now - last) / 1000);
      last = now;
      if (document.hidden) return;
      for (const e of tick(s, dt)) {
        if (e.kind === 'incident') {
          incidentTitle = Math.floor(Math.random() * t.incidents.length);
          log(`✗ ${t.incidents[incidentTitle]}`, 'err');
          say = t.incidents[incidentTitle];
        } else if (e.kind === 'resolved') log(t.autoResolved, 'ok');
        else if (e.kind === 'round') {
          log(fill(t.newRound, { round: t.rounds[e.round] }), 'ok');
          say = fill(t.newRound, { round: t.rounds[e.round] });
        } else if (e.kind === 'news') log(`📰 ${t.news[e.id % t.news.length]} +$${money(e.bonus)}`, 'news');
      }
    }, 100);
    const autosave = setInterval(save, 5000);
    const onVisible = () => {
      if (document.hidden) return save();
      // back from another tab: pay out the time away like a closed tab
      const back = offline(s);
      if (back.earned > 0) dialog = { kind: 'welcome', ...back };
      last = performance.now();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pagehide', save);
    return () => {
      clearInterval(loop);
      clearInterval(autosave);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pagehide', save);
      window.removeEventListener('message', onMessage);
      save();
    };
  });

  const perSec = $derived(rate(s));
  const gens = $derived(visibleGens(s));
  const ups = $derived(visibleUpgrades(s).slice(0, 12));
  const nextOptions = $derived(optionsOnIpo(s));
</script>

<main class="app" data-round={s.round}>
  <header class="top">
    <div class="brand">
      <p class="path">{t.rounds[s.round]}</p>
      <h1>{t.title}</h1>
    </div>
    <div class="cash" aria-live="off">
      <p class="label">{t.cash}</p>
      <p class="amount" data-testid="cash">${money(s.money)}</p>
      <p class="rate" class:down={s.incident >= 0}>${money(perSec)}{t.perSec}</p>
    </div>
    {#if s.options > 0}
      <p class="options" title={fill(t.optionsBonus, { p: Math.round(s.options * OPTION_BONUS * 100) })}>
        📈 {s.options} <span>{t.options}</span>
      </p>
    {/if}
  </header>

  <section class="left">
    <div class="push-wrap">
      <button class="push" onclick={doPush} data-testid="push">
        <span class="cmd">{t.push}</span>
        <span class="sub">{fill(t.perPush, { n: money(clickValue(s)) })}</span>
        {#each floats as f (f.id)}
          <span class="float" style:left="{f.x}px" aria-hidden="true">{f.text}</span>
        {/each}
      </button>
    </div>

    {#if s.incident >= 0}
      <div class="incident" role="alert">
        <p class="what">🔥 {t.incidents[incidentTitle]}</p>
        <p class="desc">{s.upgrades.includes('sre') ? t.incidentAuto : t.incidentDesc}</p>
        <button class="btn danger" onclick={doRollback}>{t.incidentFix}</button>
      </div>
    {/if}

    <div class="card ipo">
      <h2>{t.ipo}</h2>
      {#if canIpo(s)}
        <p>{fill(t.ipoDesc, { n: nextOptions, p: Math.round(nextOptions * OPTION_BONUS * 100) })}</p>
        <button class="btn primary" onclick={() => (dialog = { kind: 'ipo' })}>🔔 {t.ipo}</button>
      {:else}
        <p class="muted">{fill(t.ipoLocked, { n: money(IPO_AT) })}</p>
        <div class="progress" aria-hidden="true"><i style:width="{Math.min(100, (s.earned / IPO_AT) * 100)}%"></i></div>
      {/if}
    </div>

    <div class="card stats">
      <h2>{t.stats}</h2>
      <dl>
        <dt>{t.clicks}</dt>
        <dd>{s.clicks.toLocaleString(lang)}</dd>
        <dt>{t.played}</dt>
        <dd>{duration(s.played)}</dd>
        <dt>{t.options}</dt>
        <dd>{s.options}</dd>
      </dl>
      <button class="link" onclick={() => (dialog = { kind: 'reset' })}>{t.reset}</button>
    </div>
  </section>

  <section class="middle">
    <div class="head">
      <h2>{t.team}</h2>
      <div class="mode" role="group" aria-label={t.buyMode}>
        {#each [1, 10, 'max'] as const as m (m)}
          <button class:on={mode === m} aria-pressed={mode === m} onclick={() => (mode = m)}>{m === 'max' ? t.max : `×${m}`}</button>
        {/each}
      </div>
    </div>
    <ul class="gens">
      {#each gens as g (g.id)}
        {@const p = price(g.id)}
        <li>
          <button class="gen" disabled={s.money < p.price} onclick={() => doBuy(g.id)}>
            <span class="name">{t.gens[g.id][0]}</span>
            <span class="owned">{s.owned[g.id]}</span>
            <span class="desc">{t.gens[g.id][1]}</span>
            <span class="meta">
              ${money(g.rate * genMult(s, g.id) * globalMult(s))}{t.perSec}
              {t.each}{#if s.owned[g.id]}&nbsp;· ${money(genRate(s, g))}{t.perSec}{/if}
            </span>
            <span class="price">{p.count > 1 ? `×${p.count} ` : ''}${money(p.price)}</span>
          </button>
        </li>
      {/each}
    </ul>
  </section>

  <section class="right">
    <h2>{t.upgrades}</h2>
    {#if ups.length}
      <ul class="ups">
        {#each ups as u (u.id)}
          {@const [name, desc] = upgradeText(u)}
          <li>
            <button class="up" disabled={s.money < u.cost} onclick={() => doUpgrade(u)} title={desc}>
              <span class="name">{name}</span>
              <span class="desc">{desc}</span>
              <span class="price">${money(u.cost)}</span>
            </button>
          </li>
        {/each}
      </ul>
    {:else}
      <p class="muted">{t.noUpgrades}</p>
    {/if}

    <h2>{t.feed}</h2>
    <div class="feed" role="log">
      {#each feed.slice(-8) as line (line.id)}
        <p class={line.kind}>{line.text}</p>
      {/each}
    </div>
  </section>

  {#if dialog}
    <div class="backdrop">
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        {#if dialog.kind === 'welcome'}
          <h2 id="dialog-title">{t.welcome}</h2>
          <p>{fill(t.welcomeDesc, { time: duration(dialog.seconds), n: money(dialog.earned) })}</p>
          <button class="btn primary" onclick={() => (dialog = null)}>{t.nice}</button>
        {:else if dialog.kind === 'ipo'}
          <h2 id="dialog-title">🔔 {t.ipo}</h2>
          <p>{fill(t.ipoDesc, { n: nextOptions, p: Math.round(nextOptions * OPTION_BONUS * 100) })}</p>
          <div class="row">
            <button class="btn primary" onclick={doIpo}>{t.ipoConfirm}</button>
            <button class="btn" onclick={() => (dialog = null)}>{t.cancel}</button>
          </div>
        {:else}
          <h2 id="dialog-title">{t.reset}</h2>
          <p>{t.resetConfirm}</p>
          <div class="row">
            <button class="btn danger" onclick={doReset}>{t.reset}</button>
            <button class="btn" onclick={() => (dialog = null)}>{t.cancel}</button>
          </div>
        {/if}
      </div>
    </div>
  {/if}

  <p class="sr-only" aria-live="polite">{say}</p>
</main>
