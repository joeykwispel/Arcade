import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';

const games: { slug: string }[] = JSON.parse(readFileSync(new URL('../games.json', import.meta.url), 'utf8'));

const pages = ['/', '/nl/', ...games.flatMap((g) => [`/play/${g.slug}/`, `/nl/play/${g.slug}/`])];

for (const theme of ['dark', 'light'] as const) {
  for (const path of pages) {
    test(`${path} has no serious accessibility issues (${theme})`, async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem('theme', t), theme);
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto(path);
      // let reveal animations finish so contrast is measured on the final colors
      await page.waitForTimeout(1000);
      const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
      const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    });
  }
}
