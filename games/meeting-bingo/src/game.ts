/**
 * Meeting Bingo: the rules, without Solid or the DOM. A 5×5 card of meeting clichés; a meeting transcript plays; when
 * a phrase on your card is said, mark it. A full row, column or diagonal is bingo, and the meeting could have been
 * an email. Marking something nobody said is a false alarm. If the meeting runs over before you get bingo, you lose.
 */

export const SIZE = 5;
export const FREE = 12; // the middle square
/** How long the meeting is, in seconds of real time. */
export const MEETING = 90;
export const FALSE_ALARM = 50;

export type Lang = 'en' | 'nl';

/** Each phrase: what's on the card (short) and how it's said in the meeting (with a speaker's own words). */
export interface Phrase {
  card: Record<Lang, string>;
  said: Record<Lang, string[]>;
}

export const FREE_SQUARE: Record<Lang, string> = { en: "you're on mute", nl: 'je staat op mute' };

export const PHRASES: Phrase[] = [
  p(
    'can you see my screen?',
    'zien jullie mijn scherm?',
    ['Can everyone see my screen?', 'Wait, can you see my screen now?'],
    ['Zien jullie mijn scherm?', 'Wacht, zien jullie het nu?']
  ),
  p("let's take this offline", 'laten we dat offline doen', ["Let's take this offline."], ['Laten we dat offline bespreken.']),
  p(
    'circle back',
    'hier komen we op terug',
    ["Let's circle back to that.", "We'll circle back next week."],
    ['Daar komen we later op terug.', 'Laten we daar volgende week op terugkomen.']
  ),
  p('sorry, go ahead', 'sorry, ga jij maar', ['Oh sorry, go ahead.', 'No, you go ahead.'], ['O sorry, ga jij maar.', 'Nee, ga jij maar.']),
  p('is Dave here?', 'is Dave er al?', ['Is Dave joining?', 'Should we wait for Dave?'], ['Komt Dave ook?', 'Wachten we nog op Dave?']),
  p('quick sync', 'even snel syncen', ['This should be a quick sync.'], ['Dit wordt een snelle sync.']),
  p('low-hanging fruit', 'laaghangend fruit', ["That's low-hanging fruit."], ['Dat is laaghangend fruit.']),
  p('bandwidth', 'bandbreedte', ["I don't have the bandwidth for that."], ['Daar heb ik geen bandbreedte voor.']),
  p('can everyone hear me?', 'horen jullie me?', ['Can everyone hear me?', 'Hello? Can you hear me?'], ['Horen jullie me?', 'Hallo? Hoor je me?']),
  p('your camera is frozen', 'je beeld hangt', ['I think your camera froze.'], ['Volgens mij hangt je beeld.']),
  p('dog barking', 'blaffende hond', ['Sorry, that is my dog.'], ['Sorry, dat is mijn hond.']),
  p('next slide please', 'volgende slide', ['Next slide, please.'], ['Volgende slide graag.']),
  p('action items', 'actiepunten', ['Who takes the action items?'], ['Wie neemt de actiepunten?']),
  p('I have a hard stop', 'ik moet echt om 3 weg', ['I have a hard stop at three.'], ['Ik moet echt om drie uur weg.']),
  p('we are over time', 'we lopen uit', ['We are a bit over time.'], ['We lopen een beetje uit.']),
  p('ping me', 'ping me even', ['Just ping me later.'], ['Ping me straks even.']),
  p('touch base', 'even afstemmen', ["Let's touch base tomorrow."], ['Laten we morgen even afstemmen.']),
  p('who is taking notes?', 'wie notuleert?', ['Is someone taking notes?'], ['Notuleert iemand?']),
  p('echo on the line', 'echo op de lijn', ['There is an echo on the line.'], ['Er zit een echo op de lijn.']),
  p('let me share my screen', 'ik deel even mijn scherm', ['Let me share my screen.'], ['Ik deel even mijn scherm.']),
  p('same page', 'op één lijn', ['Just so we are all on the same page.'], ['Even zodat we allemaal op één lijn zitten.']),
  p('parking lot', 'parkeerplaats', ["Let's put that in the parking lot."], ['Die zetten we even op de parkeerplaats.']),
  p('deep dive', 'deep dive', ['We should do a deep dive on this.'], ['Hier moeten we een deep dive op doen.']),
  p('sorry, I was on mute', 'sorry, ik stond op mute', ['Sorry, I was on mute.'], ['Sorry, ik stond op mute.']),
  p('can we record this?', 'nemen we dit op?', ['Are we recording this?'], ['Nemen we dit op?']),
  p('any other business?', 'nog iets anders?', ['Any other business?'], ['Is er verder nog iets?']),
  p('ship it', 'shippen', ['Just ship it.'], ['Gewoon shippen.']),
  p('it works on my machine', 'bij mij werkt het', ['It works on my machine.'], ['Bij mij werkt het gewoon.']),
  p('let us not boil the ocean', 'niet de oceaan koken', ["Let's not boil the ocean."], ['We moeten niet de hele oceaan willen koken.']),
  p('five more minutes', 'nog vijf minuutjes', ['Can we have five more minutes?'], ['Mogen we nog vijf minuutjes?'])
];

function p(en: string, nl: string, saidEn: string[], saidNl: string[]): Phrase {
  return { card: { en, nl }, said: { en: saidEn, nl: saidNl } };
}

/** Lines nobody bingos on: filler between the clichés. */
export const FILLER: Record<Lang, string[]> = {
  en: ['Okay.', 'Right.', 'Mm-hm.', 'Good point.', 'Yeah, exactly.', 'Interesting.', 'Makes sense.', 'Let me think about that.'],
  nl: ['Oké.', 'Juist.', 'Mm-hm.', 'Goed punt.', 'Ja, precies.', 'Interessant.', 'Klinkt logisch.', 'Daar moet ik even over nadenken.']
};
export const SPEAKERS = ['Priya', 'Mark', 'Dave', 'Sanne', 'Tom', 'Lotte', 'Your manager'];

export interface Line {
  at: number;
  speaker: string;
  /** index into PHRASES, or -1 for filler */
  phrase: number;
  variant: number;
}

export interface State {
  phase: 'playing' | 'bingo' | 'overtime';
  time: number;
  /** 25 phrase indices; the middle is -1 (free) */
  card: number[];
  marked: boolean[];
  /** phrases said so far */
  said: Set<number>;
  script: Line[];
  shown: number;
  score: number;
  falseAlarms: number;
  line: number[] | null;
  rng: number;
}

function random(s: { rng: number }): number {
  let x = s.rng;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  s.rng = x >>> 0;
  return s.rng / 2 ** 32;
}

function shuffle<T>(s: { rng: number }, a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random(s) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function newGame(seed = 1): State {
  const s: State = {
    phase: 'playing',
    time: 0,
    card: [],
    marked: [],
    said: new Set(),
    script: [],
    shown: 0,
    score: 0,
    falseAlarms: 0,
    line: null,
    rng: seed >>> 0 || 1
  };
  const pick = shuffle(
    s,
    PHRASES.map((_, i) => i)
  ).slice(0, SIZE * SIZE - 1);
  s.card = [...pick.slice(0, FREE), -1, ...pick.slice(FREE)];
  s.marked = s.card.map((i) => i === -1);
  // the meeting: every card phrase gets said once, in a random order, with phrases not on the card and filler
  // between them; spread over the meeting, a bit denser towards the end
  const onCard = s.card.filter((i) => i >= 0);
  const offCard = PHRASES.map((_, i) => i).filter((i) => !onCard.includes(i));
  const lines: number[] = shuffle(s, [...onCard, ...offCard, ...Array(18).fill(-1)]);
  const gap = (MEETING - 4) / lines.length;
  let at = 2;
  s.script = lines.map((phrase) => {
    const line: Line = {
      at,
      speaker: SPEAKERS[Math.floor(random(s) * SPEAKERS.length)],
      phrase,
      variant: Math.floor(random(s) * 4)
    };
    at += gap * (0.6 + random(s) * 0.8);
    return line;
  });
  // random gaps can add up past the end: squeeze the script so the last line is said before the meeting ends
  const last = s.script[s.script.length - 1].at;
  if (last > MEETING - 4) for (const l of s.script) l.at = 2 + ((l.at - 2) * (MEETING - 6)) / (last - 2);
  return s;
}

export function text(s: State, line: Line, lang: Lang): string {
  if (line.phrase < 0) return FILLER[lang][line.variant % FILLER[lang].length];
  const said = PHRASES[line.phrase].said[lang];
  return said[line.variant % said.length];
}

export function cardText(i: number, lang: Lang): string {
  return i < 0 ? FREE_SQUARE[lang] : PHRASES[i].card[lang];
}

/** Advances the meeting. Returns the transcript lines that were just said. */
export function step(s: State, dt: number): Line[] {
  if (s.phase !== 'playing') return [];
  s.time += dt;
  const out: Line[] = [];
  while (s.shown < s.script.length && s.script[s.shown].at <= s.time) {
    const line = s.script[s.shown++];
    if (line.phrase >= 0) s.said.add(line.phrase);
    out.push(line);
  }
  if (s.time >= MEETING) s.phase = 'overtime';
  return out;
}

const LINES: number[][] = [
  ...Array.from({ length: SIZE }, (_, r) => Array.from({ length: SIZE }, (_, c) => r * SIZE + c)),
  ...Array.from({ length: SIZE }, (_, c) => Array.from({ length: SIZE }, (_, r) => r * SIZE + c)),
  Array.from({ length: SIZE }, (_, i) => i * SIZE + i),
  Array.from({ length: SIZE }, (_, i) => i * SIZE + (SIZE - 1 - i))
];

/** Marks square i. Returns 'marked', 'false-alarm' (nobody said it) or 'bingo'. */
export function mark(s: State, i: number): 'marked' | 'false-alarm' | 'bingo' | 'ignored' {
  if (s.phase !== 'playing' || s.marked[i]) return 'ignored';
  const phrase = s.card[i];
  if (!s.said.has(phrase)) {
    s.falseAlarms++;
    s.score = Math.max(0, s.score - FALSE_ALARM);
    return 'false-alarm';
  }
  s.marked[i] = true;
  // quick marks are worth more: the meeting is still dragging on
  s.score += 100 + Math.round(Math.max(0, MEETING - s.time));
  const line = LINES.find((l) => l.every((j) => s.marked[j]));
  if (line) {
    s.line = line;
    s.phase = 'bingo';
    s.score += 1000 + Math.round((MEETING - s.time) * 20);
    return 'bingo';
  }
  return 'marked';
}
