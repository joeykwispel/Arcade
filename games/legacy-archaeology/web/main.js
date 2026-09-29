/**
 * Legacy Code Archaeology: the page. Real PHP 8.4 (php-wasm) runs the legacy file after every dig; if what it prints
 * changes, production is broken, the dig is undone, and a server goes down.
 */
import '@fontsource-variable/jetbrains-mono';
import './style.css';
import { PHP, loadPHPRuntime } from '@php-wasm/universal';
import { getPHPLoaderModule } from '@php-wasm/web-8-4';
import { CLEAN_BONUS, LAYERS, LINE_POINTS, LIVES, Runner, minimum, source } from '../src/layers.js';
import { followHub, initialLang, loadBest, saveBest } from './host.js';

const TEXT = {
  en: {
    layer: 'layer',
    lines: 'lines dug',
    score: 'score',
    best: 'best',
    expected: 'what it must print',
    now: 'what it prints now',
    dig: 'dig ⛏',
    digN: 'dig {n} line(s) ⛏',
    ship: 'ship this layer →',
    loading: 'Booting PHP 8.4 (php-wasm)…',
    tagline: 'Three layers of legacy PHP. Dig out every line that does nothing, without changing a single character of what it prints.',
    how: 'Click lines to select them, then dig. Real PHP runs the file after every dig: if the output changes, production breaks, the dig is undone and a server goes down. Some lines only go together. Ship a layer when nothing more can go.',
    start: 'Press Enter or tap to start digging',
    select: 'Select lines to dig out.',
    safe: 'Still prints the same. {n} line(s) gone.',
    broke: 'Production broke: the output changed. Undone.',
    clean: 'Clean! Nothing left to dig: +{n}',
    notClean: 'Shipped. (It could have been {n} line(s) shorter.)',
    down: 'All servers are down',
    downSub: 'Revert, revert, revert. Score {score}.',
    doneTitle: 'Excavation complete',
    doneSub: 'Score {score}. The load-bearing comment was never touched. Probably.',
    newBest: 'New best score!',
    again: 'Press Enter or tap to dig again',
    servers: 'servers'
  },
  nl: {
    layer: 'laag',
    lines: 'regels weg',
    score: 'score',
    best: 'record',
    expected: 'wat hij moet printen',
    now: 'wat hij nu print',
    dig: 'graven ⛏',
    digN: '{n} regel(s) weggraven ⛏',
    ship: 'deze laag opleveren →',
    loading: 'PHP 8.4 opstarten (php-wasm)…',
    tagline: 'Drie lagen legacy PHP. Graaf elke regel weg die niets doet, zonder één teken te veranderen van wat hij print.',
    how: 'Klik regels aan en graaf ze weg. Na elke graafbeurt draait echte PHP het bestand: verandert de output, dan ligt productie plat, wordt het teruggedraaid en valt er een server uit. Sommige regels kunnen alleen samen weg. Lever een laag op als er niets meer weg kan.',
    start: 'Druk op Enter of tik om te gaan graven',
    select: 'Selecteer regels om weg te graven.',
    safe: 'Print nog precies hetzelfde. {n} regel(s) weg.',
    broke: 'Productie ligt plat: de output veranderde. Teruggedraaid.',
    clean: 'Schoon! Er valt niets meer weg te graven: +{n}',
    notClean: 'Opgeleverd. (Hij had {n} regel(s) korter gekund.)',
    down: 'Alle servers liggen plat',
    downSub: 'Terugdraaien, terugdraaien, terugdraaien. Score {score}.',
    doneTitle: 'Opgraving voltooid',
    doneSub: 'Score {score}. Het dragende commentaar bleef heel. Waarschijnlijk.',
    newBest: 'Nieuw record!',
    again: 'Druk op Enter of tik om opnieuw te graven',
    servers: 'servers'
  }
};

const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));
const stage = $('stage');
const digBtn = /** @type {HTMLButtonElement} */ ($('dig'));
const shipBtn = /** @type {HTMLButtonElement} */ ($('ship'));

let lang = initialLang();
let best = loadBest();
let mode = 'loading'; // loading, title, digging, down, done
let layer = 0;
/** @type {Set<number>} */
let gone = new Set();
/** @type {Set<number>} */
let selected = new Set();
let expected = '';
let lives = LIVES;
let score = 0;
let dug = 0;
let busy = false;
let newBest = false;

const runner = new Runner(async () => new PHP(await loadPHPRuntime(await getPHPLoaderModule())));
const t = () => TEXT[lang];
const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
const L = () => LAYERS[layer];

function applyLang() {
  document.documentElement.lang = lang;
  for (const el of document.querySelectorAll('[data-t]')) el.textContent = t()[/** @type {HTMLElement} */ (el).dataset.t ?? ''];
  render();
  overlay();
}

function render() {
  $('layer-n').textContent = `${layer + 1}/${LAYERS.length}`;
  $('lines').textContent = String(dug);
  $('score').textContent = String(score);
  $('best').textContent = String(best);
  $('servers').textContent = `${t().servers} ${'●'.repeat(lives)}${'○'.repeat(LIVES - lives)}`;
  $('layer-title').textContent = `${L().year} · ${L().title[lang]}`;
  const list = $('code');
  list.replaceChildren();
  L().code.forEach((line, i) => {
    if (gone.has(i)) return;
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `line${selected.has(i) ? ' selected' : ''}`;
    b.setAttribute('aria-pressed', String(selected.has(i)));
    b.disabled = mode !== 'digging' || busy;
    const n = Object.assign(document.createElement('span'), { className: 'n', textContent: String(i + 1) });
    const code = Object.assign(document.createElement('code'), { textContent: line });
    b.append(n, code);
    b.addEventListener('click', () => {
      if (selected.has(i)) selected.delete(i);
      else selected.add(i);
      render();
    });
    li.append(b);
    list.append(li);
  });
  digBtn.textContent = selected.size ? fill(t().digN, { n: selected.size }) : t().dig;
  digBtn.disabled = mode !== 'digging' || busy || !selected.size;
  shipBtn.disabled = mode !== 'digging' || busy;
  stage.dataset.phase = mode;
  stage.dataset.layer = String(layer + 1);
  stage.dataset.score = String(score);
  stage.dataset.lives = String(lives);
}

function status(text, cls = '') {
  const s = $('status');
  s.textContent = text;
  s.className = `status ${cls}`;
}

async function openLayer(i) {
  layer = i;
  gone = new Set();
  selected = new Set();
  busy = true;
  render();
  expected = await runner.run(source(L(), gone));
  $('expected').textContent = expected;
  $('now').textContent = expected;
  busy = false;
  status(t().select);
  render();
}

async function dig() {
  if (mode !== 'digging' || busy || !selected.size) return;
  busy = true;
  render();
  const attempt = new Set([...gone, ...selected]);
  const out = await runner.run(source(L(), attempt));
  $('now').textContent = out;
  if (out === expected) {
    const n = selected.size;
    gone = attempt;
    dug += n;
    score += n * LINE_POINTS;
    status(fill(t().safe, { n }), 'ok');
    $('now').classList.remove('broken');
  } else {
    lives--;
    status(t().broke, 'err');
    $('now').classList.add('broken');
    stage.classList.remove('shake');
    void stage.offsetWidth;
    stage.classList.add('shake');
    if (lives <= 0) return end('down');
  }
  selected = new Set();
  busy = false;
  render();
}

async function ship() {
  if (mode !== 'digging' || busy) return;
  const left = L().code.length - gone.size;
  const extra = left - minimum(L());
  if (extra <= 0) {
    score += CLEAN_BONUS;
    status(fill(t().clean, { n: CLEAN_BONUS }), 'ok');
  } else status(fill(t().notClean, { n: extra }));
  $('now').classList.remove('broken');
  if (layer + 1 >= LAYERS.length) return end('done');
  await openLayer(layer + 1);
}

function end(m) {
  mode = m;
  busy = false;
  if (score > best) {
    best = score;
    newBest = true;
    saveBest(best);
  }
  render();
  overlay();
}

async function start() {
  mode = 'digging';
  lives = LIVES;
  score = 0;
  dug = 0;
  newBest = false;
  overlay();
  $('now').classList.remove('broken');
  await openLayer(0);
}

function overlay() {
  $('overlay').hidden = mode === 'digging';
  const set = (title, sub, how, hint) => {
    $('o-title').textContent = title;
    $('o-sub').textContent = sub;
    $('o-how').textContent = how;
    $('o-hint').textContent = hint;
  };
  if (mode === 'loading') set('Legacy Code Archaeology', t().loading, '', '');
  else if (mode === 'title') set('Legacy Code Archaeology', t().tagline, t().how, t().start);
  else if (mode === 'down') set(t().down, fill(t().downSub, { score }), newBest ? t().newBest : '', t().again);
  else if (mode === 'done') set(t().doneTitle, fill(t().doneSub, { score }), newBest ? t().newBest : '', t().again);
}

digBtn.addEventListener('click', dig);
shipBtn.addEventListener('click', ship);
$('overlay').addEventListener('click', () => {
  if (mode === 'title' || mode === 'down' || mode === 'done') start();
});
window.addEventListener('keydown', (e) => {
  if ((mode === 'title' || mode === 'down' || mode === 'done') && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    start();
  }
});

followHub((l) => {
  lang = l;
  applyLang();
});
applyLang();

// boot PHP once, up front: the first dig should be quick
await runner.run('<?php echo PHP_VERSION;').then((v) => (stage.dataset.php = v));
mode = 'title';
render();
overlay();
