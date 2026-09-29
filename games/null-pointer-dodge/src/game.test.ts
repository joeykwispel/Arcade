import { describe, expect, it } from 'vitest';
import { H, PLAYER_R, W, intensity, newGame, step } from './game';

const still = { dx: 0, dy: 0 };

describe('Null Pointer Dodge rules', () => {
  it('moves with the keys and stays in the arena', () => {
    const s = newGame(1);
    s.bullets = [];
    s.nextRain = s.nextAimed = s.nextWall = s.nextShield = Infinity;
    const x = s.x;
    step(s, 0.1, { dx: 1, dy: 0 });
    expect(s.x).toBeGreaterThan(x);
    for (let i = 0; i < 200; i++) step(s, 0.05, { dx: -1, dy: -1 });
    expect(s.x).toBe(PLAYER_R);
    expect(s.y).toBe(PLAYER_R);
  });

  it('glides towards a pointer instead, at a capped speed', () => {
    const s = newGame(1);
    s.nextRain = s.nextAimed = s.nextWall = s.nextShield = Infinity;
    step(s, 0.1, { dx: 0, dy: 0, target: { x: 0, y: 0 } });
    expect(s.x).toBeLessThan(W / 2);
    expect(Math.hypot(W / 2 - s.x, H - 40 - s.y)).toBeLessThanOrEqual(190 * 1.4 * 0.1 + 0.001);
  });

  it('a value hitting you crashes the run, and says which one', () => {
    const s = newGame(1);
    s.nextRain = s.nextAimed = s.nextWall = s.nextShield = Infinity;
    s.bullets.push({ kind: 'null', x: s.x, y: s.y - 20, vx: 0, vy: 400, r: 6, grazed: false });
    for (let i = 0; i < 10 && s.phase === 'playing'; i++) step(s, 0.02, still);
    expect(s.phase).toBe('crashed');
    expect(s.killer).toBe('null');
  });

  it('a ?? shield absorbs exactly one hit', () => {
    const s = newGame(1);
    s.nextRain = s.nextAimed = s.nextWall = s.nextShield = Infinity;
    s.bullets.push({ kind: 'shield', x: s.x, y: s.y, vx: 0, vy: 0, r: 8, grazed: false });
    expect(step(s, 0.01, still)).toContain('shield');
    expect(s.shield).toBe(true);
    s.bullets.push({ kind: 'NaN', x: s.x, y: s.y, vx: 0, vy: 0, r: 6, grazed: false });
    expect(step(s, 0.01, still)).toContain('blocked');
    expect(s.phase).toBe('playing');
    s.bullets.push({ kind: 'NaN', x: s.x, y: s.y, vx: 0, vy: 0, r: 6, grazed: false });
    step(s, 0.01, still);
    expect(s.phase).toBe('crashed');
  });

  it('a near miss is a graze, worth points, counted once', () => {
    const s = newGame(1);
    s.nextRain = s.nextAimed = s.nextWall = s.nextShield = Infinity;
    s.bullets.push({ kind: 'undefined', x: s.x + PLAYER_R + 6 + 8, y: s.y - 30, vx: 0, vy: 300, r: 6, grazed: false });
    for (let i = 0; i < 20; i++) step(s, 0.01, still);
    expect(s.phase).toBe('playing');
    expect(s.grazes).toBe(1);
    expect(s.score).toBeGreaterThan(25);
  });

  it('a TypeError wall crashes you unless you are in its gap', () => {
    for (const inGap of [true, false]) {
      const s = newGame(1);
      s.nextRain = s.nextAimed = s.nextWall = s.nextShield = Infinity;
      s.walls.push({ y: s.y - 40, vy: 200, gapX: inGap ? s.x - 40 : s.x + 60, gapW: 80 });
      for (let i = 0; i < 40; i++) step(s, 0.01, still);
      expect(s.phase).toBe(inGap ? 'playing' : 'crashed');
      if (!inGap) expect(s.killer).toBe('TypeError');
    }
  });

  it('gets harder over time, and the same seed plays the same game', () => {
    const a = newGame(42);
    const b = newGame(42);
    const early = intensity(a);
    for (let i = 0; i < 600; i++) {
      step(a, 1 / 60, still);
      step(b, 1 / 60, still);
    }
    expect(intensity(a)).toBeGreaterThan(early);
    expect(a.bullets.map((x) => [x.x, x.y])).toEqual(b.bullets.map((x) => [x.x, x.y]));
    expect(a.phase).toBe(b.phase);
  });

  it('standing still in the middle does not survive forever', () => {
    const s = newGame(7);
    for (let i = 0; i < 60 * 180 && s.phase === 'playing'; i++) step(s, 1 / 60, still);
    expect(s.phase).toBe('crashed');
  });
});
