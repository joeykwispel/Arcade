import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const games: { slug: string }[] = JSON.parse(readFileSync(new URL('../games.json', import.meta.url), 'utf8'));
const upcoming: { slug: string }[] = JSON.parse(readFileSync(new URL('../upcoming.json', import.meta.url), 'utf8'));

/** Collects CSP violations and uncaught errors, in the hub and in the game frame, so a test fails if either breaks. */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && /Content Security Policy|Refused to/i.test(m.text())) errors.push(m.text());
  });
  return errors;
}

test('home page lists the games in English and Dutch', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('different stacks');
  const card = page.locator('a.card', { hasText: 'Rubber Duck Run' });
  await expect(card).toContainText('Vanilla JS + Canvas');
  await expect(card).toHaveAttribute('href', '/play/duck/');
  await expect(page.locator('link[rel=alternate][hreflang=nl]')).toHaveAttribute('href', /\/nl\/$/);

  await page.goto('/nl/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'nl');
  await expect(page.locator('a.card', { hasText: 'Rubber Duck Run' })).toHaveAttribute('href', '/nl/play/duck/');
  await expect(page.locator('a.card', { hasText: 'Bug Bash' })).toHaveAttribute('href', '/nl/play/bug-bash/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('andere stacks');
  expect(errors).toEqual([]);
});

test('a card opens the game in an iframe, with a way back', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/');
  await page.locator('a.card', { hasText: 'Rubber Duck Run' }).click();
  await expect(page).toHaveURL(/\/play\/duck\/$/);
  const frame = page.frameLocator('iframe');
  await expect(frame.locator('canvas#game')).toBeVisible();
  await expect(frame.locator('#title')).toHaveText('Rubber Duck Run');
  await page.getByRole('link', { name: /cd \.\./ }).click();
  await expect(page).toHaveURL(/localhost:\d+\/$/);
  expect(errors).toEqual([]);
});

test('the game starts, and a crash shows the game over screen', async ({ page }) => {
  await page.goto('/play/duck/');
  const frame = page.frameLocator('iframe');
  await expect(frame.locator('#title')).toHaveText('Rubber Duck Run');
  await frame.locator('#stage').click();
  await expect(frame.locator('#overlay')).toBeHidden();
  // Doing nothing, the duck runs into the first obstacle within a few seconds.
  await expect(frame.locator('#overlay')).toBeVisible({ timeout: 15_000 });
  await expect(frame.locator('#hint')).toContainText('git reset --hard');
  const best = await page.frames()[1].evaluate(() => Number(localStorage.getItem('play:duck:hi')));
  expect(best).toBeGreaterThan(0);
});

test('the game follows the language and the theme of the hub', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/nl/play/duck/');
  const frame = page.frameLocator('iframe');
  await expect(frame.locator('#sub')).toContainText('spatie');
  await expect(frame.locator('html')).toHaveAttribute('lang', 'nl');
  await expect(frame.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.locator('.jo-nav__theme').click();
  await expect(frame.locator('html')).toHaveAttribute('data-theme', 'light');
  expect(errors).toEqual([]);
});

test('language switch keeps the page and is remembered', async ({ page, isMobile }) => {
  test.skip(isMobile, 'the switch is the same component on mobile');
  await page.goto('/play/duck/');
  await page.getByRole('link', { name: 'NL', exact: true }).click();
  await expect(page).toHaveURL(/\/nl\/play\/duck\/$/);
  await page.goto('/');
  await expect(page).toHaveURL(/\/nl\/$/);
});

test('the game also works on its own page', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/games/duck/?lang=en');
  await expect(page.locator('html')).toHaveClass(/standalone/);
  await page.keyboard.press('Space');
  await expect(page.locator('#overlay')).toBeHidden();
  expect(errors).toEqual([]);
});

test('Bug Bash loads its WebAssembly and starts a level from the keyboard', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/play/bug-bash/');
  const frame = page.frameLocator('iframe');
  const stage = frame.locator('#stage');
  await expect(stage).toHaveAttribute('data-screen', 'menu');
  await frame.locator('canvas#game').click();
  await page.keyboard.press('Enter');
  await expect(stage).toHaveAttribute('data-screen', 'playing');
  await expect(frame.locator('#live')).toContainText('hello-world.js');
  await page.keyboard.press('Space');
  await expect(frame.locator('#live')).toContainText('Sprint 1 of 5');
  await page.keyboard.press('Escape');
  await expect(stage).toHaveAttribute('data-screen', 'paused');
  expect(errors).toEqual([]);
});

test('Bug Bash follows the language of the hub and works on its own page', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/nl/play/bug-bash/');
  const frame = page.frameLocator('iframe');
  await expect(frame.locator('html')).toHaveAttribute('lang', 'nl');
  await expect(frame.locator('#stage')).toHaveAttribute('data-screen', 'menu');
  await frame.locator('canvas#game').click();
  await page.keyboard.press('Enter');
  await expect(frame.locator('#live')).toContainText('spatie');

  await page.goto('/games/bug-bash/?lang=en');
  await expect(page.locator('html')).toHaveClass(/standalone/);
  await expect(page.locator('#stage')).toHaveAttribute('data-screen', 'menu');
  expect(errors).toEqual([]);
});

test('Git Gud: a level is solved by typing git commands', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/play/git-gud/');
  const frame = page.frameLocator('iframe');
  await expect(frame.locator('.app')).toHaveAttribute('data-screen', 'menu');
  await frame.getByRole('button', { name: /Hello, git/ }).click();
  const input = frame.getByRole('textbox', { name: 'git command' });
  await input.fill('git push --force');
  await input.press('Enter');
  await expect(frame.locator('.log .err').last()).toContainText('not a git command');
  for (const line of ['git commit', 'git commit']) {
    await input.fill(line);
    await input.press('Enter');
  }
  await expect(frame.getByRole('dialog')).toContainText('★★★');
  await frame.getByRole('button', { name: 'next level' }).click();
  await expect(frame.locator('.bar h1')).toContainText('Branch out');
  expect(errors).toEqual([]);
});

test('Git Gud speaks Dutch in the Dutch hub and keeps progress', async ({ page }) => {
  await page.goto('/nl/play/git-gud/');
  const frame = page.frameLocator('iframe');
  await expect(frame.locator('html')).toHaveAttribute('lang', 'nl');
  await expect(frame.getByText('Geschiedenis herschrijven')).toBeVisible();
  await frame.getByRole('button', { name: /Hallo, git/ }).click();
  const input = frame.getByRole('textbox', { name: 'git command' });
  for (const line of ['git branch tmp', 'git branch -d tmp', 'git commit', 'git commit']) {
    await input.fill(line);
    await input.press('Enter');
  }
  // four moves where two will do: solved, but two stars
  await expect(frame.getByRole('dialog')).toContainText('★★☆');
  const saved = await page.frames()[1].evaluate(() => localStorage.getItem('play:git-gud:stars'));
  expect(saved?.startsWith('2,')).toBe(true);
});

test('Standup Survivor (Kotlin/JS) starts, runs and pauses', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/play/standup-survivor/');
  const frame = page.frameLocator('iframe');
  const stage = frame.locator('#stage');
  await expect(stage).toHaveAttribute('data-phase', 'ready');
  await frame.locator('canvas#game').click();
  await expect(stage).toHaveAttribute('data-phase', 'playing');
  await expect(frame.locator('#live')).toContainText('09:00');
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(1500);
  await page.keyboard.up('KeyD');
  await page.keyboard.press('KeyP');
  await expect(stage).toHaveAttribute('data-phase', 'paused');
  expect(errors).toEqual([]);
});

test('Standup Survivor speaks Dutch on its own page', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/games/standup-survivor/?lang=nl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'nl');
  await expect(page.locator('html')).toHaveClass(/standalone/);
  await page.keyboard.press('Space');
  await expect(page.locator('#live')).toContainText('Ingeklokt');
  expect(errors).toEqual([]);
});

test('Infinite Scroll renders the 3D tunnel, runs and pauses', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/play/infinite-scroll/');
  const frame = page.frameLocator('iframe');
  const stage = frame.locator('#stage');
  await expect(stage).toHaveAttribute('data-phase', 'ready');
  await expect(frame.locator('#fallback')).toBeHidden();
  await expect(frame.locator('#title')).toHaveText('Infinite Scroll');
  await frame.locator('canvas#game').click();
  await expect(stage).toHaveAttribute('data-phase', 'running');
  await page.waitForTimeout(1200);
  await expect(frame.locator('#score')).not.toHaveText('0');
  await page.keyboard.press('KeyP');
  await expect(stage).toHaveAttribute('data-phase', 'paused');
  expect(errors).toEqual([]);
});

test('Infinite Scroll ends with an exception, keeps the best score, and speaks Dutch', async ({ page }) => {
  // seed 2: the same tunnel every time, where standing still hits the very first obstacle (checked in World_test.res)
  await page.goto('/games/infinite-scroll/?lang=nl&seed=2');
  await expect(page.locator('html')).toHaveAttribute('lang', 'nl');
  await expect(page.locator('#hint')).toContainText('spatie');
  await page.keyboard.press('Space');
  await expect(page.locator('#stage')).toHaveAttribute('data-phase', 'over', { timeout: 30_000 });
  await expect(page.locator('#hint')).toContainText('npm run scroll');
  const best = await page.evaluate(() => Number(localStorage.getItem('play:infinite-scroll:best')));
  expect(best).toBeGreaterThan(0);
});

test('Deploy Tycoon: push, hire, and the company is still there after a reload', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/play/deploy-tycoon/');
  const frame = page.frameLocator('iframe');
  const push = frame.getByTestId('push');
  for (let i = 0; i < 20; i++) await push.click();
  await expect(frame.getByTestId('cash')).toHaveText('$20');
  await frame.locator('button.gen', { hasText: 'Intern' }).click();
  await expect(frame.locator('button.gen', { hasText: 'Intern' }).locator('.owned')).toHaveText('1');
  await expect(frame.locator('.feed')).toContainText('1× Intern');
  // income from the intern
  await expect(frame.locator('.rate')).toContainText('$0.2/s');
  await page.reload();
  await expect(page.frameLocator('iframe').locator('button.gen', { hasText: 'Intern' }).locator('.owned')).toHaveText('1');
  expect(errors).toEqual([]);
});

test('Deploy Tycoon speaks Dutch and pays out time away', async ({ page }) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    const save = {
      version: 1,
      money: 0,
      earned: 5000,
      allTime: 5000,
      clicks: 10,
      owned: { junior: 10 },
      upgrades: [],
      options: 0,
      round: 'seed',
      nextIncident: 999,
      incident: -1,
      played: 60,
      lastSeen: Date.now() - 3600_000
    };
    localStorage.setItem('play:deploy-tycoon:save', JSON.stringify(save));
  });
  await page.goto('/games/deploy-tycoon/?lang=nl');
  await expect(page.getByRole('dialog')).toContainText('Welkom terug');
  // 10 juniors × $1/s × 3600 s × 50%
  await expect(page.getByRole('dialog')).toContainText('$18.0K');
  await page.getByRole('button', { name: 'lekker' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText('team & infra')).toBeVisible();
});

test('pages have a large share image that exists', async ({ page, request }) => {
  for (const [path, image] of [
    ['/', '/og/play.png'],
    ['/nl/play/bug-bash/', '/og/bug-bash.png']
  ]) {
    await page.goto(path);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
    const url = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(url).toBe(`https://arcade.joeyoosenbrug.nl${image}`);
    const res = await request.get(image);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toBe('image/png');
  }
});

test('Semicolon Snake runs Lua in the browser: the HUD, and a crash into the wall or a syntax error', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/play/semicolon-snake/');
  const frame = page.frameLocator('iframe');
  const stage = frame.locator('#stage');
  await expect(stage).toHaveAttribute('data-phase', 'ready');
  await expect(frame.locator('#expects')).toContainText('local, print, return');
  await frame.locator('canvas#game').click();
  await expect(stage).toHaveAttribute('data-phase', 'running');
  // heading right without turning, the snake reaches the wall (or eats a token that doesn't fit) within seconds
  await expect(stage).toHaveAttribute('data-phase', 'over', { timeout: 15_000 });
  await expect(frame.locator('#title')).toHaveText(/Segmentation fault|SyntaxError/);
  expect(errors).toEqual([]);
});

test('Semicolon Snake speaks Dutch on its own page', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/games/semicolon-snake/?lang=nl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'nl');
  await expect(page.locator('html')).toHaveClass(/standalone/);
  await expect(page.locator('#hint')).toContainText('spatie');
  await expect(page.locator('#expects')).toContainText('verwacht');
  expect(errors).toEqual([]);
});

test('Dependency Hell loads its C++/WebAssembly physics and stacks a package', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/play/dependency-hell/');
  const frame = page.frameLocator('iframe');
  const stage = frame.locator('#stage');
  await expect(stage).toHaveAttribute('data-phase', 'ready');
  await frame.locator('#overlay').click();
  await expect(stage).toHaveAttribute('data-phase', 'running');
  await frame.getByRole('button', { name: 'drop' }).click();
  // the package falls onto node_modules and the tower gets taller
  await expect(frame.locator('#size')).toHaveText('node_modules 37 MB', { timeout: 15_000 });
  await expect(frame.locator('#height')).not.toHaveText('height 0.0 m');
  expect(errors).toEqual([]);
});

test('Dependency Hell speaks Dutch on its own page', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/games/dependency-hell/?lang=nl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'nl');
  await expect(page.locator('#hint')).toContainText('npm install');
  await expect(page.getByRole('button', { name: 'laat vallen' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Dev-Ware runs its Gleam + Lustre microgames one after another', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/play/dev-ware/');
  const frame = page.frameLocator('iframe');
  const stage = frame.locator('.stage');
  await expect(stage).toHaveAttribute('data-phase', 'title');
  await frame.locator('.overlay').click();
  // the order is shouted first, then the microgame itself, then it's won or lost
  await expect(stage).toHaveAttribute('data-phase', 'playing', { timeout: 5_000 });
  await expect(stage).toHaveAttribute('data-kind', /.+/);
  await expect(stage).toHaveAttribute('data-phase', 'result', { timeout: 10_000 });
  expect(errors).toEqual([]);
});

test('Dev-Ware speaks Dutch on its own page', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/games/dev-ware/?lang=nl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'nl');
  await expect(page.locator('.hint')).toContainText('spatie');
  expect(errors).toEqual([]);
});

test('Cookie Consent Speedrun is played without JavaScript: reject a banner, and accepting costs time', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/play/cookie-consent/');
  const frame = page.frameLocator('iframe');
  await frame.getByText('Start the timer').click();
  await expect(frame.locator('#l1')).toBeVisible();
  await frame.locator('#l1').getByText('Accept all').click();
  await expect(frame.locator('#l1 .shame')).toBeVisible();
  await expect(frame.locator('#l1').getByText('Accept all')).toBeHidden();
  await frame.locator('#l1').getByText('reject all').click();
  await expect(frame.locator('#l2')).toBeVisible();
  // the page really has no scripts
  expect(await frame.locator('script').count()).toBe(0);
  expect(errors).toEqual([]);
});

test('Cookie Consent Speedrun follows the site theme through the URL fragment', async ({ page }) => {
  await page.goto('/play/cookie-consent/');
  const body = page.frameLocator('iframe').locator('body');
  await page.evaluate(() => (document.documentElement.dataset.theme = 'light'));
  await expect(body).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await page.evaluate(() => (document.documentElement.dataset.theme = 'dark'));
  await expect(body).toHaveCSS('background-color', 'rgb(13, 18, 32)');
});

test('Cookie Consent Speedrun has a Dutch page, which the Dutch site loads', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/nl/play/cookie-consent/');
  const frame = page.frameLocator('iframe');
  await expect(frame.locator('html')).toHaveAttribute('lang', 'nl');
  await expect(frame.getByText('Start de timer')).toBeVisible();
  expect(errors).toEqual([]);
});

test('Code Review Tinder runs its Flutter build and reviews a PR', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/play/code-review-tinder/');
  const body = page.frameLocator('iframe').locator('body');
  // Flutter draws on a canvas; the game reports its state as data attributes on <body>
  await expect(body).toHaveAttribute('data-phase', 'title', { timeout: 20_000 });
  await page.locator('iframe').focus();
  await page.keyboard.press('Space');
  await expect(body).toHaveAttribute('data-phase', 'playing');
  await page.keyboard.press('ArrowRight');
  await expect(body).toHaveAttribute('data-reviewed', '1');
  expect(errors).toEqual([]);
});

test('Code Review Tinder speaks Dutch on its own page', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/games/code-review-tinder/?lang=nl');
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'title', { timeout: 20_000 });
  await expect(page.locator('html')).toHaveAttribute('lang', 'nl');
  expect(errors).toEqual([]);
});

test('rm -rf dungeon boots Python in the browser and runs commands', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/play/rm-rf-dungeon/');
  const frame = page.frameLocator('iframe');
  await expect(frame.locator('#stage')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
  await expect(frame.locator('#out')).toContainText('Python 3.');
  const cmd = frame.locator('#cmd');
  await cmd.fill('help');
  await cmd.press('Enter');
  await expect(frame.locator('#out')).toContainText('sudo rm');
  // tapping a room cds into it
  await frame.locator('#out button.dir').first().click();
  await expect(frame.locator('#cwd')).toHaveText(/^\/floor1\/.+/);
  await cmd.fill('vim');
  await cmd.press('Enter');
  await expect(frame.locator('#out')).toContainText('vim: command not found');
  expect(errors).toEqual([]);
});

test('rm -rf dungeon speaks Dutch on its own page', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/games/rm-rf-dungeon/?lang=nl');
  await expect(page.locator('#stage')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
  await expect(page.locator('html')).toHaveAttribute('lang', 'nl');
  await expect(page.locator('#out')).toContainText('kerker');
  expect(errors).toEqual([]);
});

test('Localhost Golf runs its Godot export and takes a shot', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/play/localhost-golf/');
  const frame = page.frameLocator('iframe');
  const body = frame.locator('body');
  // Godot draws on a canvas; the game reports its state as data attributes on <body>
  await expect(body).toHaveAttribute('data-phase', 'title', { timeout: 30_000 });
  await page.locator('iframe').focus();
  await page.keyboard.press('Space');
  await expect(body).toHaveAttribute('data-phase', 'aim');
  // hold Space for power, let go to shoot
  await page.keyboard.down('Space');
  await page.waitForTimeout(400);
  await page.keyboard.up('Space');
  await expect(body).toHaveAttribute('data-strokes', '1');
  expect(errors).toEqual([]);
});

test('Localhost Golf speaks Dutch on its own page', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/games/localhost-golf/?lang=nl');
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'title', { timeout: 30_000 });
  await expect(page.locator('html')).toHaveAttribute('lang', 'nl');
  expect(errors).toEqual([]);
});

test('Merge Conflict Tetris runs its Go/WebAssembly rules and drops a piece', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/play/merge-conflict-tetris/');
  const frame = page.frameLocator('iframe');
  const stage = frame.locator('#stage');
  await expect(stage).toHaveAttribute('data-phase', 'title');
  await frame.locator('#overlay').click();
  await expect(stage).toHaveAttribute('data-phase', 'choosing');
  await frame.getByRole('button', { name: 'Accept Current Change' }).click();
  await expect(stage).toHaveAttribute('data-phase', 'falling');
  await frame.locator('[data-input="5"]').dispatchEvent('pointerdown');
  // landing on the bottom scores the drop, and the next conflict comes up
  await expect(stage).toHaveAttribute('data-phase', 'choosing');
  await expect(stage).not.toHaveAttribute('data-score', '0');
  expect(errors).toEqual([]);
});

test('Merge Conflict Tetris speaks Dutch on its own page', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/games/merge-conflict-tetris/?lang=nl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'nl');
  await expect(page.getByRole('button', { name: 'Huidige wijziging accepteren' })).toBeAttached();
  expect(errors).toEqual([]);
});

test('Regex Sniper checks real Ruby regexes in the browser, with a cheatsheet', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/play/regex-sniper/');
  const frame = page.frameLocator('iframe');
  const stage = frame.locator('#stage');
  await expect(stage).toHaveAttribute('data-phase', 'title', { timeout: 30_000 });
  await expect(stage).toHaveAttribute('data-ruby', /^3\.\d/);
  await frame.locator('#overlay').click();
  await expect(frame.locator('.goal')).toContainText('every green word');
  const regex = frame.locator('#regex');
  // a broken regex gets Ruby's own error
  await regex.fill('[a-');
  await expect(frame.locator('#status')).toContainText('premature end of char-class');
  // the cheatsheet types symbols in: ^ then foo solves the warm-up on target
  // (on a phone it starts closed)
  await regex.fill('');
  const toggle = frame.locator('#cheat-toggle');
  if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
  await frame.locator('#cheat-list button', { hasText: /^\^$/ }).click();
  await regex.press('End');
  await regex.pressSequentially('foo');
  await expect(stage).toHaveAttribute('data-phase', 'solved');
  await regex.press('Enter');
  await expect(stage).toHaveAttribute('data-level', '2');
  await expect(stage).toHaveAttribute('data-total', '4');
  expect(errors).toEqual([]);
});

test('Regex Sniper speaks Dutch on its own page', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/games/regex-sniper/?lang=nl');
  await expect(page.locator('#stage')).toHaveAttribute('data-phase', 'title', { timeout: 30_000 });
  await expect(page.locator('html')).toHaveAttribute('lang', 'nl');
  await expect(page.locator('#level-name')).toContainText('Opwarmen');
  await expect(page.locator('#cheat-title')).toContainText('Veelgebruikte');
  expect(errors).toEqual([]);
});

test('Stack Overflow runs its Zig/WebAssembly rules: a frame lands, a miss segfaults', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/play/stack-overflow/');
  const frame = page.frameLocator('iframe');
  const stage = frame.locator('#stage');
  await expect(stage).toHaveAttribute('data-phase', 'title');
  await page.locator('iframe').focus();
  await page.keyboard.press('Space');
  await expect(stage).toHaveAttribute('data-phase', 'playing');
  // the first frame slides in over main() from the right: after a moment it lands
  await page.waitForTimeout(700);
  await page.keyboard.press('Space');
  await expect(stage).toHaveAttribute('data-depth', '2');
  // the next comes in from the far left: dropped straight away, it lands on nothing
  await page.waitForTimeout(150);
  await page.keyboard.press('Space');
  await expect(stage).toHaveAttribute('data-phase', 'segfault');
  await expect(frame.locator('#o-title')).toContainText('Segmentation fault');
  expect(errors).toEqual([]);
});

test('Stack Overflow speaks Dutch on its own page', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/games/stack-overflow/?lang=nl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'nl');
  await expect(page.locator('#o-hint')).toContainText('spatie');
  expect(errors).toEqual([]);
});

test('Null Pointer Dodge runs in Vue: you move, time counts, and a crash names the value', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/play/null-pointer-dodge/');
  const frame = page.frameLocator('iframe');
  const stage = frame.locator('.stage');
  await expect(stage).toHaveAttribute('data-phase', 'title');
  await frame.locator('.overlay').click();
  await expect(stage).toHaveAttribute('data-phase', 'playing');
  // standing still in the rain, sooner or later something hits you
  await expect(stage).toHaveAttribute('data-phase', 'crashed', { timeout: 60_000 });
  await expect(frame.locator('.big.error')).toContainText(/TypeError/);
  await expect(stage).not.toHaveAttribute('data-score', '0');
  expect(errors).toEqual([]);
});

test('Null Pointer Dodge speaks Dutch on its own page', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/games/null-pointer-dodge/?lang=nl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'nl');
  await expect(page.locator('.hint')).toContainText('spatie');
  expect(errors).toEqual([]);
});

test('Meeting Bingo runs its meeting in Solid: a false alarm, then the transcript talks', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/play/meeting-bingo/');
  const frame = page.frameLocator('iframe');
  const stage = frame.locator('.stage');
  await expect(stage).toHaveAttribute('data-phase', 'title');
  await frame.locator('.overlay').click();
  await expect(stage).toHaveAttribute('data-phase', 'playing');
  // nobody has said anything yet, so marking a square now is a false alarm
  await frame.locator('.cell').first().click();
  await expect(frame.locator('.false')).toBeVisible();
  await expect(frame.locator('.cell').first()).toHaveAttribute('aria-pressed', 'false');
  await expect(frame.locator('.cell.free')).toHaveAttribute('aria-pressed', 'true');
  // then the meeting starts talking
  await expect(frame.locator('.log li')).not.toHaveCount(1, { timeout: 10_000 });
  expect(errors).toEqual([]);
});

test('Meeting Bingo speaks Dutch on its own page', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/games/meeting-bingo/?lang=nl');
  await expect(page.locator('.hint')).toContainText('spatie');
  await expect(page.locator('.cell.free')).toHaveText('je staat op mute');
  expect(errors).toEqual([]);
});

test('Rubber Duck Therapy runs its ClojureScript: explain, find the bug, fix it', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/play/rubber-duck-therapy/');
  const frame = page.frameLocator('iframe');
  const stage = frame.locator('.stage');
  await expect(stage).toHaveAttribute('data-phase', 'title');
  await frame.locator('.overlay').click();
  await expect(stage).toHaveAttribute('data-phase', 'explaining');
  // an innocent line: the duck agrees, a minute gone
  await frame.locator('.line').nth(1).click();
  await expect(stage).toHaveAttribute('data-minutes', '1');
  // the loop starts at 1: that's the bug
  await frame.locator('.line').nth(2).click();
  await expect(stage).toHaveAttribute('data-phase', 'aha');
  await frame.locator('.fix', { hasText: 'let i = 0' }).click();
  await expect(stage).toHaveAttribute('data-case', '2');
  expect(errors).toEqual([]);
});

test('Rubber Duck Therapy speaks Dutch on its own page', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/games/rubber-duck-therapy/?lang=nl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'nl');
  await expect(page.locator('.overlay .hint')).toContainText('spatie');
  expect(errors).toEqual([]);
});

test('SQL Heist runs real SQLite: an error, a solved step, and Bobby Tables', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/play/sql-heist/');
  const frame = page.frameLocator('iframe');
  const stage = frame.locator('#stage');
  await expect(stage).toHaveAttribute('data-phase', 'title', { timeout: 20_000 });
  await expect(stage).toHaveAttribute('data-sqlite', /^3\.\d/);
  await frame.locator('#overlay').click();
  const sql = frame.locator('#sql');
  await sql.fill('SELEKT * FROM vaults');
  await sql.press('Control+Enter');
  await expect(frame.locator('#status')).toContainText('syntax error');
  await sql.fill('SELECT * FROM vaults');
  await sql.press('Control+Enter');
  await expect(stage).toHaveAttribute('data-phase', 'solved');
  await expect(frame.locator('#result tbody tr')).toHaveCount(5);
  await frame.locator('#next').click();
  await sql.fill('DROP TABLE vaults;');
  await sql.press('Control+Enter');
  await expect(frame.locator('#status')).toContainText('Bobby Tables');
  expect(errors).toEqual([]);
});

test('SQL Heist speaks Dutch on its own page', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/games/sql-heist/?lang=nl');
  await expect(page.locator('#stage')).toHaveAttribute('data-phase', 'title', { timeout: 20_000 });
  await expect(page.locator('html')).toHaveAttribute('lang', 'nl');
  await expect(page.locator('#o-hint')).toContainText('in te breken');
  expect(errors).toEqual([]);
});

test('Kernel Panic Pinball runs C# in Blazor: boot, and launch a ball into the syscalls', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/play/kernel-panic-pinball/');
  const frame = page.frameLocator('iframe');
  const body = frame.locator('body');
  // Blazor renders, then pinball.js starts the loop and reports the phase on <body>
  await expect(body).toHaveAttribute('data-phase', 'title', { timeout: 30_000 });
  await page.locator('iframe').focus();
  await page.keyboard.press('Space');
  await expect(body).toHaveAttribute('data-phase', 'playing');
  await page.keyboard.down('Space');
  await page.waitForTimeout(900);
  await page.keyboard.up('Space');
  await expect(body).toHaveAttribute('data-balls', '3');
  expect(errors).toEqual([]);
});

test('Kernel Panic Pinball speaks Dutch on its own page', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/games/kernel-panic-pinball/?lang=nl');
  await expect(page.locator('body')).toHaveAttribute('data-phase', 'title', { timeout: 30_000 });
  await expect(page.locator('.overlay .hint')).toContainText('spatie');
  expect(errors).toEqual([]);
});

test('Estimate Poker runs its F# (Fable): scope creeps in, a vote reveals the real size', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/play/estimate-poker/');
  const frame = page.frameLocator('iframe');
  const stage = frame.locator('.stage');
  await expect(stage).toHaveAttribute('data-phase', 'title');
  await frame.locator('.overlay').click();
  await expect(stage).toHaveAttribute('data-phase', 'voting');
  // the first scope line creeps in after a few seconds
  await expect(frame.locator('.creep')).toHaveCount(1, { timeout: 6_000 });
  await frame.getByRole('button', { name: /^5 points/ }).click();
  await expect(stage).toHaveAttribute('data-phase', 'reveal');
  await expect(frame.locator('.votes li')).toHaveCount(3);
  await expect(stage).not.toHaveAttribute('data-score', '0');
  expect(errors).toEqual([]);
});

test('Estimate Poker speaks Dutch on its own page', async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto('/games/estimate-poker/?lang=nl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'nl');
  await expect(page.locator('.overlay .hint')).toContainText('spatie');
  expect(errors).toEqual([]);
});

test('the home page shows the planned games as coming soon, without links', async ({ page }) => {
  await page.goto('/');
  const soon = page.locator('#upcoming');
  await expect(soon.getByRole('heading', { level: 2 })).toContainText('Coming soon');
  await expect(soon.locator('article')).toHaveCount(upcoming.length);
  await expect(soon.locator('article', { hasText: 'Legacy Code Archaeology' })).toContainText('PHP (php-wasm)');
  await expect(soon.locator('a')).toHaveCount(0);
  // every built game has a card, plus the generic "next game" card
  await expect(page.locator('#games .grid > li')).toHaveCount(games.length + 1);
  await expect(page.locator('#games .next')).toBeVisible();
  await page.goto('/nl/');
  await expect(page.locator('#upcoming').getByRole('heading', { level: 2 })).toContainText('Binnenkort');
  await expect(page.locator('#upcoming article', { hasText: 'Git Blame Detective' })).toContainText('drie maanden geleden');
});

test('unknown games get the 404 page', async ({ page }) => {
  const res = await page.goto('/play/nope/');
  expect(res?.status()).toBe(404);
  await expect(page.getByText('game not found').first()).toBeVisible();
});
