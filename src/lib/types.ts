export type Locale = 'en' | 'nl';

/** Text in both languages. */
export type Localized = Record<Locale, string>;

/** One entry in games.json. */
export interface Game {
  /** Folder under games/ and the URL segment in /play/<slug>/ and /games/<slug>/ */
  slug: string;
  title: Localized;
  /** One line for the card */
  description: Localized;
  /** What the game is built with, e.g. "Vanilla JS + Canvas" */
  framework: string;
  /** Build tool, e.g. "esbuild" or "Vite" */
  tooling?: string;
  /** Site-absolute path of the card icon, in static/ (a one-color SVG; it is tinted with the brand gradient) */
  thumbnail: string;
  /** How to play, shown under the game */
  controls?: Localized;
  /** CSS aspect-ratio of the game frame on wide screens, e.g. "3 / 1". Phones always get a taller frame. */
  aspect?: string;
  /** Where the game's build ends up, relative to its folder. Defaults to "dist". */
  outDir?: string;
}

/** A link in the header menu. */
export interface HeaderLink {
  label: string;
  href: string;
  current?: boolean;
}
