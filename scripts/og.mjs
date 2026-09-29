// Generates the share images (Open Graph / Twitter cards) and the README banner from the real games:
//   static/og/play.png        the site (1200 × 630)
//   static/og/<slug>.png      one per game, used on /play/<slug>/ (1200 × 630)
//   docs/banner.png           the README banner (1280 × 400, 2x)
// It serves the build in dist/, plays each game for a few seconds in a headless browser, screenshots the canvas and
// lays that out in a banner. Run after `npm run build`: `npm run og` (PW_CHANNEL=chrome uses your installed Chrome).
import { createServer } from 'node:http';
import { mkdirSync, readFileSync } from 'node:fs';
import { chromium } from '@playwright/test';
import { staticHandler } from './static.mjs';

const games = JSON.parse(readFileSync('games.json', 'utf8'));
const font = (pkg, file) => `data:font/woff2;base64,${readFileSync(`node_modules/@fontsource-variable/${pkg}/files/${file}`).toString('base64')}`;
const INTER = font('inter', 'inter-latin-wght-normal.woff2');
const MONO = font('jetbrains-mono', 'jetbrains-mono-latin-wght-normal.woff2');

const server = createServer(staticHandler('dist'));
await new Promise((resolve) => server.listen(0, resolve));
const base = `http://localhost:${/** @type {import('node:net').AddressInfo} */ (server.address()).port}`;

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL });

/* ---------- 1. play each game and screenshot its canvas ---------- */

/** How to get each game into an interesting moment. `at(x, y)` clicks a point in the game's own world units. */
const scenes = {
  duck: {
    viewport: { width: 1200, height: 400 },
    async play(page) {
      await page.keyboard.press('Space');
      await page.waitForTimeout(1100);
      await page.keyboard.press('Space');
      await page.waitForTimeout(180);
    }
  },
  'git-gud': {
    viewport: { width: 1200, height: 750 },
    // a few levels done, so the rebase level is open; play half of it
    storage: { 'play:git-gud:stars': '3,3,3,3,3,2,3,3,0' },
    async play(page) {
      await page.getByRole('button', { name: /A straight line/ }).click();
      for (const line of ['git rebase main', 'git switch main']) {
        await page.keyboard.type(line);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(500);
      }
      await page.keyboard.type('git merge fea');
    }
  },
  'standup-survivor': {
    viewport: { width: 1200, height: 675 },
    // clock in, walk in circles for a while, pick upgrades as they come
    async play(page) {
      await page.keyboard.press('Space');
      const keys = ['KeyD', 'KeyS', 'KeyA', 'KeyW'];
      for (let i = 0; i < 26; i++) {
        await page.keyboard.down(keys[i % 4]);
        await page.waitForTimeout(700);
        await page.keyboard.up(keys[i % 4]);
        await page.keyboard.press('Digit1');
      }
      await page.keyboard.down('KeyD');
      await page.waitForTimeout(300);
    }
  },
  'infinite-scroll': {
    viewport: { width: 1200, height: 675 },
    // start and take the picture just before the first exception arrives (about 2 seconds in)
    async play(page) {
      await page.keyboard.press('Space');
      await page.keyboard.down('ArrowLeft');
      await page.waitForTimeout(250);
      await page.keyboard.up('ArrowLeft');
      await page.waitForTimeout(1300);
    }
  },
  'deploy-tycoon': {
    viewport: { width: 1200, height: 750 },
    // a company halfway to its IPO, with prod on fire
    storage: {
      'play:deploy-tycoon:save': JSON.stringify({
        version: 1,
        money: 4_870_000,
        earned: 7_900_000,
        allTime: 7_900_000,
        clicks: 1843,
        owned: { intern: 42, junior: 31, senior: 18, lead: 9, ci: 4, k8s: 1, agent: 0, datacenter: 0 },
        upgrades: ['intern-0', 'intern-1', 'intern-2', 'junior-0', 'junior-1', 'senior-0', 'keyboard', 'vim', 'coffee', 'desks', 'sre'],
        options: 0,
        round: 'seriesA',
        nextIncident: 400,
        incident: 2,
        played: 3100,
        lastSeen: Date.now()
      })
    },
    async play(page) {
      for (let i = 0; i < 6; i++) await page.getByTestId('push').click();
      await page.waitForTimeout(600);
    }
  },
  'semicolon-snake': {
    viewport: { width: 1200, height: 750 },
    // the whole editor: the line being written and what it expects are the point of the game
    selector: '#stage',
    // start, and turn a few times so the snake has moved into the board
    async play(page) {
      await page.keyboard.press('Space');
      for (const key of ['ArrowDown', 'ArrowRight', 'ArrowUp']) {
        await page.waitForTimeout(450);
        await page.keyboard.press(key);
      }
      await page.waitForTimeout(250);
    }
  },
  'dependency-hell': {
    viewport: { width: 1200, height: 750 },
    // a small, wobbly tower: drop a few packages around the middle
    async play(page) {
      await page.keyboard.press('Space');
      for (let i = 0; i < 6; i++) {
        const key = i % 2 ? 'ArrowLeft' : 'ArrowRight';
        await page.keyboard.down(key);
        await page.waitForTimeout(70);
        await page.keyboard.up(key);
        await page.keyboard.press('Space');
        await page.waitForTimeout(1200);
      }
    }
  },
  'dev-ware': {
    // small, so the microgame fills the picture
    viewport: { width: 720, height: 450 },
    selector: '.stage',
    // the microgames come in random order: start again until one of the busier ones is on screen
    async play(page) {
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press('Space');
        await page.locator('.stage[data-phase="playing"]').waitFor();
        const kind = await page.locator('.stage').getAttribute('data-kind');
        if (kind === 'modal' || kind === 'kill') break;
        await page.reload();
      }
      await page.waitForTimeout(400);
    }
  },
  'cookie-consent': {
    viewport: { width: 720, height: 450 },
    selector: '.game',
    // dark (a game without JavaScript takes its theme from the URL fragment), start, and fall for "Accept all" once
    async play(page) {
      await page.goto(`${page.url()}#dark`);
      await page.locator('label:has(#s0)').click();
      await page.waitForTimeout(1300);
      await page.locator('label:has(#p1)').click();
      await page.waitForTimeout(300);
    }
  },
  'code-review-tinder': {
    viewport: { width: 900, height: 560 },
    selector: 'body',
    // start, and drag the first card halfway to the right, so it tilts and shows LGTM
    async play(page) {
      await page.waitForFunction(() => document.body.dataset.phase === 'title');
      await page.keyboard.press('Space');
      await page.waitForTimeout(300);
      await page.mouse.move(450, 260);
      await page.mouse.down();
      for (let x = 450; x <= 560; x += 10) await page.mouse.move(x, 262);
      await page.waitForTimeout(200);
    }
  },
  'rm-rf-dungeon': {
    viewport: { width: 900, height: 560 },
    selector: '#stage',
    // wait for Python, then look around a room and fight whatever is in it
    async play(page) {
      await page.locator('#stage[data-ready="true"]').waitFor({ timeout: 30_000 });
      await page.locator('#out button.dir').first().click();
      for (let i = 0; i < 2; i++) {
        const target = page.locator('#out button.monster').last();
        if (await target.count()) await target.click();
      }
      await page.locator('#cmd').fill('whoami');
      await page.locator('#cmd').press('Enter');
      await page.locator('#cmd').fill('cat ');
      await page.waitForTimeout(300);
    }
  },
  'localhost-golf': {
    viewport: { width: 960, height: 600 },
    selector: 'canvas',
    // tee off on the contact page's first shot: start, then pull back and hold the aim line on screen
    async play(page) {
      await page.locator('body[data-phase="title"]').waitFor({ timeout: 30_000 });
      await page.mouse.click(480, 300);
      await page.mouse.move(500, 300);
      await page.mouse.down();
      for (let i = 1; i <= 8; i++) await page.mouse.move(500 - i * 14, 300 + i * 9);
      await page.waitForTimeout(300);
    }
  },
  'merge-conflict-tetris': {
    viewport: { width: 960, height: 600 },
    selector: '#stage',
    // a few pieces down, and the next conflict on screen
    async play(page) {
      await page.keyboard.press('Space');
      for (const [side, moves] of [
        ['1', ['ArrowLeft', 'ArrowLeft', 'ArrowLeft']],
        ['2', ['ArrowRight', 'ArrowRight']],
        ['1', ['ArrowUp', 'ArrowRight', 'ArrowRight', 'ArrowRight', 'ArrowRight']],
        ['2', ['ArrowLeft']]
      ]) {
        await page.keyboard.press(side);
        for (const m of moves) await page.keyboard.press(m);
        await page.keyboard.press('Space');
        await page.waitForTimeout(80);
      }
      await page.waitForTimeout(300);
    }
  },
  'regex-sniper': {
    viewport: { width: 960, height: 600 },
    selector: '#stage',
    // start, solve the warm-up, and type a regex that is almost there: every green matched, but reds too
    async play(page) {
      await page.locator('#stage[data-phase="title"]').waitFor({ timeout: 30_000 });
      await page.keyboard.press('Enter');
      await page.locator('#regex').fill('^foo');
      await page.keyboard.press('Enter');
      await page.locator('#regex').fill(String.raw`\d+\.\d+`);
      await page.waitForTimeout(200);
    }
  },
  'stack-overflow': {
    viewport: { width: 960, height: 600 },
    selector: '#stage',
    // ?demo=22 plays itself, perfectly, up to 22 frames deep: a tall stack with the next frame sliding in
    async play(page) {
      await page.goto(`${page.url()}&demo=22`);
      await page.locator('#stage[data-depth="22"]').waitFor({ timeout: 30_000 });
      await page.waitForTimeout(700);
    }
  },
  'null-pointer-dodge': {
    viewport: { width: 960, height: 600 },
    selector: '.stage',
    // start, and weave around for about six seconds, so the thrown fans of undefined are on screen too
    async play(page) {
      await page.keyboard.press('Space');
      for (const [key, ms] of [
        ['ArrowLeft', 600],
        ['ArrowRight', 900],
        ['ArrowLeft', 700],
        ['ArrowUp', 400],
        ['ArrowRight', 1000],
        ['ArrowLeft', 800],
        ['ArrowRight', 600],
        ['ArrowDown', 300]
      ]) {
        await page.keyboard.down(key);
        await page.waitForTimeout(ms);
        await page.keyboard.up(key);
      }
    }
  },
  'meeting-bingo': {
    viewport: { width: 960, height: 600 },
    selector: '.stage',
    // join, let the meeting talk for a while, then mark everything that has been said
    async play(page) {
      await page.keyboard.press('Space');
      await page.waitForTimeout(16_000);
      const said = await page.locator('.log li').allTextContents();
      for (const cell of await page.locator('.cell:not(.free)').all()) {
        const phrase = (await cell.textContent())?.toLowerCase() ?? '';
        const words = phrase.split(/W+/).filter((w) => w.length > 3);
        if (words.length && said.some((line) => words.every((w) => line.toLowerCase().includes(w)))) await cell.click();
      }
      await page.waitForTimeout(300);
    }
  },
  'bug-bash': {
    viewport: { width: 1200, height: 750 },
    // two levels done, so level 3 (two paths merging) is the one that opens
    storage: { 'play:bug-bash:stars': '3,2,0,0,0' },
    async play(page) {
      const box = await page.locator('canvas').boundingBox();
      const s = Math.min(box.width / 960, box.height / 600);
      const cell = (c, r) => page.mouse.click(box.x + (box.width - 960 * s) / 2 + (60 + c * 40) * s, box.y + (box.height - 600 * s) / 2 + (52 + r * 40) * s);
      await page.keyboard.press('Enter');
      for (const [key, c, r] of [
        ['Digit2', 5, 5],
        ['Digit1', 7, 4],
        ['Digit1', 9, 5]
      ]) {
        await page.keyboard.press(key);
        await cell(c, r);
      }
      await page.keyboard.press('Escape');
      await page.keyboard.press('Space');
      await page.waitForTimeout(7000);
      await cell(5, 5); // select the Unit Test, so its range shows
      await page.mouse.move(0, 0);
      await page.waitForTimeout(400);
    }
  }
};

/** @type {Record<string, string>} slug → PNG data URL */
const shots = {};
for (const g of games) {
  const scene = scenes[g.slug];
  if (!scene) throw new Error(`scripts/og.mjs has no scene for ${g.slug}: add one to \`scenes\``);
  const ctx = await browser.newContext({ viewport: scene.viewport, deviceScaleFactor: 2 });
  await ctx.addInitScript((storage) => {
    localStorage.setItem('theme', 'dark');
    for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, v);
  }, scene.storage ?? {});
  const page = await ctx.newPage();
  await page.goto(`${base}/games/${g.slug}/?lang=en`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  await scene.play(page);
  const view = page.locator(scene.selector ?? 'canvas, #root, .app').first();
  shots[g.slug] = `data:image/png;base64,${(await view.screenshot()).toString('base64')}`;
  await ctx.close();
}

/* ---------- 2. lay the screenshots out in banners ---------- */

const css = `
  @font-face { font-family: Inter; src: url(${INTER}) format('woff2'); font-weight: 100 900; }
  @font-face { font-family: Mono; src: url(${MONO}) format('woff2'); font-weight: 100 800; }
  * { box-sizing: border-box; margin: 0; }
  body {
    width: 100vw; height: 100vh; overflow: hidden; position: relative;
    font-family: Inter, sans-serif; color: #e6e9f2; background-color: #0a0e17;
    background-image:
      radial-gradient(900px 560px at 88% -12%, rgba(180, 156, 255, 0.2), transparent 60%),
      radial-gradient(760px 520px at -8% 110%, rgba(125, 211, 192, 0.16), transparent 60%),
      linear-gradient(rgba(152, 163, 185, 0.07) 1px, transparent 1px),
      linear-gradient(90deg, rgba(152, 163, 185, 0.07) 1px, transparent 1px);
    background-size: auto, auto, 48px 48px, 48px 48px;
  }
  .mono { font-family: Mono, monospace; }
  .logo { font-family: Mono, monospace; font-weight: 800; font-size: 26px; padding: 8px 14px; border: 1.5px solid #253049;
          border-radius: 12px; background: rgba(23, 32, 51, 0.7); display: inline-block; letter-spacing: -0.02em; }
  .logo b { color: #7dd3c0; }
  .kicker { font-family: Mono, monospace; font-size: 22px; color: #98a3b9; }
  .grad { background: linear-gradient(100deg, #7dd3c0, #c3b1ff); -webkit-background-clip: text; background-clip: text; color: transparent; }
  .pill { display: inline-flex; align-items: center; gap: 10px; font-family: Mono, monospace; font-size: 20px; font-weight: 600;
          color: #7dd3c0; border: 1.5px solid rgba(125, 211, 192, 0.45); border-radius: 999px; padding: 8px 18px; background: rgba(125, 211, 192, 0.07); }
  .pill.alt { color: #c3b1ff; border-color: rgba(195, 177, 255, 0.45); background: rgba(195, 177, 255, 0.07); }
  .window { border-radius: 16px; overflow: hidden; border: 1.5px solid rgba(125, 211, 192, 0.35); background: #0d1220;
            box-shadow: 0 30px 80px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(0, 0, 0, 0.3); }
  .chrome { display: flex; align-items: center; gap: 14px; padding: 11px 16px; background: #111827; border-bottom: 1px solid #253049;
            font-family: Mono, monospace; font-size: 15px; color: #98a3b9; white-space: nowrap; }
  .chrome i { width: 12px; height: 12px; border-radius: 50%; display: inline-block; margin-right: 6px; }
  .chrome b { color: #e6e9f2; font-weight: 600; }
  .window img { display: block; width: 100%; }
  .url { font-family: Mono, monospace; font-size: 20px; color: #98a3b9; }
`;

const chrome = (slug) =>
  `<div class="chrome"><span><i style="background:#ff5f57"></i><i style="background:#febc2e"></i><i style="background:#28c840"></i></span><span>~/games/<b>${slug}</b>/index.html</span></div>`;
const windowFor = (slug, style = '') => `<div class="window" style="${style}">${chrome(slug)}<img src="${shots[slug]}" alt=""></div>`;
const logo = `<span class="logo">&lt;<b>JO</b>/&gt;</span>`;

/** One game: text left, the game right. */
function gameCard(g) {
  const flat = g.slug === 'duck';
  return `
    <div style="position:absolute; left:64px; top:64px; width:440px; display:flex; flex-direction:column; gap:22px;">
      <div style="display:flex; align-items:center; gap:18px;">${logo}<span class="kicker">arcade.joeyoosenbrug.nl</span></div>
      <h1 style="font-family:Mono,monospace; font-size:${g.title.en.length > 10 ? 58 : 70}px; font-weight:800; letter-spacing:-0.05em; line-height:1;">${g.title.en}</h1>
      <p style="font-size:24px; line-height:1.4; color:#98a3b9;">${g.description.en}</p>
      <div style="display:flex; gap:12px; flex-wrap:wrap;"><span class="pill">${g.framework}</span>${g.tooling ? `<span class="pill alt">${g.tooling}</span>` : ''}</div>
    </div>
    ${windowFor(g.slug, flat ? 'position:absolute; left:548px; top:190px; width:720px; transform:rotate(-2deg);' : 'position:absolute; left:548px; top:92px; width:760px; transform:rotate(-2deg);')}`;
}

/** The site: title left, the games stacked right. `short` is the wide README banner. */
function siteCard(width, short = false) {
  const pills = `<div style="display:flex; gap:12px; flex-wrap:wrap;">${games.map((g, i) => `<span class="pill${i % 2 ? ' alt' : ''}">${g.framework}</span>`).join('')}</div>`;
  const text = short
    ? `<div style="position:absolute; left:56px; top:48px; width:620px; display:flex; flex-direction:column; gap:18px;">
         <div style="display:flex; align-items:center; gap:18px;">${logo}<span class="kicker">arcade.joeyoosenbrug.nl</span></div>
         <h1 style="font-size:62px; font-weight:800; letter-spacing:-0.045em; line-height:1.02;">Small games, <span class="grad">different stacks.</span></h1>
         <p style="font-size:21px; line-height:1.4; color:#98a3b9; max-width:560px;">Browser games, each built with a different stack. Same kind of project, different tools.</p>
         ${pills}
       </div>`
    : `<div style="position:absolute; left:64px; top:64px; width:520px; display:flex; flex-direction:column; gap:24px;">
         <div style="display:flex; align-items:center; gap:18px;">${logo}<span class="kicker">arcade.joeyoosenbrug.nl</span></div>
         <h1 style="font-size:68px; font-weight:800; letter-spacing:-0.045em; line-height:1.02;">Small games,<br><span class="grad">different stacks.</span></h1>
         <p style="font-size:24px; line-height:1.4; color:#98a3b9;">Browser games, each built with a different stack. Same kind of project, different tools.</p>
         ${pills}
       </div>`;
  const windows = short
    ? windowFor('bug-bash', `position:absolute; left:${width - 520}px; top:34px; width:500px; transform:rotate(2deg);`) +
      windowFor('duck', `position:absolute; left:${width - 610}px; top:232px; width:400px; transform:rotate(-3deg);`)
    : windowFor('bug-bash', `position:absolute; left:${width - 610}px; top:70px; width:620px; transform:rotate(2deg);`) +
      windowFor('duck', `position:absolute; left:${width - 700}px; top:420px; width:480px; transform:rotate(-3deg);`);
  return text + windows;
}

/** @param {string} html @param {string} path @param {{width:number,height:number}} size @param {number} scale */
async function render(html, path, size, scale) {
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: scale });
  const page = await ctx.newPage();
  await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body>${html}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path, type: 'png' });
  await ctx.close();
  console.log(`wrote ${path}`);
}

mkdirSync('static/og', { recursive: true });
mkdirSync('docs', { recursive: true });
const OG = { width: 1200, height: 630 };
await render(siteCard(1200), 'static/og/play.png', OG, 1);
for (const g of games) await render(gameCard(g), `static/og/${g.slug}.png`, OG, 1);
await render(siteCard(1280, true), 'docs/banner.png', { width: 1280, height: 400 }, 2);

await browser.close();
server.close();
