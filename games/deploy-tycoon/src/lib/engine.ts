/**
 * Deploy Tycoon's economy, with no UI: money, generators, upgrades, incidents, funding rounds, the IPO (prestige)
 * and offline earnings. The state is a plain object, so it saves to localStorage as JSON as it is.
 */

export type GenId = 'intern' | 'junior' | 'senior' | 'lead' | 'ci' | 'k8s' | 'agent' | 'datacenter';

export interface Generator {
  id: GenId;
  /** price of the first one */
  cost: number;
  /** dollars per second, each */
  rate: number;
}

export const GENERATORS: Generator[] = [
  { id: 'intern', cost: 15, rate: 0.2 },
  { id: 'junior', cost: 100, rate: 1 },
  { id: 'senior', cost: 1_100, rate: 8 },
  { id: 'lead', cost: 12_000, rate: 47 },
  { id: 'ci', cost: 130_000, rate: 260 },
  { id: 'k8s', cost: 1_400_000, rate: 1_400 },
  { id: 'agent', cost: 20_000_000, rate: 7_800 },
  { id: 'datacenter', cost: 330_000_000, rate: 44_000 }
];

/** Every next one costs 15% more. */
export const GROWTH = 1.15;

export type Effect =
  | { kind: 'gen'; gen: GenId; mult: number }
  | { kind: 'click'; mult: number }
  | { kind: 'clickShare'; share: number }
  | { kind: 'all'; bonus: number }
  | { kind: 'sre' }
  | { kind: 'chaos' };

export interface Upgrade {
  id: string;
  cost: number;
  effect: Effect;
  /** shown once you own this many of a generator (for generator upgrades), or have earned this much */
  needs: { gen: GenId; owned: number } | { earned: number };
}

/** Each generator doubles at 1, 10, 25 and 50 owned: the classic idle-game tiers. */
const TIERS = [
  { owned: 1, price: 10 },
  { owned: 10, price: 50 },
  { owned: 25, price: 500 },
  { owned: 50, price: 50_000 }
];

export const UPGRADES: Upgrade[] = [
  ...GENERATORS.flatMap((g) =>
    TIERS.map((t, i): Upgrade => ({
      id: `${g.id}-${i}`,
      cost: g.cost * t.price,
      effect: { kind: 'gen', gen: g.id, mult: 2 },
      needs: { gen: g.id, owned: t.owned }
    }))
  ),
  { id: 'keyboard', cost: 100, effect: { kind: 'click', mult: 2 }, needs: { earned: 50 } },
  { id: 'vim', cost: 5_000, effect: { kind: 'click', mult: 2 }, needs: { earned: 2_000 } },
  { id: 'copilot', cost: 50_000, effect: { kind: 'clickShare', share: 0.05 }, needs: { earned: 20_000 } },
  { id: 'monorepo', cost: 5_000_000, effect: { kind: 'clickShare', share: 0.05 }, needs: { earned: 2_000_000 } },
  { id: 'coffee', cost: 1_000, effect: { kind: 'all', bonus: 0.1 }, needs: { earned: 500 } },
  { id: 'desks', cost: 25_000, effect: { kind: 'all', bonus: 0.1 }, needs: { earned: 10_000 } },
  { id: 'remote', cost: 500_000, effect: { kind: 'all', bonus: 0.2 }, needs: { earned: 200_000 } },
  { id: 'fourday', cost: 50_000_000, effect: { kind: 'all', bonus: 0.25 }, needs: { earned: 20_000_000 } },
  { id: 'sre', cost: 10_000, effect: { kind: 'sre' }, needs: { earned: 5_000 } },
  { id: 'chaos', cost: 1_000_000, effect: { kind: 'chaos' }, needs: { earned: 500_000 } }
];

/** Funding rounds, by money earned this run. Mostly story; each makes the company look bigger. */
export const ROUNDS = [
  { id: 'garage', earned: 0 },
  { id: 'seed', earned: 1_000 },
  { id: 'seriesA', earned: 100_000 },
  { id: 'seriesB', earned: 10_000_000 },
  { id: 'seriesC', earned: 1_000_000_000 },
  { id: 'unicorn', earned: 100_000_000_000 }
] as const;
export type RoundId = (typeof ROUNDS)[number]['id'];

/** You can go public (prestige) from Series B: about an hour into a first run. */
export const IPO_AT = 10_000_000;
/** Each stock option is +2% on all income, forever. */
export const OPTION_BONUS = 0.02;
/** While prod is down, income drops to this share. */
export const INCIDENT_FACTOR = 0.2;
/** Offline: at most 8 hours, at half speed. */
export const OFFLINE_CAP = 8 * 3600;
export const OFFLINE_SHARE = 0.5;

export interface State {
  version: 1;
  money: number;
  /** earned this run (drives unlocks and funding rounds) */
  earned: number;
  /** earned over all runs (drives stock options) */
  allTime: number;
  clicks: number;
  owned: Record<GenId, number>;
  upgrades: string[];
  options: number;
  round: RoundId;
  /** seconds until the next incident, or 0 while one is going */
  nextIncident: number;
  /** seconds the current incident has lasted, or -1 */
  incident: number;
  played: number;
  /** Date.now() of the last save, for offline earnings */
  lastSeen: number;
}

const noGens = () => Object.fromEntries(GENERATORS.map((g) => [g.id, 0])) as Record<GenId, number>;

export function newState(options = 0, allTime = 0, now = Date.now()): State {
  return {
    version: 1,
    money: 0,
    earned: 0,
    allTime,
    clicks: 0,
    owned: noGens(),
    upgrades: [],
    options,
    round: 'garage',
    nextIncident: 150,
    incident: -1,
    played: 0,
    lastSeen: now
  };
}

/** A saved state from an older build or a hand-edited localStorage: fill in anything missing. */
export function revive(raw: unknown, now = Date.now()): State {
  const base = newState(0, 0, now);
  if (!raw || typeof raw !== 'object') return base;
  const s = { ...base, ...(raw as Partial<State>) };
  s.owned = { ...noGens(), ...((raw as Partial<State>).owned ?? {}) };
  s.upgrades = Array.isArray(s.upgrades) ? s.upgrades.filter((u) => UPGRADES.some((x) => x.id === u)) : [];
  for (const k of ['money', 'earned', 'allTime', 'clicks', 'options', 'nextIncident', 'incident', 'played', 'lastSeen'] as const) {
    if (!Number.isFinite(s[k])) s[k] = base[k];
  }
  return s;
}

/* ---------- numbers ---------- */

const has = (s: State, id: string) => s.upgrades.includes(id);
const effects = (s: State) => UPGRADES.filter((u) => has(s, u.id)).map((u) => u.effect);

export function genMult(s: State, id: GenId) {
  return effects(s).reduce((m, e) => (e.kind === 'gen' && e.gen === id ? m * e.mult : m), 1);
}

/** Everything that multiplies all income: perks and stock options. */
export function globalMult(s: State) {
  const perks = effects(s).reduce((b, e) => (e.kind === 'all' ? b + e.bonus : b), 0);
  return (1 + perks) * (1 + s.options * OPTION_BONUS);
}

/** Dollars per second of one generator type, all owned together. */
export function genRate(s: State, g: Generator) {
  return s.owned[g.id] * g.rate * genMult(s, g.id) * globalMult(s);
}

/** Dollars per second, before an incident. */
export function baseRate(s: State) {
  return GENERATORS.reduce((sum, g) => sum + genRate(s, g), 0);
}

export function rate(s: State) {
  return baseRate(s) * (s.incident >= 0 ? INCIDENT_FACTOR : 1);
}

export function clickValue(s: State) {
  const fx = effects(s);
  const mult = fx.reduce((m, e) => (e.kind === 'click' ? m * e.mult : m), 1);
  const share = fx.reduce((m, e) => (e.kind === 'clickShare' ? m + e.share : m), 0);
  return mult * (1 + s.options * OPTION_BONUS) + share * baseRate(s);
}

/** Price of the next `n` of a generator when you own `owned`. */
export function cost(g: Generator, owned: number, n = 1) {
  // geometric series: cost · 1.15^owned · (1.15^n − 1) / 0.15
  return Math.ceil((g.cost * GROWTH ** owned * (GROWTH ** n - 1)) / (GROWTH - 1));
}

/** How many you can buy with `money` right now. */
export function affordable(g: Generator, owned: number, money: number) {
  const first = g.cost * GROWTH ** owned;
  if (money < first) return 0;
  let n = Math.floor(Math.log((money * (GROWTH - 1)) / first + 1) / Math.log(GROWTH));
  // floating point at the edges: step to the exact answer
  while (n > 0 && cost(g, owned, n) > money) n--;
  while (cost(g, owned, n + 1) <= money) n++;
  return n;
}

export function roundFor(earned: number): RoundId {
  return [...ROUNDS].reverse().find((r) => earned >= r.earned)!.id;
}

/** Stock options an IPO would give you now (on top of what you have). */
export function optionsOnIpo(s: State) {
  // √ of all money ever earned: 3 options at $10M, 31 at $1B, 316 at $100B
  return Math.max(0, Math.floor(Math.sqrt(s.allTime / 1e6)) - s.options);
}

export const canIpo = (s: State) => s.earned >= IPO_AT && optionsOnIpo(s) > 0;

/** Generators you can see: bought before, or within reach. */
export const visibleGens = (s: State) => GENERATORS.filter((g, i) => i === 0 || s.owned[g.id] > 0 || s.earned >= g.cost * 0.5);

/** Upgrades you can see: not bought yet and their condition met, cheapest first. */
export function visibleUpgrades(s: State) {
  return UPGRADES.filter((u) => !has(s, u.id) && ('gen' in u.needs ? s.owned[u.needs.gen] >= u.needs.owned : s.earned >= u.needs.earned)).sort(
    (a, b) => a.cost - b.cost
  );
}

/* ---------- actions ---------- */

export type Event =
  { kind: 'incident' } | { kind: 'resolved'; auto: boolean } | { kind: 'round'; round: RoundId } | { kind: 'news'; bonus: number; id: number };

function earn(s: State, amount: number) {
  s.money += amount;
  s.earned += amount;
  s.allTime += amount;
}

export function push(s: State) {
  const v = clickValue(s);
  earn(s, v);
  s.clicks++;
  return v;
}

/** Buys up to `n` (Infinity for as many as you can afford). Returns how many were bought. */
export function buy(s: State, id: GenId, n: number) {
  const g = GENERATORS.find((x) => x.id === id)!;
  const count = Math.min(n, affordable(g, s.owned[id], s.money));
  if (count <= 0) return 0;
  s.money -= cost(g, s.owned[id], count);
  s.owned[id] += count;
  return count;
}

export function buyUpgrade(s: State, id: string) {
  const u = visibleUpgrades(s).find((x) => x.id === id);
  if (!u || s.money < u.cost) return false;
  s.money -= u.cost;
  s.upgrades.push(u.id);
  return true;
}

export function rollback(s: State) {
  if (s.incident < 0) return false;
  s.incident = -1;
  return true;
}

/** Goes public: a fresh company, but you keep your stock options (and gain new ones). */
export function ipo(s: State, now = Date.now()): State {
  if (!canIpo(s)) return s;
  return newState(s.options + optionsOnIpo(s), s.allTime, now);
}

/** Advances time. `rand` returns 0..1. */
export function tick(s: State, dt: number, rand: () => number = Math.random): Event[] {
  const events: Event[] = [];
  s.played += dt;
  earn(s, rate(s) * dt);

  // incidents: now and then prod goes down, until you roll back (or your SRE does)
  if (s.incident >= 0) {
    s.incident += dt;
    if (has(s, 'sre') && s.incident >= 10) {
      s.incident = -1;
      events.push({ kind: 'resolved', auto: true });
    }
  } else if (baseRate(s) > 0) {
    s.nextIncident -= dt;
    if (s.nextIncident <= 0) {
      s.incident = 0;
      s.nextIncident = (90 + rand() * 120) * (has(s, 'chaos') ? 2 : 1);
      events.push({ kind: 'incident' });
    }
  }

  // good news, about once every two minutes: a burst of income
  if (baseRate(s) > 0 && rand() < dt / 120) {
    const bonus = baseRate(s) * 30;
    earn(s, bonus);
    events.push({ kind: 'news', bonus, id: Math.floor(rand() * 1000) });
  }

  const round = roundFor(s.earned);
  if (round !== s.round) {
    s.round = round;
    events.push({ kind: 'round', round });
  }
  return events;
}

/** Money made while the tab was closed: capped, at half speed, and incidents don't count. */
export function offline(s: State, now = Date.now()) {
  const away = Math.min(OFFLINE_CAP, Math.max(0, (now - s.lastSeen) / 1000));
  s.lastSeen = now;
  if (away < 60) return { seconds: 0, earned: 0 };
  const earned = baseRate(s) * away * OFFLINE_SHARE;
  earn(s, earned);
  return { seconds: away, earned };
}

/* ---------- formatting ---------- */

const SUFFIXES = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc'];

/** $1.23M style. */
export function money(n: number) {
  if (!Number.isFinite(n)) return '∞';
  if (n < 1000) return n < 10 ? n.toFixed(1).replace(/\.0$/, '') : Math.floor(n).toString();
  const tier = Math.min(SUFFIXES.length - 1, Math.floor(Math.log10(n) / 3));
  const v = n / 1000 ** tier;
  return `${v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)}${SUFFIXES[tier]}`;
}

export function duration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}
