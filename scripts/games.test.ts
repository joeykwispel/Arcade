import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import games from '../games.json';

/** games.json is the only place the hub learns about games, so check every entry against the repo. */
describe('games.json', () => {
  it('has unique, URL-safe slugs', () => {
    const slugs = games.map((g) => g.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const s of slugs) expect(s).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  for (const g of games) {
    describe(g.slug, () => {
      it('has text in both languages', () => {
        for (const field of [g.title, g.description, g.controls]) {
          expect(field.en.trim()).not.toBe('');
          expect(field.nl.trim()).not.toBe('');
        }
        expect(g.framework.trim()).not.toBe('');
      });

      it('has a thumbnail in static/', () => {
        expect(g.thumbnail.startsWith('/')).toBe(true);
        expect(existsSync(`static${g.thumbnail}`)).toBe(true);
      });

      it('has a share image (npm run og)', () => {
        expect(existsSync(`static/og/${g.slug}.png`)).toBe(true);
      });

      it('is its own app with a build script', () => {
        const pkg = JSON.parse(readFileSync(`games/${g.slug}/package.json`, 'utf8'));
        expect(pkg.scripts?.build).toBeTruthy();
      });
    });
  }
});
