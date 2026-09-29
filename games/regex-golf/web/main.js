/**
 * Regex Golf Range: the page around the Ruby rules. ruby.wasm (Ruby 3.4 as WebAssembly) runs ruby/golf.rb, so every
 * regex you type is a real Ruby regex, checked on every keystroke.
 */
import '@fontsource-variable/jetbrains-mono';
import './style.css';
import { DefaultRubyVM } from '@ruby/wasm-wasi/dist/browser';
import rubyUrl from '@ruby/3.4-wasm-wasi/dist/ruby.wasm?url';
import source from '../ruby/golf.rb?raw';
import { followHub, initialLang, loadBest, saveBest } from './host.js';

const TEXT = {
  en: {
    hole: 'hole',
    strokes: 'strokes',
    best: 'best',
    hitThese: 'hit these',
    missThese: 'miss these',
    yourRegex: 'your regex',
    mulligan: 'mulligan (+10)',
    next: 'next hole →',
    finish: 'scorecard →',
    loading: 'Booting Ruby (ruby.wasm)…',
    failed: 'Ruby failed to start: {error}',
    tagline: 'Nine holes. Hit every green word and none of the red ones, with the shortest regex you can.',
    how: 'Your score on a hole is the length of your regex. These are real Ruby regexes, so \\h, \\b and friends all work.',
    start: 'Press Enter or tap to tee off',
    sunk: 'In the hole! {len} characters, par {par}: {verdict}',
    missing: '{n} green left to hit',
    wrong: '{n} red hit by mistake',
    done: 'Scorecard',
    total: 'total {strokes} (par {par}, {diff})',
    newBest: 'New best round!',
    again: 'Press Enter or tap to play again',
    ace: 'ace',
    eagle: 'eagle',
    birdie: 'birdie',
    par: 'par',
    bogey: 'bogey',
    over: 'over par',
    skipped: 'mulligan'
  },
  nl: {
    hole: 'hole',
    strokes: 'slagen',
    best: 'record',
    hitThese: 'raak deze',
    missThese: 'mis deze',
    yourRegex: 'je regex',
    mulligan: 'mulligan (+10)',
    next: 'volgende hole →',
    finish: 'scorekaart →',
    loading: 'Ruby opstarten (ruby.wasm)…',
    failed: 'Ruby kon niet starten: {error}',
    tagline: 'Negen holes. Raak elk groen woord en geen enkel rood, met een zo kort mogelijke regex.',
    how: 'Je score op een hole is de lengte van je regex. Het zijn echte Ruby-regexes, dus \\h, \\b en vrienden werken allemaal.',
    start: 'Druk op Enter of tik om af te slaan',
    sunk: 'In de hole! {len} tekens, par {par}: {verdict}',
    missing: 'nog {n} groen te raken',
    wrong: '{n} rood per ongeluk geraakt',
    done: 'Scorekaart',
    total: 'totaal {strokes} (par {par}, {diff})',
    newBest: 'Nieuw record!',
    again: 'Druk op Enter of tik om opnieuw te spelen',
    ace: 'ace',
    eagle: 'eagle',
    birdie: 'birdie',
    par: 'par',
    bogey: 'bogey',
    over: 'boven par',
    skipped: 'mulligan'
  }
};

const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));
const stage = $('stage');
const input = /** @type {HTMLInputElement} */ ($('regex'));
const next = /** @type {HTMLButtonElement} */ ($('next'));
const mulligan = /** @type {HTMLButtonElement} */ ($('mulligan'));

let lang = initialLang();
let best = loadBest();
/** @type {'loading' | 'title' | 'playing' | 'sunk' | 'done'} */
let phase = 'loading';
/** @type {{ name: string, tip: string, hit: string[], miss: string[], par: number }[]} */
let holes = [];
let hole = 0;
/** @type {{ strokes: number, skipped: boolean }[]} */
let card = [];
let newBest = false;
/** @type {any} */
let vm = null;

const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
const t = () => TEXT[lang];
const ruby = (code) => vm.eval(code).toString();
/** A Ruby string literal for a JavaScript string. */
const rubyString = (s) => `"${s.replace(/[\\"#]/g, (c) => '\\' + c)}"`;

function loadHoles() {
  holes = JSON.parse(ruby(`RegexGolf.holes_json(${rubyString(lang)})`));
}

function verdict(strokes, par) {
  return t()[ruby(`RegexGolf.verdict(${strokes}, ${par})`)];
}

function applyLang() {
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll('[data-t]')) el.textContent = t()[/** @type {HTMLElement} */ (el).dataset.t ?? ''];
  if (vm) {
    loadHoles();
    showHole();
    check();
  }
  overlay();
}

function totals() {
  const strokes = card.reduce((a, c) => a + c.strokes, 0);
  const par = holes.slice(0, card.length).reduce((a, h) => a + h.par, 0);
  return { strokes, par };
}

function hud() {
  $('hole-n').textContent = `${Math.min(hole + 1, holes.length)}/${holes.length}`;
  $('par').textContent = String(holes[hole]?.par ?? '');
  $('total').textContent = String(totals().strokes);
  $('best').textContent = best ? String(best) : '–';
  stage.dataset.phase = phase;
  stage.dataset.hole = String(hole + 1);
  stage.dataset.total = String(totals().strokes);
}

function word(w) {
  const li = document.createElement('li');
  const code = document.createElement('code');
  code.textContent = w;
  li.append(code);
  return li;
}

function showHole() {
  const h = holes[hole];
  if (!h) return;
  $('hole-name').textContent = `${hole + 1}. ${h.name}`;
  $('tip').textContent = h.tip;
  $('hit').replaceChildren(...h.hit.map(word));
  $('miss').replaceChildren(...h.miss.map(word));
  next.textContent = hole + 1 < holes.length ? t().next : t().finish;
  hud();
}

/** Checks what's typed against the hole, with Ruby, and marks every word. */
function check() {
  if (!vm || phase === 'title' || phase === 'done') return;
  const src = input.value;
  $('length').textContent = String(src.length);
  const r = JSON.parse(ruby(`RegexGolf.check_json(${hole}, ${rubyString(src)})`));
  const mark = (list, results, good) => {
    [...$(list).children].forEach((li, i) => {
      const matched = results[i] === true;
      li.classList.toggle('on', matched);
      li.classList.toggle('good', matched === good);
      li.classList.toggle('bad', src !== '' && !r.error && matched !== good);
    });
  };
  mark('hit', r.hits, true);
  mark('miss', r.misses, false);
  const status = $('status');
  status.className = 'status';
  if (r.error) {
    status.textContent = r.error;
    status.classList.add('err');
  } else if (r.solved) {
    const h = holes[hole];
    status.textContent = fill(t().sunk, { len: r.length, par: h.par, verdict: verdict(r.length, h.par) });
    status.classList.add('ok');
  } else if (src) {
    const missing = r.hits.filter((x) => !x).length;
    const wrong = r.misses.filter(Boolean).length;
    status.textContent = [missing && fill(t().missing, { n: missing }), wrong && fill(t().wrong, { n: wrong })].filter(Boolean).join(' · ');
  } else status.textContent = '';
  next.disabled = !r.solved;
  phase = r.solved ? 'sunk' : 'playing';
  hud();
}

function finishHole(skipped) {
  const h = holes[hole];
  card.push({ strokes: skipped ? h.par + 10 : input.value.length, skipped });
  hole++;
  input.value = '';
  if (hole >= holes.length) return finishRound();
  phase = 'playing';
  showHole();
  check();
  input.focus();
}

function finishRound() {
  phase = 'done';
  const { strokes } = totals();
  newBest = best === 0 || strokes < best;
  if (newBest) {
    best = strokes;
    saveBest(best);
  }
  input.disabled = true;
  mulligan.disabled = true;
  next.disabled = true;
  hole = holes.length - 1;
  hud();
  overlay();
}

function start() {
  card = [];
  hole = 0;
  newBest = false;
  phase = 'playing';
  input.disabled = false;
  mulligan.disabled = false;
  input.value = '';
  showHole();
  check();
  overlay();
  input.focus();
}

function overlay() {
  const o = $('overlay');
  const body = $('o-body');
  body.replaceChildren();
  const p = (text, cls = '') => {
    const el = document.createElement('p');
    el.textContent = text;
    if (cls) el.className = cls;
    body.append(el);
  };
  o.hidden = phase === 'playing' || phase === 'sunk';
  if (phase === 'loading') {
    $('o-title').textContent = 'Regex Golf Range';
    p(t().loading);
    $('o-hint').textContent = '';
  } else if (phase === 'title') {
    $('o-title').textContent = 'Regex Golf Range';
    p(t().tagline);
    p(t().how, 'muted');
    $('o-hint').textContent = t().start;
  } else if (phase === 'done') {
    $('o-title').textContent = t().done;
    const table = document.createElement('ol');
    table.className = 'card';
    card.forEach((c, i) => {
      const li = document.createElement('li');
      const h = holes[i];
      li.textContent = `${h.name} · ${c.strokes} (par ${h.par}) · ${c.skipped ? t().skipped : verdict(c.strokes, h.par)}`;
      table.append(li);
    });
    body.append(table);
    const { strokes, par } = totals();
    const d = strokes - par;
    p(fill(t().total, { strokes, par, diff: d === 0 ? 'E' : d > 0 ? `+${d}` : String(d) }), 'strong');
    if (newBest) p(t().newBest, 'accent');
    $('o-hint').textContent = t().again;
  }
}

// ---------- input ----------

input.addEventListener('input', check);
$('shot').addEventListener('submit', (e) => {
  e.preventDefault();
  if (phase === 'sunk') finishHole(false);
});
mulligan.addEventListener('click', () => {
  if (phase === 'playing' || phase === 'sunk') finishHole(true);
});
$('overlay').addEventListener('click', () => {
  if (phase === 'title' || phase === 'done') start();
});
window.addEventListener('keydown', (e) => {
  if ((phase === 'title' || phase === 'done') && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    start();
  }
});

followHub((l) => {
  lang = l;
  applyLang();
});
applyLang();
hud();

try {
  const module = await WebAssembly.compileStreaming(fetch(rubyUrl));
  // no console printer: without the standard library, Ruby would warn that RubyGems and friends aren't loaded
  ({ vm } = await DefaultRubyVM(module, { consolePrint: false }));
  vm.eval(source);
  loadHoles();
  phase = 'title';
  stage.dataset.ruby = ruby('RUBY_VERSION');
  showHole();
  overlay();
} catch (err) {
  $('o-body').textContent = fill(t().failed, { error: String(err) });
}
