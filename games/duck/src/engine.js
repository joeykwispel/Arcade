/**
 * The game rules, with no DOM: physics, spawning, scoring and collisions.
 * Everything is in world units: the world is 150 units tall and as wide as the screen allows.
 * Times are in seconds, speeds in units per second.
 */
import { bug, duck as duckSprites, invite, inviteBody } from './sprites.js';

/** World units per sprite pixel */
export const PX = 2;
export const WORLD_H = 150;
export const GROUND_MARGIN = 20;
export const DUCK_X = 24;
export const START_SPEED = 360;
export const MAX_SPEED = 820;
/** Speed gained per second */
export const ACCEL = 7;
export const GRAVITY = 2200;
export const JUMP_V = 620;
/** Letting go of jump early caps the upward speed at this, for a short hop. */
export const SHORT_HOP_V = 300;
/** Holding down in the air pulls the duck down this many times faster. */
export const FAST_DROP = 3;
/** Invites only show up once the pace picks up. */
export const INVITE_SPEED = 450;
/** Score per unit run, like the original (about 10 points a second at the start). */
export const SCORE_RATE = 0.025;
/** Gaps between the ground and the bottom of an invite: jump it, duck it, or ignore it. */
export const INVITE_GAPS = [4, 26, 46];

const CLOUD_TEXT = ['{ }', '</>', '=>', '// TODO', ';', '[ ]', '&&', 'npm i', '!==', 'git push -f', '0 == "0"', 'console.log'];

/**
 * @typedef {{ x: number, y: number, w: number, h: number }} Box
 * @typedef {'bug' | 'bigbug' | 'conflict' | 'invite'} Kind
 * @typedef {{ kind: Kind, x: number, y: number, w: number, h: number, px: number, count: number, hit: Box, extra: number }} Obstacle
 * @typedef {{ x: number, y: number, text: string }} Cloud
 * @typedef {{ jump: boolean, duck: boolean }} Input
 * @typedef {ReturnType<typeof createState>} State
 */

/** @param {{ worldW: number, worldH?: number, hi?: number }} opts */
export function createState({ worldW, worldH = WORLD_H, hi = 0 }) {
  return {
    /** @type {'ready' | 'running' | 'paused' | 'over'} */
    phase: 'ready',
    worldW,
    worldH,
    groundY: worldH - GROUND_MARGIN,
    speed: START_SPEED,
    distance: 0,
    score: 0,
    hi,
    newBest: false,
    /** Seconds left of the milestone flash on the score */
    flash: 0,
    /** Seconds since the run started, for animations */
    time: 0,
    /** Seconds since the run ended, so a held key doesn't restart at once */
    overFor: 0,
    duck: { y: 0, vy: 0, ducking: false },
    /** @type {Obstacle[]} */
    obstacles: [],
    spawnIn: 320,
    /** @type {Cloud[]} */
    clouds: []
  };
}

/** @param {State} s @param {number} worldW @param {number} worldH */
export function resize(s, worldW, worldH) {
  const dy = worldH - GROUND_MARGIN - s.groundY;
  s.worldW = worldW;
  s.worldH = worldH;
  s.groundY = worldH - GROUND_MARGIN;
  for (const o of s.obstacles) o.y += dy;
  for (const c of s.clouds) c.y += dy;
}

/** Starts a fresh run, keeping the high score and the size. @param {State} s */
export function start(s) {
  Object.assign(s, createState({ worldW: s.worldW, worldH: s.worldH, hi: s.hi }), { phase: 'running', clouds: s.clouds });
}

export const onGround = (/** @type {State} */ s) => s.duck.y <= 0;

/** @param {State} s */
export function jump(s) {
  if (s.phase !== 'running' || !onGround(s)) return false;
  s.duck.vy = JUMP_V;
  s.duck.ducking = false;
  return true;
}

/** @param {Box} a @param {Box} b */
export const hits = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/** The duck's sprite size in world units. @param {State} s */
export function duckSize(s) {
  const sp = s.duck.ducking ? duckSprites.duck[0] : duckSprites.stand;
  return { w: sp.w * PX, h: sp.h * PX };
}

/** The duck's hitboxes in world coordinates: a few boxes that follow the shape, so near misses count. @param {State} s */
export function duckBoxes(s) {
  const { h } = duckSize(s);
  const x = DUCK_X;
  const y = s.groundY - s.duck.y - h;
  const rel = s.duck.ducking
    ? [
        { x: 2, y: 4, w: 38, h: 12 },
        { x: 30, y: 0, w: 12, h: 8 }
      ]
    : [
        { x: 18, y: 0, w: 16, h: 12 },
        { x: 2, y: 12, w: 30, h: 16 },
        { x: 10, y: 28, w: 12, h: 6 }
      ];
  return rel.map((b) => ({ x: x + b.x, y: y + b.y, w: b.w, h: b.h }));
}

/** @param {Obstacle} o */
export const obstacleBox = (o) => ({ x: o.x + o.hit.x, y: o.y + o.hit.y, w: o.hit.w, h: o.hit.h });

/**
 * A new obstacle just off the right edge.
 * @param {State} s @param {() => number} rng
 * @returns {Obstacle}
 */
export function makeObstacle(s, rng) {
  const x = s.worldW + 10;
  if (s.speed >= INVITE_SPEED && rng() < 0.25) {
    const w = invite[0].w * PX;
    const h = invite[0].h * PX;
    const gap = INVITE_GAPS[Math.floor(rng() * INVITE_GAPS.length)];
    const bodyBottom = (inviteBody.top + inviteBody.height) * PX;
    const hit = { x: 2, y: inviteBody.top * PX + 2, w: w - 4, h: inviteBody.height * PX - 4 };
    // invites fly a little faster than the ground scrolls
    return { kind: 'invite', x, y: s.groundY - gap - bodyBottom, w, h, px: PX, count: 1, hit, extra: 40 };
  }
  const r = rng();
  if (r < 0.2 && s.score > 40) {
    const w = 46;
    const h = 40;
    return { kind: 'conflict', x, y: s.groundY - h, w, h, px: PX, count: 1, hit: { x: 2, y: 2, w: w - 4, h: h - 2 }, extra: 0 };
  }
  const big = r < 0.45;
  const px = big ? 3 : PX;
  const maxCount = big ? 2 : s.speed > 520 ? 3 : 2;
  const count = 1 + Math.floor(rng() * maxCount);
  const gap = 2;
  const w = count * bug.w * px + (count - 1) * gap;
  const h = bug.h * px;
  return { kind: big ? 'bigbug' : 'bug', x, y: s.groundY - h, w, h, px, count, hit: { x: 3, y: px * 2, w: w - 6, h: h - px * 2 }, extra: 0 };
}

/** Distance to the next obstacle: longer at speed, so there is always room to land. @param {State} s @param {Obstacle} o @param {() => number} rng */
export const nextGap = (s, o, rng) => o.w + s.speed * (0.65 + rng() * 0.6) + 110;

/** @param {State} s @param {() => number} rng */
function driftClouds(s, dx, rng) {
  if (!s.clouds.length) {
    for (let i = 0; i < 4; i++) s.clouds.push(makeCloud(s, rng, rng() * s.worldW));
  }
  for (const c of s.clouds) c.x -= dx;
  s.clouds = s.clouds.filter((c) => c.x > -120);
  while (s.clouds.length < 4) s.clouds.push(makeCloud(s, rng, s.worldW + rng() * 200));
}

/** @param {State} s @param {() => number} rng @param {number} x @returns {Cloud} */
function makeCloud(s, rng, x) {
  const skyTop = 30;
  const skyBottom = s.groundY - 60;
  return { x, y: skyTop + rng() * Math.max(10, skyBottom - skyTop), text: CLOUD_TEXT[Math.floor(rng() * CLOUD_TEXT.length)] };
}

/**
 * Advances the game by dt seconds.
 * @param {State} s @param {number} dt @param {Input} input @param {() => number} [rng]
 * @returns {'crash' | 'milestone' | null} what happened, for sounds or announcements
 */
export function update(s, dt, input, rng = Math.random) {
  dt = Math.min(dt, 1 / 20); // a hidden tab or a slow frame must not teleport the duck through a bug
  if (s.phase === 'over') s.overFor += dt;
  if (s.phase !== 'running') {
    driftClouds(s, (s.phase === 'ready' ? 12 : 0) * dt, rng);
    return null;
  }

  s.time += dt;
  s.speed = Math.min(MAX_SPEED, s.speed + ACCEL * dt);
  const dx = s.speed * dt;
  s.distance += dx;
  const before = s.score;
  s.score = Math.floor(s.distance * SCORE_RATE);
  s.flash = Math.max(0, s.flash - dt);
  let event = null;
  if (Math.floor(s.score / 100) > Math.floor(before / 100)) {
    s.flash = 1.2;
    event = 'milestone';
  }

  // Duck physics: y is the height above the ground, up is positive.
  const d = s.duck;
  if (!onGround(s) || d.vy > 0) {
    if (!input.jump && d.vy > SHORT_HOP_V) d.vy = SHORT_HOP_V;
    d.vy -= GRAVITY * (input.duck ? FAST_DROP : 1) * dt;
    d.y += d.vy * dt;
    if (d.y <= 0) {
      d.y = 0;
      d.vy = 0;
    }
  }
  d.ducking = input.duck && onGround(s);

  // Obstacles scroll left; new ones arrive at the right edge.
  for (const o of s.obstacles) o.x -= dx + o.extra * dt;
  s.obstacles = s.obstacles.filter((o) => o.x + o.w > -20);
  s.spawnIn -= dx;
  if (s.spawnIn <= 0) {
    const o = makeObstacle(s, rng);
    s.obstacles.push(o);
    s.spawnIn = nextGap(s, o, rng);
  }

  driftClouds(s, dx * 0.2, rng);

  const boxes = duckBoxes(s);
  if (s.obstacles.some((o) => boxes.some((b) => hits(b, obstacleBox(o))))) {
    s.phase = 'over';
    s.overFor = 0;
    s.newBest = s.score > s.hi;
    s.hi = Math.max(s.hi, s.score);
    return 'crash';
  }
  return event;
}
