// Engine tests with Node's built-in runner: `npm test`. No test framework, like the game has no framework.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INVITE_SPEED, JUMP_V, MAX_SPEED, START_SPEED, createState, duckBoxes, hits, jump, makeObstacle, obstacleBox, start, update } from '../src/engine.js';
import { bug, duck, invite } from '../src/sprites.js';

const idle = { jump: false, duck: false };
/** Deterministic random numbers */
const seq = (...values) => {
  let i = 0;
  return () => values[i++ % values.length];
};
const running = () => {
  const s = createState({ worldW: 450 });
  start(s);
  s.spawnIn = Infinity; // no obstacles unless a test adds them
  return s;
};

test('sprites have straight edges', () => {
  for (const sp of [...duck.run, duck.stand, ...duck.duck, bug, ...invite]) {
    assert.ok(sp.rows.every((r) => r.length === sp.w));
  }
});

test('nothing moves before the first key press', () => {
  const s = createState({ worldW: 450 });
  update(s, 0.5, idle);
  assert.equal(s.phase, 'ready');
  assert.equal(s.distance, 0);
});

test('a jump goes up and lands again', () => {
  const s = running();
  assert.ok(jump(s));
  assert.equal(s.duck.vy, JUMP_V);
  let peak = 0;
  for (let i = 0; i < 120; i++) {
    update(s, 1 / 60, { jump: true, duck: false });
    peak = Math.max(peak, s.duck.y);
  }
  assert.ok(peak > 70, `peak ${peak}`);
  assert.equal(s.duck.y, 0);
});

test('letting go early makes a shorter hop', () => {
  const high = running();
  const low = running();
  jump(high);
  jump(low);
  let hp = 0;
  let lp = 0;
  for (let i = 0; i < 90; i++) {
    update(high, 1 / 60, { jump: true, duck: false });
    update(low, 1 / 60, idle);
    hp = Math.max(hp, high.duck.y);
    lp = Math.max(lp, low.duck.y);
  }
  assert.ok(lp < hp * 0.6, `short ${lp} vs full ${hp}`);
});

test('no double jumps', () => {
  const s = running();
  jump(s);
  update(s, 1 / 60, { jump: true, duck: false });
  assert.equal(jump(s), false);
});

test('holding down on the ground ducks, and makes the duck lower', () => {
  const s = running();
  const standTop = Math.min(...duckBoxes(s).map((b) => b.y));
  update(s, 1 / 60, { jump: false, duck: true });
  assert.ok(s.duck.ducking);
  const duckTop = Math.min(...duckBoxes(s).map((b) => b.y));
  assert.ok(duckTop > standTop + 10);
});

test('speed ramps up and is capped', () => {
  const s = running();
  update(s, 1 / 60, idle);
  assert.ok(s.speed > START_SPEED);
  for (let i = 0; i < 60 * 60 * 3; i++) update(s, 1 / 60, idle);
  assert.equal(s.speed, MAX_SPEED);
});

test('score grows with distance and flags each hundred', () => {
  const s = running();
  let milestones = 0;
  for (let i = 0; i < 60 * 25; i++) if (update(s, 1 / 60, idle) === 'milestone') milestones++;
  assert.ok(s.score > 200, `score ${s.score}`);
  assert.equal(milestones, Math.floor(s.score / 100));
});

test('running into a bug ends the run and keeps the best score', () => {
  const s = running();
  s.hi = 3;
  s.distance = 400; // score 10
  const o = makeObstacle(s, seq(0.9, 0));
  assert.equal(o.kind, 'bug');
  o.x = 40;
  s.obstacles.push(o);
  assert.equal(update(s, 1 / 60, idle), 'crash');
  assert.equal(s.phase, 'over');
  assert.equal(s.hi, 10);
  assert.ok(s.newBest);
});

test('jumping clears a single bug', () => {
  const s = running();
  const o = makeObstacle(s, seq(0.9, 0));
  o.x = 110;
  s.obstacles.push(o);
  let crashed = false;
  for (let i = 0; i < 60; i++) {
    if (i === 6) jump(s);
    if (update(s, 1 / 60, { jump: true, duck: false }) === 'crash') crashed = true;
  }
  assert.equal(crashed, false);
  assert.ok(o.x + o.w < 24, 'the bug is behind the duck');
});

test('invites only fly in once the pace picks up', () => {
  const s = running();
  assert.notEqual(makeObstacle(s, seq(0, 0)).kind, 'invite');
  s.speed = INVITE_SPEED;
  assert.equal(makeObstacle(s, seq(0, 0)).kind, 'invite');
});

test('a mid-height invite hits a standing duck but not a ducking one', () => {
  const s = running();
  s.speed = INVITE_SPEED;
  const o = makeObstacle(s, seq(0, 0.5)); // middle gap
  o.x = 30;
  assert.ok(
    duckBoxes(s).some((b) => hits(b, obstacleBox(o))),
    'standing duck is hit'
  );
  s.duck.ducking = true;
  assert.ok(!duckBoxes(s).some((b) => hits(b, obstacleBox(o))), 'ducking duck is clear');
});

test('restart keeps the best score', () => {
  const s = running();
  s.phase = 'over';
  s.hi = 99;
  start(s);
  assert.equal(s.phase, 'running');
  assert.equal(s.hi, 99);
  assert.equal(s.score, 0);
});
