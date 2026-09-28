import { describe, expect, it } from 'vitest';
import { MAX_SPEED, START_SPEED, TURN, World, diff, wrap, type Thing } from './world';

/** Deterministic random numbers (mulberry32) */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const DT = 1 / 60;
const running = (seed = 1) => {
  const w = new World(seeded(seed));
  w.start();
  return w;
};
const obstacle = (w: World, kind: Thing['kind'], angle: number, z = 0.5): Thing => {
  const t: Thing = { id: 999, kind, z, angle, spin: 0, safe: 0, done: false };
  w.things = [t];
  return t;
};

/** Steers toward the safe angle of the next obstacle, like a player who reads the tunnel. */
function follow(w: World) {
  const next = w.things.filter((t) => !t.done && t.z > 0 && !['semi', 'shield', 'coffee'].includes(t.kind)).sort((a, b) => a.z - b.z)[0];
  if (!next) return 0;
  const d = diff(w.angle, next.safe);
  return Math.abs(d) < 0.02 ? 0 : Math.sign(d) * Math.min(1, Math.abs(d) / (TURN * DT));
}

describe('world', () => {
  it('waits for the start', () => {
    const w = new World(seeded(1));
    w.update(1, 1);
    expect(w.distance).toBe(0);
    expect(w.angle).toBe(0);
  });

  it('wraps and compares angles the short way round', () => {
    expect(diff(0.1, wrap(-0.1))).toBeCloseTo(-0.2);
    expect(diff(3, -3)).toBeCloseTo(2 * Math.PI - 6);
  });

  it('ends the run when a block reaches you, unless you have a shield', () => {
    const w = running();
    obstacle(w, 'block', 0);
    w.update(0.1, 0);
    expect(w.phase).toBe('over');

    const s = running();
    s.shield = true;
    obstacle(s, 'block', 0);
    s.update(0.1, 0);
    expect(s.phase).toBe('running');
    expect(s.shield).toBe(false);
    expect(s.events).toContain('shield');
  });

  it('lets you through the gap of a 404 ring, and nowhere else', () => {
    const through = running();
    obstacle(through, 'ring', 0);
    through.update(0.1, 0);
    expect(through.phase).toBe('running');
    const beside = running();
    obstacle(beside, 'ring', Math.PI / 2);
    beside.update(0.1, 0);
    expect(beside.phase).toBe('over');
  });

  it('picks things up for points, a shield or slow motion', () => {
    const w = running();
    obstacle(w, 'semi', 0);
    w.update(0.1, 0);
    expect(w.bonus).toBe(25);
    obstacle(w, 'coffee', w.angle);
    w.update(0.1, 0);
    expect(w.slow).toBeGreaterThan(2.5);
  });

  it('speeds up over time, up to a limit', () => {
    const w = running();
    w.things = [];
    for (let i = 0; i < 60; i++) {
      w.update(1, 0);
      if (w.phase === 'over') break;
    }
    expect(w.speed).toBeGreaterThan(START_SPEED);
    expect(w.speed).toBeLessThanOrEqual(MAX_SPEED);
  });

  it('points spinning bars away from the safe angle when they arrive', () => {
    const w = running(3);
    let checked = 0;
    for (let i = 0; i < 60 * 240 && w.phase === 'running'; i++) {
      for (const t of w.things) {
        if (t.kind === 'spin' && !t.done && t.z < 0.6 && t.z > 0) {
          expect(Math.abs(Math.abs(diff(t.angle, t.safe)) - Math.PI / 2)).toBeLessThan(0.1);
          checked++;
        }
      }
      w.update(DT, follow(w));
    }
    expect(checked).toBeGreaterThan(0);
  });

  it('always leaves a way through: a player who follows it never crashes', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const w = running(seed);
      for (let i = 0; i < 60 * 300 && w.phase === 'running'; i++) w.update(DT, follow(w));
      expect(w.phase, `seed ${seed} crashed at ${Math.round(w.distance)}`).toBe('running');
      expect(w.speed).toBe(MAX_SPEED);
    }
  });

  it('does end a run that never steers', () => {
    const w = running(1);
    for (let i = 0; i < 60 * 300 && w.phase === 'running'; i++) w.update(DT, 0);
    expect(w.phase).toBe('over');
  });
});
