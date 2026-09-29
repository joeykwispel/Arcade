declare module './host.js' {
  export function initialLang(): 'en' | 'nl';
  export function loadBest(): number;
  export function saveBest(n: number): void;
  export function followHub(onLang: (lang: 'en' | 'nl') => void): void;
}
