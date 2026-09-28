/**
 * rm -rf dungeon: the terminal around the Python game. Pyodide (CPython in WebAssembly, served from ./pyodide/)
 * runs py/dungeon.py; this file sends it each command line and prints what comes back.
 */
import '@fontsource-variable/jetbrains-mono';
import './style.css';
import { loadPyodide } from 'pyodide';
import source from '../py/dungeon.py?raw';
import { followHub, initialLang, loadBest, saveBest } from './host.js';

const UI = {
  en: {
    booting: 'Booting Python (Pyodide)…',
    ready: 'Python {version} is running in your browser.',
    failed: 'Python failed to start: {error}',
    placeholder: 'type a command, e.g. ls',
    hp: 'hp',
    floor: 'floor',
    score: 'score',
    best: 'best',
    input: 'command',
    newBest: 'New best score!'
  },
  nl: {
    booting: 'Python opstarten (Pyodide)…',
    ready: 'Python {version} draait in je browser.',
    failed: 'Python kon niet starten: {error}',
    placeholder: 'typ een opdracht, bv. ls',
    hp: 'hp',
    floor: 'verdieping',
    score: 'score',
    best: 'record',
    input: 'opdracht',
    newBest: 'Nieuw record!'
  }
};

const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));
const stage = $('stage');
const out = $('out');
const form = /** @type {HTMLFormElement} */ ($('prompt'));
const input = /** @type {HTMLInputElement} */ ($('cmd'));
const cwd = $('cwd');

let lang = initialLang();
let best = loadBest();
/** @type {{ command: (line: string) => string, complete: (line: string) => string, new_game: (seed: number, lang: string) => string, set_lang: (lang: string) => void } | null} */
let game = null;
const history = [];
let back = 0;

const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));

function applyLang() {
  const t = UI[lang];
  document.documentElement.lang = lang;
  input.placeholder = t.placeholder;
  input.setAttribute('aria-label', t.input);
  for (const el of document.querySelectorAll('[data-t]')) el.textContent = t[/** @type {HTMLElement} */ (el).dataset.t];
  $('best').textContent = String(best);
}

/** What tapping a name does. */
const ACTIONS = { dir: (n) => `cd ${n}`, monster: (n) => `rm ${n}`, boss: (n) => `sudo rm ${n}`, item: (n) => `cat ${n}` };

/** Prints lines of [text, kind] pieces. Names of rooms, processes and loot become buttons. */
function print(lines) {
  for (const line of lines) {
    const p = document.createElement('p');
    for (const [text, kind] of line) {
      const action = ACTIONS[kind];
      const name = text.replace(/\/$/, '');
      // the boss line after a kill is shouted, not tappable
      const el = action && !text.includes(' ') ? document.createElement('button') : document.createElement('span');
      el.textContent = text;
      if (kind) el.className = kind;
      if (el instanceof HTMLButtonElement) {
        el.type = 'button';
        el.addEventListener('click', () => submit(action(name)));
      }
      p.append(el);
    }
    out.append(p);
  }
  // keep the scrollback short
  while (out.childElementCount > 400) out.firstElementChild?.remove();
  out.scrollTop = out.scrollHeight;
}

function echo(line) {
  const p = document.createElement('p');
  p.className = 'echo';
  const prompt = document.createElement('span');
  prompt.className = 'ps1';
  prompt.textContent = `${cwd.textContent} $ `;
  p.append(prompt, line);
  out.append(p);
}

/** @param {{ hp: number, max: number, sudo: number, floor: number, floors: number, cwd: string, score: number, over: boolean, won: boolean }} s */
function show(s) {
  cwd.textContent = s.cwd;
  $('hp').textContent = `${s.hp}/${s.max}`;
  const bar = /** @type {HTMLProgressElement} */ ($('hpbar'));
  bar.max = s.max;
  bar.value = s.hp;
  $('sudo').textContent = String(s.sudo);
  $('floor').textContent = `${s.floor}/${s.floors}`;
  $('score').textContent = String(s.score);
  stage.dataset.floor = String(s.floor);
  stage.dataset.hp = String(s.hp);
  stage.dataset.phase = s.won ? 'won' : s.over ? 'dead' : 'playing';
  stage.classList.toggle('low', s.hp > 0 && s.hp <= s.max / 4);
  if (s.over && s.score > best) {
    best = s.score;
    saveBest(best);
    $('best').textContent = String(best);
    print([[[UI[lang].newBest, 'ok']]]);
  }
}

function run(json) {
  const data = JSON.parse(json);
  print(data.lines);
  show(data.state);
}

function submit(line) {
  if (!game) return;
  line = line.trim();
  echo(line);
  if (line) {
    history.push(line);
    if (history.length > 100) history.shift();
  }
  back = 0;
  if (line === 'clear') {
    out.replaceChildren();
    return;
  }
  run(game.command(line));
  input.focus({ preventScroll: true });
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const line = input.value;
  input.value = '';
  submit(line);
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    if (game) input.value = game.complete(input.value);
  } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    if (!history.length) return;
    e.preventDefault();
    back = Math.max(0, Math.min(history.length, back + (e.key === 'ArrowUp' ? 1 : -1)));
    input.value = back ? history[history.length - back] : '';
  }
});

// quick buttons for phones
for (const b of document.querySelectorAll('[data-cmd]')) {
  b.addEventListener('click', () => submit(/** @type {HTMLElement} */ (b).dataset.cmd ?? ''));
}
// clicking anywhere in the terminal (but not on a name, or while selecting text) goes back to the prompt
out.addEventListener('click', (e) => {
  if (!(e.target instanceof HTMLButtonElement) && !getSelection()?.toString()) input.focus({ preventScroll: true });
});

applyLang();
followHub((l) => {
  lang = l;
  applyLang();
  game?.set_lang(l);
});

print([[[UI[lang].booting, 'dim']]]);
try {
  const py = await loadPyodide({ indexURL: new URL('./pyodide/', location.href).href });
  py.FS.writeFile('dungeon.py', source);
  const mod = py.pyimport('dungeon');
  game = {
    command: (line) => mod.command(line),
    complete: (line) => mod.complete(line),
    new_game: (seed, l) => mod.new_game(seed, l),
    set_lang: (l) => mod.set_lang(l)
  };
  const version = py.runPython('import sys; sys.version.split()[0]');
  print([[[fill(UI[lang].ready, { version }), 'dim']]]);
  run(game.new_game(Date.now() % 2 ** 31, lang));
  input.disabled = false;
  stage.dataset.ready = 'true';
  input.focus({ preventScroll: true });
} catch (err) {
  print([[[fill(UI[lang].failed, { error: String(err) }), 'err']]]);
}
