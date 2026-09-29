/**
 * Meeting Bingo: the rules are in game.ts; this is the SolidJS UI. Solid's signals update just the squares and lines
 * that change, so a meeting ticking along re-renders almost nothing.
 */
import '@fontsource-variable/jetbrains-mono';
import './style.css';
import { For, Show, createSignal, onCleanup, onMount } from 'solid-js';
import { render } from 'solid-js/web';
import { MEETING, cardText, mark, newGame, step, text, type Lang, type Line, type State } from './game';
import { followHub, initialLang, loadBest, saveBest } from './host.js';

const TEXT = {
  en: {
    title: 'Meeting Bingo',
    tagline: 'A meeting is about to start. Your card has 24 things people always say.',
    how: 'When someone says one, click it on your card. Five in a row, column or diagonal is bingo. Clicking something nobody said is a false alarm (−50). Get bingo before the meeting runs over.',
    start: 'Press Space or tap to join the meeting',
    live: 'live transcript',
    left: 'left',
    score: 'score',
    best: 'best',
    falseAlarm: 'nobody said that (−50)',
    bingo: 'BINGO!',
    email: 'This meeting could have been an email.',
    overtime: 'The meeting ran over',
    overtimeSub: '"Let\'s schedule a follow-up to discuss." No bingo this time.',
    result: 'score {score} · {false} false alarms',
    newBest: 'New best score!',
    again: 'Press Space or tap to join another meeting',
    joined: 'You joined the meeting.'
  },
  nl: {
    title: 'Meeting Bingo',
    tagline: 'Er begint zo een meeting. Op je kaart staan 24 dingen die mensen altijd zeggen.',
    how: 'Zegt iemand er een, klik hem dan aan op je kaart. Vijf op een rij, kolom of diagonaal is bingo. Iets aanklikken dat niemand zei is vals alarm (−50). Haal bingo voor de meeting uitloopt.',
    start: 'Druk op spatie of tik om de meeting in te gaan',
    live: 'live transcript',
    left: 'nog',
    score: 'score',
    best: 'record',
    falseAlarm: 'dat zei niemand (−50)',
    bingo: 'BINGO!',
    email: 'Deze meeting had een mail kunnen zijn.',
    overtime: 'De meeting liep uit',
    overtimeSub: '"Laten we een vervolgoverleg inplannen." Geen bingo deze keer.',
    result: 'score {score} · {false} keer vals alarm',
    newBest: 'Nieuw record!',
    again: 'Druk op spatie of tik voor de volgende meeting',
    joined: 'Je bent de meeting binnengekomen.'
  }
};
const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));

type Mode = 'title' | 'playing' | 'bingo' | 'overtime';

function App() {
  const [lang, setLang] = createSignal<Lang>(initialLang() as Lang);
  const t = () => TEXT[lang()];
  const [mode, setMode] = createSignal<Mode>('title');
  const [game, setGame] = createSignal<State>(newGame(1), { equals: false });
  const [lines, setLines] = createSignal<Line[]>([]);
  const [wrong, setWrong] = createSignal(-1);
  const [best, setBest] = createSignal(loadBest());
  const [newBest, setNewBest] = createSignal(false);
  let log!: HTMLOListElement;
  let raf = 0;
  let prev = 0;

  function start() {
    setGame(newGame((Date.now() % 2 ** 31) | 1));
    setLines([]);
    setNewBest(false);
    setMode('playing');
  }

  function finish(m: Mode) {
    setMode(m);
    const s = game();
    if (s.score > best()) {
      setBest(s.score);
      setNewBest(true);
      saveBest(s.score);
    }
  }

  function loop(now: number) {
    const dt = Math.min(0.1, (now - prev) / 1000 || 0);
    prev = now;
    if (mode() === 'playing') {
      const s = game();
      const said = step(s, dt);
      if (said.length) {
        setLines((l) => [...l, ...said].slice(-40));
        queueMicrotask(() => log?.lastElementChild?.scrollIntoView({ block: 'end', behavior: 'smooth' }));
      }
      setGame(s);
      if (s.phase === 'overtime') finish('overtime');
    }
    raf = requestAnimationFrame(loop);
  }

  function click(i: number) {
    if (mode() !== 'playing') return;
    const s = game();
    const r = mark(s, i);
    if (r === 'false-alarm') {
      setWrong(i);
      setTimeout(() => setWrong(-1), 700);
    }
    setGame(s);
    if (r === 'bingo') finish('bingo');
  }

  const primary = () => {
    if (mode() !== 'playing') start();
  };
  const onKey = (e: KeyboardEvent) => {
    if ((e.key === ' ' || e.key === 'Enter') && mode() !== 'playing' && !e.repeat) {
      e.preventDefault();
      start();
    }
  };

  onMount(() => {
    followHub((l: Lang) => setLang(l));
    window.addEventListener('keydown', onKey);
    raf = requestAnimationFrame(loop);
  });
  onCleanup(() => {
    cancelAnimationFrame(raf);
    window.removeEventListener('keydown', onKey);
  });

  const left = () => Math.max(0, Math.ceil(MEETING - game().time));
  const clock = () => `${Math.floor(left() / 60)}:${String(left() % 60).padStart(2, '0')}`;

  return (
    <main class="stage" data-phase={mode()} data-score={game().score} lang={lang()}>
      <header class="hud">
        <p>
          <span class="rec" /> {t().left} <b>{clock()}</b>
        </p>
        <p>
          {t().score} <b>{game().score}</b>
        </p>
        <p>
          {t().best} <b>{best()}</b>
        </p>
      </header>
      <div class="room">
        <section class="card" aria-label="bingo">
          <For each={game().card}>
            {(phrase, i) => (
              <button
                type="button"
                class="cell"
                classList={{
                  marked: game().marked[i()],
                  free: phrase < 0,
                  win: !!game().line?.includes(i()),
                  wrong: wrong() === i()
                }}
                aria-pressed={game().marked[i()]}
                disabled={mode() !== 'playing'}
                onClick={() => click(i())}
              >
                {cardText(phrase, lang())}
              </button>
            )}
          </For>
        </section>
        <section class="call" aria-label={t().live}>
          <p class="call-title">
            <span class="rec" /> {t().live}
          </p>
          <ol class="log" ref={log} aria-live="polite">
            <li class="system">{t().joined}</li>
            <For each={lines()}>
              {(l) => (
                <li>
                  <b>{l.speaker}:</b> {text(game(), l, lang())}
                </li>
              )}
            </For>
          </ol>
          <Show when={wrong() >= 0}>
            <p class="false">{t().falseAlarm}</p>
          </Show>
        </section>
      </div>
      <Show when={mode() !== 'playing'}>
        <div class="overlay" onClick={primary}>
          <Show when={mode() === 'title'}>
            <p class="big">{t().title}</p>
            <p class="sub">{t().tagline}</p>
            <p class="how">{t().how}</p>
          </Show>
          <Show when={mode() === 'bingo'}>
            <p class="big win">{t().bingo}</p>
            <p class="sub">{t().email}</p>
          </Show>
          <Show when={mode() === 'overtime'}>
            <p class="big lose">{t().overtime}</p>
            <p class="sub">{t().overtimeSub}</p>
          </Show>
          <Show when={mode() === 'bingo' || mode() === 'overtime'}>
            <p class="how">{fill(t().result, { score: game().score, false: game().falseAlarms })}</p>
            <Show when={newBest()}>
              <p class="accent">{t().newBest}</p>
            </Show>
          </Show>
          <p class="hint">{mode() === 'title' ? t().start : t().again}</p>
        </div>
      </Show>
    </main>
  );
}

render(() => <App />, document.getElementById('app')!);
