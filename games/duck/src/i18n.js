/** The game's own text in English and Dutch. The hub passes the language as ?lang= and over postMessage. */
export const text = {
  en: {
    title: 'Rubber Duck Run',
    start: 'Press Space or tap to start debugging',
    over: ['Segmentation fault (duck dumped)', 'Uncaught BugError: duck is not defined', 'It worked on my machine', 'Build failed. Blame the intern.'],
    retry: '> git reset --hard  (Space or tap)',
    paused: 'Paused',
    resume: 'Click or press Space to resume',
    newBest: 'New personal best: {score} lines shipped!',
    shipped: '{score} lines shipped.',
    score: 'LOC',
    best: 'BEST',
    milestone: '{score} lines shipped'
  },
  nl: {
    title: 'Rubber Duck Run',
    start: 'Druk op spatie of tik om te beginnen met debuggen',
    over: ['Segmentation fault (duck dumped)', 'Uncaught BugError: duck is not defined', 'Het werkte op mijn machine', 'Build mislukt. Het was de stagiair.'],
    retry: '> git reset --hard  (spatie of tik)',
    paused: 'Gepauzeerd',
    resume: 'Klik of druk op spatie om verder te gaan',
    newBest: 'Nieuw record: {score} regels geshipt!',
    shipped: '{score} regels geshipt.',
    score: 'LOC',
    best: 'BEST',
    milestone: '{score} regels geshipt'
  }
};

/** @typedef {keyof typeof text} Lang */

/** @param {unknown} v @returns {v is Lang} */
export const isLang = (v) => v === 'en' || v === 'nl';

/** @param {string} s @param {Record<string, string | number>} vars */
export const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (m, k) => String(vars[k] ?? m));
