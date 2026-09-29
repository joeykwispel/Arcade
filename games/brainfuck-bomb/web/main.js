/**
 * Brainf*ck Bomb Defuser: the page. Every bomb is a Brainf*ck program; bf.wasm (hand-written in src/bf.wat) runs it
 * to know the code, and you have to work it out in your head before the timer hits zero.
 */
import '@fontsource-variable/jetbrains-mono';
import './style.css';
import wasmUrl from '../src/bf.wasm?url';
import { BOMBS, WRONG, interpreter } from '../src/bombs.js';
import { followHub, initialLang, loadBest, saveBest } from './host.js';

const TEXT = {
  en: {
    bomb: 'bomb',
    score: 'score',
    best: 'best',
    prints: 'This program prints the code. What does it print?',
    code: 'code',
    cut: 'cut the wire ✂',
    cheat: 'cheat sheet',
    tagline: 'Six bombs. Each shows a tiny Brainf*ck program; the code that defuses it is whatever the program prints.',
    how: 'Work it out in your head, type the code, and cut the wire. A wrong code costs 10 seconds. The seconds you have left add up to your score.',
    start: 'Press Enter or tap to face the first bomb',
    wrong: 'Wrong code. −10 seconds.',
    defused: 'Defused! +{n}',
    boomTitle: 'BOOM',
    boomSub: 'The code was {code}. You defused {n} of 6 bombs.',
    doneTitle: 'All bombs defused',
    doneSub: 'Score {score}: the seconds you had left.',
    newBest: 'New best score!',
    again: 'Press Enter or tap to try again',
    ops: [
      ['+', 'add 1 to the current cell'],
      ['-', 'subtract 1 from the current cell'],
      ['>', 'move to the next cell'],
      ['<', 'move to the previous cell'],
      ['[ … ]', 'repeat what is inside while the current cell is not 0'],
      ['.', 'print the current cell as a character']
    ],
    ascii: 'Characters: 48 = "0", 49 = "1", … 57 = "9"; 65 = "A", 66 = "B", … 90 = "Z".'
  },
  nl: {
    bomb: 'bom',
    score: 'score',
    best: 'record',
    prints: 'Dit programma print de code. Wat print het?',
    code: 'code',
    cut: 'knip de draad ✂',
    cheat: 'spiekbrief',
    tagline: 'Zes bommen. Elke bom toont een piepklein Brainf*ck-programma; de code die hem onschadelijk maakt is wat het programma print.',
    how: 'Reken het uit in je hoofd, typ de code en knip de draad. Een verkeerde code kost 10 seconden. De seconden die je overhoudt vormen je score.',
    start: 'Druk op Enter of tik voor de eerste bom',
    wrong: 'Verkeerde code. −10 seconden.',
    defused: 'Onschadelijk gemaakt! +{n}',
    boomTitle: 'BOEM',
    boomSub: 'De code was {code}. Je maakte {n} van de 6 bommen onschadelijk.',
    doneTitle: 'Alle bommen onschadelijk',
    doneSub: 'Score {score}: de seconden die je overhield.',
    newBest: 'Nieuw record!',
    again: 'Druk op Enter of tik om het opnieuw te proberen',
    ops: [
      ['+', 'tel 1 op bij de huidige cel'],
      ['-', 'trek 1 af van de huidige cel'],
      ['>', 'ga naar de volgende cel'],
      ['<', 'ga naar de vorige cel'],
      ['[ … ]', 'herhaal wat erin staat zolang de huidige cel niet 0 is'],
      ['.', 'print de huidige cel als teken']
    ],
    ascii: 'Tekens: 48 = "0", 49 = "1", … 57 = "9"; 65 = "A", 66 = "B", … 90 = "Z".'
  }
};

const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));
const stage = $('stage');
const input = /** @type {HTMLInputElement} */ ($('code'));
const cut = /** @type {HTMLButtonElement} */ ($('cut'));

const { instance } = await WebAssembly.instantiateStreaming(fetch(wasmUrl), {});
const run = interpreter(instance);

let lang = initialLang();
let best = loadBest();
let mode = 'title'; // title, ticking, boom, done
let bomb = 0;
let left = 0;
let score = 0;
let newBest = false;

const t = () => TEXT[lang];
const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));

function applyLang() {
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll('[data-t]')) el.textContent = t()[/** @type {HTMLElement} */ (el).dataset.t ?? ''];
  const list = $('cheat-list');
  list.replaceChildren();
  for (const [op, what] of t().ops)
    list.append(Object.assign(document.createElement('dt'), { textContent: op }), Object.assign(document.createElement('dd'), { textContent: what }));
  $('ascii').textContent = t().ascii;
  overlay();
}

function hud() {
  $('bomb-n').textContent = `${Math.min(bomb + 1, BOMBS.length)}/${BOMBS.length}`;
  $('score').textContent = String(score);
  $('best').textContent = String(best);
  const s = Math.max(0, Math.ceil(left));
  $('timer').textContent = `00:${String(s).padStart(2, '0')}`;
  $('timer').classList.toggle('low', s <= 10);
  stage.dataset.phase = mode;
  stage.dataset.bomb = String(bomb + 1);
  stage.dataset.score = String(score);
}

function arm(i) {
  bomb = i;
  left = BOMBS[i].seconds;
  $('program').textContent = BOMBS[i].program;
  $('status').textContent = '';
  input.value = '';
  input.disabled = false;
  cut.disabled = false;
  hud();
  input.focus();
}

function start() {
  score = 0;
  newBest = false;
  mode = 'ticking';
  overlay();
  arm(0);
}

function end(m) {
  mode = m;
  input.disabled = true;
  cut.disabled = true;
  if (m === 'done' && score > best) {
    best = score;
    newBest = true;
    saveBest(best);
  }
  hud();
  overlay();
}

function attempt() {
  if (mode !== 'ticking') return;
  const code = run(BOMBS[bomb].program);
  const status = $('status');
  if (input.value.trim().toUpperCase() === code.toUpperCase()) {
    const gained = Math.ceil(left);
    score += gained;
    status.textContent = fill(t().defused, { n: gained });
    status.className = 'status ok';
    if (bomb + 1 >= BOMBS.length) return end('done');
    arm(bomb + 1);
    status.textContent = fill(t().defused, { n: gained });
    status.className = 'status ok';
  } else {
    left -= WRONG;
    status.textContent = t().wrong;
    status.className = 'status err';
    stage.classList.remove('shake');
    void stage.offsetWidth;
    stage.classList.add('shake');
    input.select();
  }
  hud();
}

function overlay() {
  $('overlay').hidden = mode === 'ticking';
  const set = (title, sub, how, hint) => {
    $('o-title').textContent = title;
    $('o-sub').textContent = sub;
    $('o-how').textContent = how;
    $('o-hint').textContent = hint;
  };
  if (mode === 'title') set('Brainf*ck Bomb Defuser', t().tagline, t().how, t().start);
  else if (mode === 'boom') set(t().boomTitle, fill(t().boomSub, { code: run(BOMBS[bomb].program), n: bomb }), '', t().again);
  else if (mode === 'done') set(t().doneTitle, fill(t().doneSub, { score }), newBest ? t().newBest : '', t().again);
}

let prev = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - prev) / 1000);
  prev = now;
  if (mode === 'ticking') {
    const before = Math.ceil(left);
    left -= dt;
    if (left <= 0) end('boom');
    else if (Math.ceil(left) !== before) hud();
  }
  requestAnimationFrame(frame);
}

$('defuse').addEventListener('submit', (e) => {
  e.preventDefault();
  attempt();
});
$('overlay').addEventListener('click', () => {
  if (mode !== 'ticking') start();
});
window.addEventListener('keydown', (e) => {
  if (mode !== 'ticking' && (e.key === 'Enter' || e.key === ' ')) {
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
requestAnimationFrame(frame);
