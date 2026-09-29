/**
 * Null Pointer Dodge: the rules, without Vue or a canvas. You are a tiny `?.` operator; null, undefined and NaN rain
 * down, TypeError walls sweep through, and a `??` shields you from one hit. Grazing a value (almost touching it)
 * scores extra. Deterministic: the same seed and inputs give the same game, so it can be tested.
 */

export const W = 480;
export const H = 300;
export const PLAYER_R = 7;
/** A value this close to you (but not touching) counts as a graze. */
export const GRAZE = 14;
export const SPEED = 190;

export type Kind = 'null' | 'undefined' | 'NaN' | 'shield';

export interface Bullet {
  kind: Kind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  grazed: boolean;
}

/** A horizontal TypeError wall with a gap you have to fit through. */
export interface Wall {
  y: number;
  vy: number;
  gapX: number;
  gapW: number;
}

export type Phase = 'playing' | 'crashed';

export interface State {
  phase: Phase;
  time: number;
  score: number;
  grazes: number;
  x: number;
  y: number;
  shield: boolean;
  bullets: Bullet[];
  walls: Wall[];
  /** what hit you, for the error message */
  killer: string;
  // spawners
  rng: number;
  nextRain: number;
  nextAimed: number;
  nextWall: number;
  nextShield: number;
}

export interface Input {
  dx: number;
  dy: number;
  /** a pointer position to glide towards instead, in world units */
  target?: { x: number; y: number } | null;
}

export function newGame(seed = 1): State {
  return {
    phase: 'playing',
    time: 0,
    score: 0,
    grazes: 0,
    x: W / 2,
    y: H - 40,
    shield: false,
    bullets: [],
    walls: [],
    killer: '',
    rng: seed >>> 0 || 1,
    nextRain: 0.4,
    nextAimed: 4,
    nextWall: 12,
    nextShield: 8
  };
}

/** xorshift32: 0 ≤ n < 1 */
function random(s: State): number {
  let x = s.rng;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  s.rng = x >>> 0;
  return s.rng / 2 ** 32;
}

/** How hard it is right now: 1 at the start, growing with time. */
export function intensity(s: State): number {
  return 1 + s.time / 25;
}

const VALUES: Kind[] = ['null', 'undefined', 'NaN'];

function spawn(s: State): void {
  const k = intensity(s);
  if (s.time >= s.nextRain) {
    // a value falls from the top
    const kind = VALUES[Math.floor(random(s) * VALUES.length)];
    s.bullets.push({ kind, x: 10 + random(s) * (W - 20), y: -10, vx: (random(s) - 0.5) * 30, vy: 60 + random(s) * 40 * k, r: 6, grazed: false });
    s.nextRain = s.time + 0.55 / k;
  }
  if (s.time >= s.nextAimed) {
    // a fan of three, thrown at you
    const ox = 20 + random(s) * (W - 40);
    const angle = Math.atan2(s.y + 10, s.x - ox);
    for (const d of [-0.18, 0, 0.18]) {
      const v = 110 + 15 * k;
      s.bullets.push({ kind: 'undefined', x: ox, y: -10, vx: Math.cos(angle + d) * v, vy: Math.sin(angle + d) * v, r: 5, grazed: false });
    }
    s.nextAimed = s.time + Math.max(1.6, 4.5 - s.time / 20);
  }
  if (s.time >= s.nextWall) {
    const gapW = Math.max(70, 130 - s.time);
    s.walls.push({ y: -12, vy: 45 + 6 * k, gapX: 20 + random(s) * (W - 40 - gapW), gapW });
    s.nextWall = s.time + Math.max(6, 14 - s.time / 10);
  }
  if (s.time >= s.nextShield) {
    s.bullets.push({ kind: 'shield', x: 30 + random(s) * (W - 60), y: -10, vx: 0, vy: 55, r: 8, grazed: false });
    s.nextShield = s.time + 14 + random(s) * 6;
  }
}

function hit(s: State, what: string): void {
  if (s.shield) {
    s.shield = false;
    return;
  }
  s.phase = 'crashed';
  s.killer = what;
}

/** Advances the game by dt seconds. Returns the events that happened, for sounds and effects. */
export function step(s: State, dt: number, input: Input): string[] {
  const events: string[] = [];
  if (s.phase !== 'playing') return events;
  s.time += dt;
  s.score += dt * 10;

  // move
  let { dx, dy } = input;
  if (input.target) {
    dx = input.target.x - s.x;
    dy = input.target.y - s.y;
    const d = Math.hypot(dx, dy);
    const max = SPEED * 1.4 * dt;
    if (d > max) {
      dx = (dx / d) * max;
      dy = (dy / d) * max;
    }
    s.x += dx;
    s.y += dy;
  } else {
    const len = Math.hypot(dx, dy) || 1;
    s.x += (dx / len) * SPEED * dt * Math.min(1, Math.hypot(dx, dy));
    s.y += (dy / len) * SPEED * dt * Math.min(1, Math.hypot(dx, dy));
  }
  s.x = Math.min(W - PLAYER_R, Math.max(PLAYER_R, s.x));
  s.y = Math.min(H - PLAYER_R, Math.max(PLAYER_R, s.y));

  spawn(s);

  for (const b of s.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    const d = Math.hypot(b.x - s.x, b.y - s.y);
    if (d < b.r + PLAYER_R) {
      if (b.kind === 'shield') {
        s.shield = true;
        events.push('shield');
      } else {
        events.push(s.shield ? 'blocked' : 'hit');
        hit(s, b.kind);
      }
      b.y = H + 100; // gone
    } else if (b.kind !== 'shield' && !b.grazed && d < b.r + PLAYER_R + GRAZE) {
      b.grazed = true;
      s.grazes++;
      s.score += 25;
      events.push('graze');
    }
  }
  s.bullets = s.bullets.filter((b) => b.y < H + 20 && b.y > -40 && b.x > -40 && b.x < W + 40);

  for (const w of s.walls) {
    const prevY = w.y;
    w.y += w.vy * dt;
    const crossing = prevY < s.y + PLAYER_R && w.y + 6 > s.y - PLAYER_R;
    const inGap = s.x - PLAYER_R > w.gapX && s.x + PLAYER_R < w.gapX + w.gapW;
    if (crossing && !inGap) {
      events.push(s.shield ? 'blocked' : 'hit');
      hit(s, 'TypeError');
      // a blocked wall breaks
      w.gapX = 0;
      w.gapW = W;
    }
  }
  s.walls = s.walls.filter((w) => w.y < H + 20);
  return events;
}
