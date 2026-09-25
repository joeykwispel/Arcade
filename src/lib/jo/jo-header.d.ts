/** Types for jo-header.js, so TypeScript apps can import it without `allowJs`. */
export function readTheme(): 'dark' | 'light';
export function setTheme(theme: 'dark' | 'light'): void;
export function initJoHeader(root?: HTMLElement | null, options?: { onSearch?: () => void }): () => void;
