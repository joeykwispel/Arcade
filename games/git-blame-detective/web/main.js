/**
 * Git Blame Detective: the terminal around the OCaml rules. lib/detective.ml is compiled to JavaScript by
 * js_of_ocaml (bin/main.ml exports it as globalThis.detective); this sends it each command and prints the answer.
 */
import '@fontsource-variable/jetbrains-mono';
import './style.css';
import * as compiled from '../_build/default/bin/main.bc.js';
import { followHub, initialLang, loadBest, saveBest } from './host.js';

const TEXT = {
  en: {
    case: 'case',
    commands: 'commands',
    score: 'score',
    best: 'best',
    tagline: 'Production is broken. Somebody did it. The commit history knows who.',
    how: 'Investigate with git log, git blame and git show (tap a hash or a file name), then accuse the commit that did it. Every command costs a little; a wrong accusation costs a lot.',
    start: 'Press Enter or tap to open the first case',
    doneTitle: 'All cases closed',
    doneSub: 'Score {score}. And now you know who wrote that log line.',
    newBest: 'New best score!',
    again: 'Press Enter or tap to investigate again',
    placeholder: 'e.g. git log'
  },
  nl: {
    case: 'zaak',
    commands: 'opdrachten',
    score: 'score',
    best: 'record',
    tagline: 'Productie is kapot. Iemand heeft het gedaan. De commitgeschiedenis weet wie.',
    how: 'Onderzoek met git log, git blame en git show (tik op een hash of een bestandsnaam), en beschuldig dan de commit die het deed. Elke opdracht kost een beetje; een verkeerde beschuldiging kost veel.',
    start: 'Druk op Enter of tik om de eerste zaak te openen',
    doneTitle: 'Alle zaken gesloten',
    doneSub: 'Score {score}. En nu weet je wie die logregel schreef.',
    newBest: 'Nieuw record!',
    again: 'Druk op Enter of tik om opnieuw te onderzoeken',
    placeholder: 'bv. git log'
  }
};

// what tapping something does
const ACTIONS = { hash: (h) => `git show ${h}`, file: (f) => `git blame ${f}` };

// js_of_ocaml's Js.export puts it on module.exports when there is one (Vite bundles the file as CommonJS),
// and on the global object otherwise
const detective = /** @type {any} */ (compiled).default?.detective ?? /** @type {any} */ (compiled).detective ?? /** @type {any} */ (globalThis).detective;
const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));
const stage = $('stage');
const out = $('out');
const input = /** @type {HTMLInputElement} */ ($('cmd'));

let lang = initialLang();
let best = loadBest();
let mode = 'title';
let newBest = false;
let lastState = { case: 1, cases: 3, commands: 0, score: 0, phase: 'investigating' };
const history = [];
let back = 0;

const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
const t = () => TEXT[lang];

function applyLang() {
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll('[data-t]')) el.textContent = t()[/** @type {HTMLElement} */ (el).dataset.t ?? ''];
  input.placeholder = t().placeholder;
  detective.setLang(lang);
  overlay();
}

function print(lines) {
  for (const line of lines) {
    const p = document.createElement('p');
    for (const [text, kind] of line) {
      const action = ACTIONS[kind];
      const el = document.createElement(action ? 'button' : 'span');
      el.textContent = text;
      if (kind) el.className = kind;
      if (action) {
        /** @type {HTMLButtonElement} */ (el).type = 'button';
        el.addEventListener('click', () => submit(action(text)));
      }
      p.append(el);
    }
    out.append(p);
  }
  while (out.childElementCount > 300) out.firstElementChild?.remove();
  out.scrollTop = out.scrollHeight;
}

function show(state) {
  lastState = state;
  $('case').textContent = `${state.case}/${state.cases}`;
  $('commands').textContent = String(state.commands);
  $('score').textContent = String(state.score);
  $('best').textContent = String(best);
  stage.dataset.phase = mode === 'playing' ? state.phase : mode;
  stage.dataset.case = String(state.case);
  stage.dataset.score = String(state.score);
  if (state.phase === 'done' && mode === 'playing') {
    mode = 'done';
    newBest = state.score > best;
    if (newBest) {
      best = state.score;
      saveBest(best);
    }
    stage.dataset.phase = 'done';
    overlay();
  }
}

function respond(json) {
  const data = JSON.parse(json);
  print(data.lines);
  show(data.state);
}

function submit(line) {
  if (mode !== 'playing') return;
  line = line.trim();
  const p = document.createElement('p');
  p.className = 'echo';
  p.append(Object.assign(document.createElement('span'), { className: 'ps1', textContent: '~/incident $ ' }), line);
  out.append(p);
  if (line) history.push(line);
  back = 0;
  if (line === 'clear') return out.replaceChildren();
  respond(detective.run(line));
  input.focus({ preventScroll: true });
}

function start() {
  mode = 'playing';
  newBest = false;
  out.replaceChildren();
  respond(detective.start(lang));
  overlay();
  input.focus({ preventScroll: true });
}

function overlay() {
  const o = $('overlay');
  o.hidden = mode === 'playing';
  if (mode === 'title') {
    $('o-title').textContent = 'Git Blame Detective';
    $('o-sub').textContent = t().tagline;
    $('o-how').textContent = t().how;
    $('o-hint').textContent = t().start;
  } else if (mode === 'done') {
    $('o-title').textContent = t().doneTitle;
    $('o-sub').textContent = fill(t().doneSub, { score: lastState.score });
    $('o-how').textContent = newBest ? t().newBest : '';
    $('o-hint').textContent = t().again;
  }
}

// ---------- input ----------

const COMMANDS = ['ls', 'git log', 'git blame ', 'git show ', 'cat ', 'accuse ', 'help', 'next'];
$('prompt').addEventListener('submit', (e) => {
  e.preventDefault();
  const line = input.value;
  input.value = '';
  submit(line);
});
input.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const matches = COMMANDS.filter((c) => c.startsWith(input.value));
    if (matches.length === 1) input.value = matches[0];
  } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    if (!history.length) return;
    e.preventDefault();
    back = Math.max(0, Math.min(history.length, back + (e.key === 'ArrowUp' ? 1 : -1)));
    input.value = back ? history[history.length - back] : '';
  }
});
for (const b of document.querySelectorAll('[data-cmd]')) {
  b.addEventListener('click', () => submit(/** @type {HTMLElement} */ (b).dataset.cmd ?? ''));
}
$('overlay').addEventListener('click', () => {
  if (mode !== 'playing') start();
});
window.addEventListener('keydown', (e) => {
  if (mode !== 'playing' && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    start();
  }
});
out.addEventListener('click', (e) => {
  if (!(e.target instanceof HTMLButtonElement) && !getSelection()?.toString()) input.focus({ preventScroll: true });
});

followHub((l) => {
  lang = l;
  applyLang();
});
applyLang();
show(lastState);
