/** The game's own text in English and Dutch. */
export type Lang = 'en' | 'nl';
export const isLang = (v: unknown): v is Lang => v === 'en' || v === 'nl';

export const text = {
  en: {
    title: 'Infinite Scroll',
    tagline: 'The feed never ends. Neither do the exceptions.',
    start: 'Press Space or tap to start scrolling',
    controls: '← → or A / D to steer. On a phone: hold the left or right side.',
    legend: '; points · { } shield · ☕ slow motion',
    paused: 'Paused',
    resume: 'Space or tap to continue',
    over: ['Uncaught exception', 'Scrolled into a 404', 'Stack trace incoming', 'Segmentation fault (cursor dumped)'],
    result: '{score} lines scrolled',
    newBest: 'New best: {score} lines!',
    retry: '> npm run scroll  (Space or tap)',
    score: 'lines',
    best: 'best',
    speed: 'speed',
    shield: 'shield',
    slow: 'slow-mo',
    sayShield: 'Shield up.',
    sayLost: 'Shield used.'
  },
  nl: {
    title: 'Infinite Scroll',
    tagline: 'De feed houdt nooit op. De exceptions ook niet.',
    start: 'Druk op spatie of tik om te beginnen met scrollen',
    controls: '← → of A / D om te sturen. Op je telefoon: houd de linker- of rechterkant vast.',
    legend: '; punten · { } schild · ☕ slow motion',
    paused: 'Gepauzeerd',
    resume: 'Spatie of tik om verder te gaan',
    over: ['Uncaught exception', 'In een 404 gescrold', 'Stack trace onderweg', 'Segmentation fault (cursor dumped)'],
    result: '{score} regels gescrold',
    newBest: 'Nieuw record: {score} regels!',
    retry: '> npm run scroll  (spatie of tik)',
    score: 'regels',
    best: 'record',
    speed: 'snelheid',
    shield: 'schild',
    slow: 'slow-mo',
    sayShield: 'Schild aan.',
    sayLost: 'Schild gebruikt.'
  }
} as const;

export const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k) => String(vars[k] ?? m));
