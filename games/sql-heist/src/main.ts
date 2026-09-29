/**
 * SQL Heist: the page. SQLite (sql.js) runs in the browser; heist.ts has the bank and the checks.
 */
import '@fontsource-variable/jetbrains-mono';
import './style.css';
import initSqlJs, { type Database, type QueryExecResult } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { Heist, LEVELS, type Lang } from './heist';
import { followHub, initialLang, loadBest, saveBest } from './host.js';

const TEXT = {
  en: {
    level: 'step',
    queries: 'queries',
    best: 'best',
    showHint: 'hint',
    schema: 'tables (click to insert)',
    yourSql: 'your SQL',
    run: 'run ▶',
    keys: 'Ctrl+Enter',
    next: 'next step →',
    finish: 'get away →',
    loading: 'Starting SQLite (sql.js)…',
    tagline: 'You are inside the bank’s database. Seven steps to the biggest heist in SQL history.',
    how: 'Each step asks for a query. Any SQL that gets the right result counts. Every query you run is counted, so think before you type.',
    start: 'Press Enter or tap to break in',
    solved: 'Done. That’s exactly what we needed.',
    notYet: 'That ran, but it isn’t what the step asks for yet.',
    rows: '{n} row(s)',
    noRows: 'No rows. (Statements that change data return none: that’s fine.)',
    bobby: 'DROP TABLE? Security has seen Little Bobby Tables before. That query was blocked, and they’re watching now.',
    doneTitle: 'Heist complete',
    doneSub: '4 800 000 moved, alarm off, logs gone. {queries} queries.',
    newBest: 'New best: fewest queries!',
    again: 'Press Enter or tap to rob it again'
  },
  nl: {
    level: 'stap',
    queries: 'queries',
    best: 'record',
    showHint: 'hint',
    schema: 'tabellen (klik om in te voegen)',
    yourSql: 'je SQL',
    run: 'uitvoeren ▶',
    keys: 'Ctrl+Enter',
    next: 'volgende stap →',
    finish: 'wegwezen →',
    loading: 'SQLite opstarten (sql.js)…',
    tagline: 'Je zit in de database van de bank. Zeven stappen naar de grootste kraak uit de SQL-geschiedenis.',
    how: 'Elke stap vraagt om een query. Elke SQL die het goede resultaat geeft telt. Elke query die je uitvoert wordt geteld, dus denk na voor je typt.',
    start: 'Druk op Enter of tik om in te breken',
    solved: 'Gelukt. Precies wat we nodig hadden.',
    notYet: 'Dat liep, maar het is nog niet wat deze stap vraagt.',
    rows: '{n} rij(en)',
    noRows: 'Geen rijen. (Statements die data wijzigen geven niets terug: dat is prima.)',
    bobby: 'DROP TABLE? De beveiliging kent Little Bobby Tables al. Die query is tegengehouden, en ze letten nu op.',
    doneTitle: 'Kraak geslaagd',
    doneSub: '4 800 000 verplaatst, alarm uit, logs weg. {queries} queries.',
    newBest: 'Nieuw record: minste queries!',
    again: 'Druk op Enter of tik om hem nog eens te beroven'
  }
};

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const stage = $('stage');
const sql = $<HTMLTextAreaElement>('sql');
const runBtn = $<HTMLButtonElement>('run');
const nextBtn = $<HTMLButtonElement>('next');

let lang: Lang = initialLang();
let best = loadBest();
let phase: 'loading' | 'title' | 'playing' | 'solved' | 'done' = 'loading';
let level = 0;
let queries = 0;
let newBest = false;
let heist: Heist;
let db: Database;

const t = () => TEXT[lang];
const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));

function applyLang() {
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll<HTMLElement>('[data-t]')) el.textContent = t()[el.dataset.t as keyof (typeof TEXT)['en']];
  showLevel();
  overlay();
}

function hud() {
  $('level-n').textContent = `${Math.min(level + 1, LEVELS.length)}/${LEVELS.length}`;
  $('queries').textContent = String(queries);
  $('best').textContent = best ? String(best) : '–';
  stage.dataset.phase = phase;
  stage.dataset.level = String(level + 1);
  stage.dataset.queries = String(queries);
}

function showLevel() {
  const l = LEVELS[level];
  $('level-title').textContent = `${level + 1}. ${l.title[lang]}`;
  $('task').textContent = l.task[lang];
  $('hint').textContent = '';
  nextBtn.textContent = level + 1 < LEVELS.length ? t().next : t().finish;
  hud();
}

/** The tables and their columns, from SQLite itself. Clicking one types it into the editor. */
function showSchema() {
  const list = $('schema');
  list.replaceChildren();
  const tables = db.exec("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")[0]?.values ?? [];
  for (const [name] of tables) {
    const li = document.createElement('li');
    li.append(insertButton(String(name), 'table'));
    const cols = db.exec(`PRAGMA table_info(${name})`)[0]?.values ?? [];
    const span = document.createElement('span');
    span.className = 'cols';
    for (const c of cols) span.append(insertButton(String(c[1]), 'col'));
    li.append(span);
    list.append(li);
  }
}

function insertButton(text: string, cls: string) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = cls;
  b.textContent = text;
  b.addEventListener('click', () => {
    if (sql.disabled) return;
    const at = sql.selectionStart;
    sql.setRangeText((at > 0 && !/\s|\(|,/.test(sql.value[at - 1]) ? ' ' : '') + text, at, sql.selectionEnd, 'end');
    sql.focus();
  });
  return b;
}

function table(r: QueryExecResult | null) {
  const box = $('result');
  box.replaceChildren();
  if (!r || !r.values.length) {
    const p = document.createElement('p');
    p.className = 'muted';
    p.textContent = t().noRows;
    box.append(p);
    return;
  }
  const tbl = document.createElement('table');
  const head = tbl.createTHead().insertRow();
  for (const c of r.columns) {
    const th = document.createElement('th');
    th.textContent = c;
    head.append(th);
  }
  const body = tbl.createTBody();
  for (const row of r.values.slice(0, 50)) {
    const tr = body.insertRow();
    for (const v of row) tr.insertCell().textContent = v === null ? 'NULL' : String(v);
  }
  const cap = tbl.createCaption();
  cap.textContent = fill(t().rows, { n: r.values.length });
  box.append(tbl);
}

function run() {
  if (phase !== 'playing' || !sql.value.trim()) return;
  queries++;
  const out = heist.run(db, level, sql.value);
  const status = $('status');
  status.className = 'status';
  if (out.kind === 'error') {
    status.textContent = out.message;
    status.classList.add('err');
    $('result').replaceChildren();
  } else if (out.kind === 'bobby') {
    status.textContent = t().bobby;
    status.classList.add('err');
    stage.classList.add('alarm');
    setTimeout(() => stage.classList.remove('alarm'), 1500);
  } else {
    table(out.result);
    if (out.solved) {
      phase = 'solved';
      status.textContent = t().solved;
      status.classList.add('ok');
      nextBtn.hidden = false;
      runBtn.disabled = true;
      nextBtn.focus();
    } else status.textContent = t().notYet;
  }
  showSchema();
  hud();
}

function next() {
  if (phase !== 'solved') return;
  level++;
  if (level >= LEVELS.length) return finish();
  phase = 'playing';
  sql.value = '';
  nextBtn.hidden = true;
  runBtn.disabled = false;
  $('status').textContent = '';
  $('result').replaceChildren();
  showLevel();
  sql.focus();
}

function finish() {
  phase = 'done';
  level = LEVELS.length - 1;
  newBest = best === 0 || queries < best;
  if (newBest) {
    best = queries;
    saveBest(best);
  }
  sql.disabled = true;
  runBtn.disabled = true;
  nextBtn.hidden = true;
  hud();
  overlay();
}

function start() {
  db?.close();
  db = heist.bank();
  level = 0;
  queries = 0;
  newBest = false;
  phase = 'playing';
  sql.disabled = false;
  runBtn.disabled = false;
  nextBtn.hidden = true;
  sql.value = '';
  $('status').textContent = '';
  $('result').replaceChildren();
  showLevel();
  showSchema();
  overlay();
  sql.focus();
}

function overlay() {
  const o = $('overlay');
  const body = $('o-body');
  body.replaceChildren();
  const p = (text: string, cls = '') => {
    const el = document.createElement('p');
    el.textContent = text;
    if (cls) el.className = cls;
    body.append(el);
  };
  o.hidden = phase === 'playing' || phase === 'solved';
  $('o-title').textContent = phase === 'done' ? t().doneTitle : 'SQL Heist';
  if (phase === 'loading') {
    p(t().loading);
    $('o-hint').textContent = '';
  } else if (phase === 'title') {
    p(t().tagline);
    p(t().how, 'muted');
    $('o-hint').textContent = t().start;
  } else if (phase === 'done') {
    p(fill(t().doneSub, { queries }));
    if (newBest) p(t().newBest, 'accent');
    $('o-hint').textContent = t().again;
  }
}

// ---------- input ----------

runBtn.addEventListener('click', run);
nextBtn.addEventListener('click', next);
$('hint-btn').addEventListener('click', () => {
  if (phase === 'playing') $('hint').textContent = LEVELS[level].hint[lang];
});
sql.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    run();
  }
});
$('overlay').addEventListener('click', () => {
  if (phase === 'title' || phase === 'done') start();
});
window.addEventListener('keydown', (e) => {
  if ((phase === 'title' || phase === 'done') && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    start();
  } else if (phase === 'solved' && e.key === 'Enter' && document.activeElement !== nextBtn) {
    e.preventDefault();
    next();
  }
});

followHub((l: Lang) => {
  lang = l;
  applyLang();
});
applyLang();

const SQL = await initSqlJs({ locateFile: () => wasmUrl });
heist = new Heist(SQL);
db = heist.bank();
showSchema();
phase = 'title';
stage.dataset.sqlite = String(db.exec('SELECT sqlite_version()')[0].values[0][0]);
hud();
overlay();
