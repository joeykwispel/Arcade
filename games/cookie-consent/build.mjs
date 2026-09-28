// Builds Cookie Consent Speedrun into dist/: one page per language from one template, no JavaScript on the page.
//   dist/index.html     English
//   dist/nl/index.html  Dutch
// src/index.html has {{key}} placeholders, filled from src/text.json; the stylesheet, font and icon are copied along.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const LANGS = ['en', 'nl'];
const text = JSON.parse(readFileSync('src/text.json', 'utf8'));
const template = readFileSync('src/index.html', 'utf8');

// the 40 vendors on banner 3, all with a "legitimate interest"
const VENDORS = [
  'AdNexus',
  'TrackBerry',
  'Pixelmonger',
  'DataHoover',
  'ClickSilo',
  'Beaconize',
  'Retargetly',
  'CookieJar Inc.',
  'Fingerprintr',
  'LeadLoop',
  'Adtopia',
  'Sniffly',
  'Brokerage 9',
  'Profilr',
  'Impressionist',
  'Cross-Site & Sons',
  'SegmentWorks',
  'PingBack',
  'Lookalike Labs',
  'ShadowPixel',
  'Audiencium',
  'Scrollwatch',
  'HeatMapper',
  'Bidstream',
  'Consentless',
  'Tagalong',
  'Surveillr',
  'MetricMill',
  'Upsellr',
  'Ad Infinitum',
  'Partner 31',
  'ThirdParty Ltd.',
  'Remarketeer',
  'Graphbound',
  'ClickFarm Co.',
  'DwellTime',
  'Omnitrack',
  'Behaviorama',
  'Linkrot Analytics',
  'YetAnotherCDN'
];

/** A case-insensitive pattern for the word to type, e.g. REJECT → [Rr][Ee][Jj][Ee][Cc][Tt] */
const anyCase = (word) => [...word].map((c) => `[${c.toUpperCase()}${c.toLowerCase()}]`).join('');

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The page for one language. Throws on a placeholder without text, or text that isn't used. */
function page(lang) {
  const t = text[lang];
  const values = {
    ...Object.fromEntries(Object.entries(t).map(([k, v]) => [k, escape(v)])),
    lang,
    root: lang === 'en' ? './' : '../',
    pattern: anyCase(t.l8_word),
    vendors: VENDORS.map(
      (v) => `<label class="switch"><span>${escape(v)} <small>${escape(t.l3_legit)}</small></span><input type="checkbox" checked /></label>`
    ).join('\n            ')
  };
  const used = new Set();
  const html = template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in values)) throw new Error(`src/index.html: no text for {{${key}}} in ${lang}`);
    used.add(key);
    return values[key];
  });
  // l8_word and l3_legit go in through pattern and vendors
  const unused = Object.keys(t).filter((k) => !used.has(k) && !['l8_word', 'l3_legit'].includes(k));
  if (unused.length) throw new Error(`src/text.json (${lang}): not used in the page: ${unused.join(', ')}`);
  return html;
}

rmSync('dist', { recursive: true, force: true });
for (const lang of LANGS) {
  const dir = lang === 'en' ? 'dist' : `dist/${lang}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/index.html`, page(lang));
}
cpSync('src/style.css', 'dist/style.css');
cpSync('public', 'dist', { recursive: true });
mkdirSync('dist/fonts');
cpSync('node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2', 'dist/fonts/jetbrains-mono.woff2');
console.log(`Cookie Consent Speedrun built into dist/ (${LANGS.join(', ')}), 0 bytes of JavaScript.`);
