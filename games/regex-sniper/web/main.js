/**
 * Regex Sniper: the page around the Ruby rules. ruby.wasm (Ruby 3.4 as WebAssembly) runs ruby/sniper.rb, so every
 * regex you type is a real Ruby regex, checked on every keystroke.
 */
import '@fontsource-variable/jetbrains-mono';
import './style.css';
import { DefaultRubyVM } from '@ruby/wasm-wasi/dist/browser';
import rubyUrl from '@ruby/3.4-wasm-wasi/dist/ruby.wasm?url';
import source from '../ruby/sniper.rb?raw';
import { followHub, initialLang, loadBest, saveBest } from './host.js';

const TEXT = {
  en: {
    level: 'level',
    target: 'target',
    chars: 'chars',
    total: 'total',
    best: 'best',
    cheatsheet: 'cheatsheet',
    goal: 'Write one regex that matches every green word and none of the red ones. Shorter is better.',
    hitThese: 'must match',
    missThese: 'must not match',
    yourRegex: 'your regex',
    cheatTitle: 'Common regex symbols (click to insert)',
    skip: 'skip (+10)',
    next: 'next level →',
    finish: 'see results →',
    loading: 'Booting Ruby (ruby.wasm)…',
    failed: 'Ruby failed to start: {error}',
    tagline: 'Nine levels. In each one, write a single regex that matches every green word and none of the red ones.',
    how: 'Every word lights up while you type. Your score is the number of characters in your regex: the fewer, the better. Stuck? Open the cheatsheet, or skip the level for a 10-character penalty.',
    start: 'Press Enter or tap to start',
    solved: 'Solved! {len} characters, target {target}: {verdict}',
    missing: '{n} green word(s) not matched yet',
    wrong: '{n} red word(s) matched by mistake',
    done: 'Results',
    totalLine: 'total {chars} characters (target {target}, {diff})',
    newBest: 'New best total!',
    again: 'Press Enter or tap to play again',
    sharper: 'sharper than the answer key!',
    target_: 'right on target',
    close: 'close',
    loose: 'it works',
    skipped: 'skipped'
  },
  nl: {
    level: 'level',
    target: 'doel',
    chars: 'tekens',
    total: 'totaal',
    best: 'record',
    cheatsheet: 'spiekbrief',
    goal: 'Schrijf één regex die elk groen woord matcht en geen enkel rood. Hoe korter, hoe beter.',
    hitThese: 'moet matchen',
    missThese: 'mag niet matchen',
    yourRegex: 'je regex',
    cheatTitle: 'Veelgebruikte regex-tekens (klik om in te voegen)',
    skip: 'overslaan (+10)',
    next: 'volgend level →',
    finish: 'naar de uitslag →',
    loading: 'Ruby opstarten (ruby.wasm)…',
    failed: 'Ruby kon niet starten: {error}',
    tagline: 'Negen levels. Schrijf in elk level één regex die elk groen woord matcht en geen enkel rood.',
    how: 'Elk woord licht op terwijl je typt. Je score is het aantal tekens van je regex: hoe minder, hoe beter. Vast? Open de spiekbrief, of sla het level over voor 10 strafpunten.',
    start: 'Druk op Enter of tik om te beginnen',
    solved: 'Opgelost! {len} tekens, doel {target}: {verdict}',
    missing: 'nog {n} groen woord(en) niet gematcht',
    wrong: '{n} rood woord(en) per ongeluk gematcht',
    done: 'Uitslag',
    totalLine: 'totaal {chars} tekens (doel {target}, {diff})',
    newBest: 'Nieuw record!',
    again: 'Druk op Enter of tik om opnieuw te spelen',
    sharper: 'scherper dan het antwoord!',
    target_: 'precies op doel',
    close: 'bijna',
    loose: 'het werkt',
    skipped: 'overgeslagen'
  }
};

/** The cheatsheet: symbol, and what it does. The first ten are the classics; the rest are what the levels need. */
const CHEATS = [
  ['.', 'any single character except a newline', 'elk willekeurig teken behalve een regeleinde'],
  ['\\d', 'any digit (0–9)', 'elk cijfer (0–9)'],
  ['\\w', 'any word character (letters, digits and _)', 'elk woordteken (letters, cijfers en _)'],
  ['\\s', 'any whitespace (space, tab, line break)', 'elke witruimte (spatie, tab, regeleinde)'],
  ['*', 'the item before it, zero or more times', 'het vorige, nul of meer keer'],
  ['+', 'the item before it, one or more times', 'het vorige, één of meer keer'],
  ['?', 'the item before it, zero or one time (optional)', 'het vorige, nul of één keer (optioneel)'],
  ['^', 'the start of the string or line', 'het begin van de tekst of regel'],
  ['$', 'the end of the string or line', 'het einde van de tekst of regel'],
  ['[abc]', 'any one of the characters in the brackets', 'één van de tekens tussen de haken'],
  ['[^abc]', 'any character except those in the brackets', 'elk teken behalve die tussen de haken'],
  ['{2}', 'the item before it, exactly 2 times ({1,3}: 1 to 3)', 'het vorige, precies 2 keer ({1,3}: 1 tot 3)'],
  ['|', 'either the left side or the right side', 'óf de linkerkant, óf de rechterkant'],
  ['\\b', 'a word boundary (the edge of a word)', 'een woordgrens (de rand van een woord)'],
  ['\\h', 'a hex digit (0–9, a–f): Ruby only', 'een hexcijfer (0–9, a–f): alleen in Ruby'],
  ['(…)\\1', 'a group, and \\1 repeats what it matched', 'een groep, en \\1 herhaalt wat die matchte']
];

const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));
const stage = $('stage');
const input = /** @type {HTMLInputElement} */ ($('regex'));
const next = /** @type {HTMLButtonElement} */ ($('next'));
const skip = /** @type {HTMLButtonElement} */ ($('skip'));
const cheatToggle = /** @type {HTMLButtonElement} */ ($('cheat-toggle'));

let lang = initialLang();
let best = loadBest();
/** @type {'loading' | 'title' | 'playing' | 'solved' | 'done'} */
let phase = 'loading';
/** @type {{ name: string, tip: string, hit: string[], miss: string[], target: number }[]} */
let levels = [];
let level = 0;
/** @type {{ chars: number, skipped: boolean }[]} */
let results = [];
let newBest = false;
/** @type {any} */
let vm = null;

const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
const t = () => TEXT[lang];
const ruby = (code) => vm.eval(code).toString();
/** A Ruby string literal for a JavaScript string. */
const rubyString = (s) => `"${s.replace(/[\\"#]/g, (c) => '\\' + c)}"`;

function loadLevels() {
  levels = JSON.parse(ruby(`RegexSniper.levels_json(${rubyString(lang)})`));
}

function verdict(chars, target) {
  const v = ruby(`RegexSniper.verdict(${chars}, ${target})`);
  return t()[v === 'target' ? 'target_' : v];
}

function renderCheats() {
  const list = $('cheat-list');
  list.replaceChildren();
  for (const [symbol, en, nl] of CHEATS) {
    const dt = document.createElement('dt');
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = symbol;
    // (…)\1 inserts a template to fill in
    b.addEventListener('click', () => insert(symbol === '(…)\\1' ? '()\\1' : symbol));
    dt.append(b);
    const dd = document.createElement('dd');
    dd.textContent = lang === 'nl' ? nl : en;
    list.append(dt, dd);
  }
}

/** Types a symbol into the regex, at the cursor. */
function insert(text) {
  if (input.disabled) return;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? start;
  input.value = input.value.slice(0, start) + text + input.value.slice(end);
  input.focus();
  input.setSelectionRange(start + text.length, start + text.length);
  check();
}

function applyLang() {
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll('[data-t]')) el.textContent = t()[/** @type {HTMLElement} */ (el).dataset.t ?? ''];
  renderCheats();
  if (vm) {
    loadLevels();
    showLevel();
    check();
  }
  overlay();
}

function totals() {
  const chars = results.reduce((a, c) => a + c.chars, 0);
  const target = levels.slice(0, results.length).reduce((a, h) => a + h.target, 0);
  return { chars, target };
}

function hud() {
  $('level-n').textContent = `${Math.min(level + 1, levels.length)}/${levels.length}`;
  $('target').textContent = String(levels[level]?.target ?? '');
  $('total').textContent = String(totals().chars);
  $('best').textContent = best ? String(best) : '–';
  stage.dataset.phase = phase;
  stage.dataset.level = String(level + 1);
  stage.dataset.total = String(totals().chars);
}

function word(w) {
  const li = document.createElement('li');
  const code = document.createElement('code');
  code.textContent = w;
  li.append(code);
  return li;
}

function showLevel() {
  const h = levels[level];
  if (!h) return;
  $('level-name').textContent = `${level + 1}. ${h.name}`;
  $('tip').textContent = h.tip;
  $('hit').replaceChildren(...h.hit.map(word));
  $('miss').replaceChildren(...h.miss.map(word));
  next.textContent = level + 1 < levels.length ? t().next : t().finish;
  hud();
}

/** Checks what's typed against the level, with Ruby, and marks every word. */
function check() {
  if (!vm || phase === 'title' || phase === 'done') return;
  const src = input.value;
  $('length').textContent = String(src.length);
  const r = JSON.parse(ruby(`RegexSniper.check_json(${level}, ${rubyString(src)})`));
  const mark = (list, results, good) => {
    [...$(list).children].forEach((li, i) => {
      const matched = results[i] === true;
      li.classList.toggle('on', matched);
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
    const h = levels[level];
    status.textContent = fill(t().solved, { len: r.length, target: h.target, verdict: verdict(r.length, h.target) });
    status.classList.add('ok');
  } else if (src) {
    const missing = r.hits.filter((x) => !x).length;
    const wrong = r.misses.filter(Boolean).length;
    status.textContent = [missing && fill(t().missing, { n: missing }), wrong && fill(t().wrong, { n: wrong })].filter(Boolean).join(' · ');
  } else status.textContent = '';
  next.disabled = !r.solved;
  phase = r.solved ? 'solved' : 'playing';
  hud();
}

function finishLevel(skipped) {
  const h = levels[level];
  results.push({ chars: skipped ? h.target + 10 : input.value.length, skipped });
  level++;
  input.value = '';
  if (level >= levels.length) return finishRound();
  phase = 'playing';
  showLevel();
  check();
  input.focus();
}

function finishRound() {
  phase = 'done';
  const { chars } = totals();
  newBest = best === 0 || chars < best;
  if (newBest) {
    best = chars;
    saveBest(best);
  }
  input.disabled = true;
  skip.disabled = true;
  next.disabled = true;
  level = levels.length - 1;
  hud();
  overlay();
}

function start() {
  results = [];
  level = 0;
  newBest = false;
  phase = 'playing';
  input.disabled = false;
  skip.disabled = false;
  input.value = '';
  showLevel();
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
  o.hidden = phase === 'playing' || phase === 'solved';
  if (phase === 'loading') {
    $('o-title').textContent = 'Regex Sniper';
    p(t().loading);
    $('o-hint').textContent = '';
  } else if (phase === 'title') {
    $('o-title').textContent = 'Regex Sniper';
    p(t().tagline);
    p(t().how, 'muted');
    $('o-hint').textContent = t().start;
  } else if (phase === 'done') {
    $('o-title').textContent = t().done;
    const list = document.createElement('ol');
    list.className = 'results';
    results.forEach((c, i) => {
      const li = document.createElement('li');
      const h = levels[i];
      li.textContent = `${h.name} · ${c.chars} (${t().target} ${h.target}) · ${c.skipped ? t().skipped : verdict(c.chars, h.target)}`;
      list.append(li);
    });
    body.append(list);
    const { chars, target } = totals();
    const d = chars - target;
    p(fill(t().totalLine, { chars, target, diff: d === 0 ? '±0' : d > 0 ? `+${d}` : String(d) }), 'strong');
    if (newBest) p(t().newBest, 'accent');
    $('o-hint').textContent = t().again;
  }
}

// ---------- input ----------

input.addEventListener('input', check);
$('shot').addEventListener('submit', (e) => {
  e.preventDefault();
  if (phase === 'solved') finishLevel(false);
});
skip.addEventListener('click', () => {
  if (phase === 'playing' || phase === 'solved') finishLevel(true);
});
cheatToggle.addEventListener('click', () => {
  const open = stage.classList.toggle('cheat-open');
  cheatToggle.setAttribute('aria-expanded', String(open));
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
// wide enough for a sidebar: start with the cheatsheet open
if (window.innerWidth > 720) {
  stage.classList.add('cheat-open');
  cheatToggle.setAttribute('aria-expanded', 'true');
}
applyLang();
hud();

try {
  const module = await WebAssembly.compileStreaming(fetch(rubyUrl));
  // no console printer: without the standard library, Ruby would warn that RubyGems and friends aren't loaded
  ({ vm } = await DefaultRubyVM(module, { consolePrint: false }));
  vm.eval(source);
  loadLevels();
  phase = 'title';
  stage.dataset.ruby = ruby('RUBY_VERSION');
  showLevel();
  overlay();
} catch (err) {
  $('o-body').textContent = fill(t().failed, { error: String(err) });
}
