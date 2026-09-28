/**
 * The rules of Infinite Scroll, without any 3D: you ride the inside wall of a tunnel, at an angle (0 = the bottom),
 * and things come at you from ahead. Positions ahead are in tunnel units; angles in radians.
 * Every obstacle is placed around a "safe" angle that you can always reach in time, so there is always a way through.
 */

export type Kind = 'block' | 'ring' | 'half' | 'spin' | 'semi' | 'shield' | 'coffee';
export type Phase = 'ready' | 'running' | 'paused' | 'over';

export interface Thing {
  id: number;
  kind: Kind;
  /** distance ahead of you; it's reached at 0 */
  z: number;
  /** center of what blocks (block, half, spin) or of the gap (ring); where a pickup sits */
  angle: number;
  /** a spinning obstacle turns this many radians per unit you travel (so where it points on arrival is exact) */
  spin: number;
  /** where the safe way through is when this reaches you */
  safe: number;
  done: boolean;
}

/** How wide each obstacle is, in radians (the ring's number is the width of its gap). */
export const SPAN = { block: 0.62, ring: 1.0, half: Math.PI, spin: 0.5 } as const;
/** How far around you count as touching something, in radians */
export const REACH = 0.12;
/** Radians per second you can turn at full steer */
export const TURN = 3.4;
export const START_SPEED = 14;
export const MAX_SPEED = 44;
/** Speed added per second of play */
export const ACCEL = 0.32;
/** How far ahead new things appear */
export const HORIZON = 110;

export const TAU = Math.PI * 2;
/** The signed shortest turn from a to b, in (-π, π]. */
export const diff = (a: number, b: number) => {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d <= -Math.PI) d += TAU;
  return d;
};
export const wrap = (a: number) => ((a % TAU) + TAU) % TAU;

export class World {
  phase: Phase = 'ready';
  angle = 0;
  speed = START_SPEED;
  distance = 0;
  bonus = 0;
  shield = false;
  /** seconds of coffee (slow motion) left */
  slow = 0;
  /** seconds you can't be hit after losing a shield */
  safeFor = 0;
  things: Thing[] = [];
  /** for the page: 'hit', 'shield', 'pickup:<kind>', 'over' */
  events: string[] = [];

  private nextAt = 30;
  private lastSafe = 0;
  private id = 0;

  constructor(private rand: () => number = Math.random) {}

  get score() {
    return Math.floor(this.distance / 2) + this.bonus;
  }

  start() {
    if (this.phase === 'ready') this.phase = 'running';
  }

  togglePause() {
    if (this.phase === 'running') this.phase = 'paused';
    else if (this.phase === 'paused') this.phase = 'running';
  }

  /** `steer` is -1 (left) to 1 (right). */
  update(dt: number, steer: number) {
    if (this.phase !== 'running') return;
    const slowed = this.slow > 0 ? 0.55 : 1;
    this.slow = Math.max(0, this.slow - dt);
    this.safeFor = Math.max(0, this.safeFor - dt);
    this.speed = Math.min(MAX_SPEED, this.speed + ACCEL * dt);
    const move = this.speed * slowed * dt;
    this.distance += move;
    this.angle = wrap(this.angle + Math.max(-1, Math.min(1, steer)) * TURN * dt);

    for (const t of this.things) {
      const before = t.z;
      t.z -= move;
      t.angle = wrap(t.angle + t.spin * move);
      // it reaches you when it crosses z = 0
      if (!t.done && before >= 0 && t.z < 0) this.reach(t);
    }
    this.things = this.things.filter((t) => t.z > -8);
    this.spawn();
  }

  /** Whether an obstacle covers `angle` right now. */
  covers(t: Thing, angle: number): boolean {
    const d = Math.abs(diff(t.angle, angle));
    switch (t.kind) {
      case 'block':
        return d < SPAN.block / 2 + REACH;
      case 'ring':
        return d > SPAN.ring / 2 - REACH;
      case 'half':
        return d < SPAN.half / 2 + REACH;
      case 'spin':
        return d < SPAN.spin / 2 + REACH || Math.abs(diff(wrap(t.angle + Math.PI), angle)) < SPAN.spin / 2 + REACH;
      default:
        return d < 0.35; // pickups are forgiving
    }
  }

  private reach(t: Thing) {
    t.done = true;
    const pickup = t.kind === 'semi' || t.kind === 'shield' || t.kind === 'coffee';
    if (!this.covers(t, this.angle)) return;
    if (pickup) {
      if (t.kind === 'semi') this.bonus += 25;
      if (t.kind === 'shield') this.shield = true;
      if (t.kind === 'coffee') this.slow = 3;
      this.events.push(`pickup:${t.kind}`);
      t.z = -99; // gone
      return;
    }
    if (this.safeFor > 0) return;
    if (this.shield) {
      this.shield = false;
      this.safeFor = 0.6;
      this.events.push('shield');
      return;
    }
    this.events.push('hit', 'over');
    this.phase = 'over';
  }

  /** Units between obstacles: roomy at first, tighter when fast. */
  private spacing() {
    return Math.max(15, 30 - (this.speed - START_SPEED) * 0.4);
  }

  private spawn() {
    while (this.distance + HORIZON >= this.nextAt) {
      const z = this.nextAt - this.distance;
      const gap = this.spacing();
      // how far you can turn between the previous obstacle and this one, with some slack
      const reach = TURN * (gap / this.speed) * 0.6;
      const safe = wrap(this.lastSafe + (this.rand() * 2 - 1) * Math.min(reach, Math.PI));
      this.add(this.pickKind(), z, safe);
      // a pickup now and then, on the safe path between two obstacles
      const roll = this.rand();
      const extra = roll < 0.04 ? 'shield' : roll < 0.08 ? 'coffee' : roll < 0.5 ? 'semi' : null;
      if (extra) this.put(extra, z - gap / 2, wrap(this.lastSafe + diff(this.lastSafe, safe) / 2), 0, safe);
      this.lastSafe = safe;
      this.nextAt += gap;
    }
  }

  private pickKind(): 'block' | 'ring' | 'half' | 'spin' {
    const d = this.distance;
    const pool: ('block' | 'ring' | 'half' | 'spin')[] = ['block', 'block'];
    if (d > 150) pool.push('ring', 'ring');
    if (d > 400) pool.push('half');
    if (d > 700) pool.push('spin');
    return pool[Math.floor(this.rand() * pool.length)];
  }

  private add(kind: 'block' | 'ring' | 'half' | 'spin', z: number, safe: number) {
    switch (kind) {
      case 'ring':
        return this.put(kind, z, safe, 0, safe);
      case 'half':
        return this.put(kind, z, wrap(safe + Math.PI), 0, safe);
      case 'block': {
        // somewhere that leaves the safe angle free
        const off = SPAN.block / 2 + REACH + 0.25 + this.rand() * (Math.PI - SPAN.block);
        return this.put(kind, z, wrap(safe + (this.rand() < 0.5 ? off : -off)), 0, safe);
      }
      case 'spin': {
        // turning bars, set so they point 90° away from the safe angle when they arrive
        const spin = (this.rand() < 0.5 ? -1 : 1) * (0.06 + this.rand() * 0.05);
        return this.put(kind, z, wrap(safe + Math.PI / 2 - spin * z), spin, safe);
      }
    }
  }

  private put(kind: Kind, z: number, angle: number, spin: number, safe: number) {
    this.things.push({ id: ++this.id, kind, z, angle, spin, safe, done: false });
  }
}
