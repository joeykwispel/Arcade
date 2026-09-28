// Checks the built pages (run `node build.mjs` first; `npm test` does both): no JavaScript anywhere, every banner
// reachable, and the English and Dutch pages built from the same markup.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const pages = { en: readFileSync('dist/index.html', 'utf8'), nl: readFileSync('dist/nl/index.html', 'utf8') };
const css = readFileSync('dist/style.css', 'utf8');
const ids = (html) => [...html.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);

test('no JavaScript: no script tags, no event handler attributes, no .js files, and a CSP that forbids scripts', () => {
  for (const html of Object.values(pages)) {
    assert.doesNotMatch(html, /<script/i);
    assert.doesNotMatch(html, /\son[a-z]+=/i);
    assert.doesNotMatch(html, /(href|src|action)="javascript:/i);
    assert.match(html, /script-src 'none'/);
  }
  const files = readdirSync('dist', { recursive: true }).map(String);
  assert.deepEqual(
    files.filter((f) => /\.m?js$/.test(f)),
    []
  );
});

test('every placeholder is filled, in the right language', () => {
  for (const [lang, html] of Object.entries(pages)) {
    assert.doesNotMatch(html, /\{\{/);
    assert.match(html, new RegExp(`<html lang="${lang}">`));
  }
  assert.match(pages.en, /Reject all/);
  assert.match(pages.nl, /Alles weigeren/);
});

test('both languages have the same controls', () => {
  assert.deepEqual(ids(pages.en), ids(pages.nl));
  assert.equal(new Set(ids(pages.en)).size, ids(pages.en).length, 'ids are unique');
});

test('every banner has a way out, and the stylesheet shows each banner after the one before', () => {
  const html = pages.en;
  for (let n = 0; n <= 8; n++) assert.ok(ids(html).includes(`s${n}`), `#s${n} (done with banner ${n}) is missing`);
  for (let n = 1; n <= 8; n++) {
    assert.ok(ids(html).includes(`l${n}`), `banner #l${n} is missing`);
    const prev = n === 1 ? 's0' : `s${n - 1}`;
    assert.ok(css.includes(`.game:has(#${prev}:checked):not(:has(#s${n}:checked)) #l${n}`), `no rule shows #l${n}`);
  }
});

test('every accepted cookie counts: each .pen checkbox has its own penalty in the stylesheet and in the sum', () => {
  const pens = [...pages.en.matchAll(/id="(p\w+)" class="sr pen"/g)].map((m) => m[1]);
  assert.ok(pens.length >= 8);
  for (const p of pens) {
    assert.ok(css.includes(`.game:has(#${p}:checked) {\n  --${p}: 1;`), `no penalty rule for #${p}`);
    assert.ok(css.includes(`var(--${p}, 0)`), `--${p} is not in the sum`);
  }
});

test('the captcha word is typed case-insensitively', () => {
  assert.match(pages.en, /pattern="\[Rr\]\[Ee\]\[Jj\]\[Ee\]\[Cc\]\[Tt\]"/);
  assert.match(pages.nl, /pattern="\[Ww\]\[Ee\]\[Ii\]\[Gg\]\[Ee\]\[Rr\]"/);
});
