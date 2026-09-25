import { base } from '$app/paths';
import raw from '../../games.json';
import type { Game } from './types';

/** Every game, in the order of games.json. Adding a game: build it in games/<slug>/, then add one entry there. */
export const games: Game[] = raw;

export const gameBySlug = (slug: string) => games.find((g) => g.slug === slug);

/** Where the game's own static build is served, and what the iframe loads. */
export const gameSrc = (g: Game) => `${base}/games/${g.slug}/`;
