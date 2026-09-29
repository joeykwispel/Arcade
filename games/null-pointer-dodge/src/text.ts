/** Everything the game says, in English and Dutch. */
export const TEXT = {
  en: {
    time: 'time',
    score: 'score',
    grazes: 'grazes',
    best: 'best',
    shield: '?? shield',
    tagline: 'You are a tiny ?. operator. Everything falling on you is null, undefined or NaN.',
    how: 'Arrow keys or WASD to move, or drag on the screen. Brush past values for graze points. Catch a ?? for a shield. Squeeze through the gap in TypeError walls.',
    start: 'Press Space or tap to start',
    crashed: "TypeError: Cannot read properties of {killer} (reading 'you')",
    wall: 'TypeError: you walked into a TypeError',
    result: 'survived {time} s · score {score} · {grazes} grazes',
    newBest: 'New best score!',
    again: 'Press Space or tap to try again',
    paused: 'Paused',
    resume: 'Press Space or tap to go on'
  },
  nl: {
    time: 'tijd',
    score: 'score',
    grazes: 'schampt',
    best: 'record',
    shield: '??-schild',
    tagline: 'Je bent een kleine ?.-operator. Alles wat op je valt is null, undefined of NaN.',
    how: 'Pijltjes of WASD om te bewegen, of sleep over het scherm. Scheer langs waarden voor schamppunten. Vang een ?? voor een schild. Glip door het gat in TypeError-muren.',
    start: 'Druk op spatie of tik om te beginnen',
    crashed: "TypeError: Cannot read properties of {killer} (reading 'you')",
    wall: 'TypeError: je liep tegen een TypeError aan',
    result: '{time} s overleefd · score {score} · {grazes} keer geschampt',
    newBest: 'Nieuw record!',
    again: 'Druk op spatie of tik om het opnieuw te proberen',
    paused: 'Gepauzeerd',
    resume: 'Druk op spatie of tik om verder te gaan'
  }
} as const;

export type Lang = keyof typeof TEXT;

export const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
