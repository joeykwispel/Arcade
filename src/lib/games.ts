import { base } from '$app/paths';
import raw from '../../games.json';
import planned from '../../upcoming.json';
import type { Game, Upcoming } from './types';

/** Every game, in the order of games.json. Adding a game: build it in games/<slug>/, then add one entry there. */
export const games: Game[] = raw;

export const gameBySlug = (slug: string) => games.find((g) => g.slug === slug);

/** Where the game's own static build is served, and what the iframe loads. */
export const gameSrc = (g: Game) => `${base}/games/${g.slug}/`;

/** Games that are planned, shown as "coming soon" cards. When one is built it moves to games.json. */
export const upcoming: Upcoming[] = planned;
