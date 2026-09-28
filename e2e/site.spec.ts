import { expect, test, type Page } from '@playwright/test';

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
  await page.goto('/games/infinite-scroll/?lang=nl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'nl');
  await expect(page.locator('#hint')).toContainText('spatie');
  await page.keyboard.press('Space');
  // never steering, something hits you soon enough
  await expect(page.locator('#stage')).toHaveAttribute('data-phase', 'over', { timeout: 30_000 });
  await expect(page.locator('#hint')).toContainText('npm run scroll');
  const best = await page.evaluate(() => Number(localStorage.getItem('play:infinite-scroll:best')));
  expect(best).toBeGreaterThan(0);
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

test('unknown games get the 404 page', async ({ page }) => {
  const res = await page.goto('/play/nope/');
  expect(res?.status()).toBe(404);
  await expect(page.getByText('game not found').first()).toBeVisible();
});
