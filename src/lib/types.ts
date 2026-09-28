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
  /** CSS aspect-ratio of the game frame on wide screens, e.g. "3 / 1". */
  aspect?: string;
  /** Aspect ratio on phones (up to 640px wide). Defaults to "4 / 3"; a game with a lot of UI can ask for a taller frame. */
  phoneAspect?: string;
  /** Where the game's build ends up, relative to its folder. Defaults to "dist". */
  outDir?: string;
}

/** One entry in upcoming.json: a game that is planned but not built yet. */
export interface Upcoming {
  slug: string;
  /** A short piece of code shown big on the card, instead of a thumbnail */
  icon: string;
  title: Localized;
  /** Two or three words, e.g. "arcade · snake" */
  genre: Localized;
  description: Localized;
  /** The stack it will be built with */
  framework: string;
}

/** A link in the header menu. */
export interface HeaderLink {
  label: string;
  href: string;
  current?: boolean;
}
