/** Draws a game state onto a canvas. Reads nothing from the DOM except the colors passed in. */
import { DUCK_X, PX, duckSize } from './engine.js';
import { bug, duck as duckSprites, invite } from './sprites.js';

/**
 * @typedef {Record<string, string>} Colors  theme colors by name, from the CSS custom properties
 * @typedef {import('./engine.js').State} State
 * @typedef {import('./sprites.js').Sprite} Sprite
 */

const MONO = "'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

/** @param {Colors} c */
const palette = (c) => ({
  '#': c.duck,
  o: c.beak,
  '+': c.wing,
  k: c.ink,
  e: c.eye,
  b: c.bug,
  s: c.bugStripe,
  p: c.paper,
  r: c.badge,
  w: c.muted
});

/**
 * Each sprite is painted once at one canvas pixel per sprite pixel, then scaled up with smoothing off.
 * Drawing every pixel as its own rectangle leaves hairline seams at fractional scales.
 * @type {WeakMap<Sprite, { key: string, canvas: HTMLCanvasElement }>}
 */
const cache = new WeakMap();

/** @param {Sprite} sp @param {Record<string,string>} pal */
function bitmap(sp, pal) {
  const key = Object.values(pal).join();
  const hit = cache.get(sp);
  if (hit?.key === key) return hit.canvas;
  const canvas = document.createElement('canvas');
  canvas.width = sp.w;
  canvas.height = sp.h;
  const c = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  sp.rows.forEach((row, y) => {
    for (let x = 0; x < sp.w; x++) {
      if (row[x] === '.') continue;
      c.fillStyle = pal[row[x]];
      c.fillRect(x, y, 1, 1);
    }
  });
  cache.set(sp, { key, canvas });
  return canvas;
}

/** @param {CanvasRenderingContext2D} ctx @param {Sprite} sp @param {number} x @param {number} y @param {number} px @param {Record<string,string>} pal */
function drawSprite(ctx, sp, x, y, px, pal) {
  // Snap to whole world units so the pixels stay crisp while scrolling.
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bitmap(sp, pal), Math.round(x), Math.round(y), sp.w * px, sp.h * px);
}

const pad = (n) => String(n).padStart(5, '0');

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {State} s
 * @param {Colors} colors
 * @param {{ score: string, best: string }} labels
 */
export function render(ctx, s, colors, labels) {
  const pal = palette(colors);
  ctx.clearRect(0, 0, s.worldW, s.worldH);

  // Code "clouds" drifting in the background
  ctx.font = `500 9px ${MONO}`;
  ctx.textBaseline = 'top';
  ctx.fillStyle = colors.cloud;
  for (const c of s.clouds) ctx.fillText(c.text, Math.round(c.x), Math.round(c.y));

  // Ground: a line with a scrolling texture of dots and dashes
  ctx.fillStyle = colors.ground;
  ctx.fillRect(0, s.groundY - 1, s.worldW, 1);
  const off = s.distance % 40;
  for (let x = -off; x < s.worldW; x += 40) {
    ctx.fillRect(Math.round(x + 6), s.groundY + 4, 3, 1);
    ctx.fillRect(Math.round(x + 25), s.groundY + 8, 1, 1);
    ctx.fillRect(Math.round(x + 33), s.groundY + 3, 2, 1);
  }

  for (const o of s.obstacles) {
    if (o.kind === 'invite') {
      const frame = invite[Math.floor(s.time * 6) % 2];
      drawSprite(ctx, frame, o.x, o.y, o.px, pal);
      ctx.font = `600 7px ${MONO}`;
      ctx.fillStyle = colors.muted;
      ctx.fillText('quick sync?', Math.round(o.x + o.w + 3), Math.round(o.y + 11));
    } else if (o.kind === 'conflict') {
      drawConflict(ctx, o, colors);
    } else {
      for (let i = 0; i < o.count; i++) drawSprite(ctx, bug, o.x + i * (bug.w * o.px + 2), o.y, o.px, pal);
    }
  }

  drawDuck(ctx, s, colors, pal);

  // Score, top right: best first, like the original
  ctx.font = `700 10px ${MONO}`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'right';
  const blink = s.flash > 0 && Math.floor(s.flash * 8) % 2 === 0;
  ctx.fillStyle = colors.accent;
  if (!blink) ctx.fillText(`${labels.score} ${pad(s.score)}`, s.worldW - 10, 10);
  ctx.fillStyle = colors.muted;
  const scoreW = ctx.measureText(`${labels.score} ${pad(s.score)}`).width;
  if (s.hi > 0) ctx.fillText(`${labels.best} ${pad(s.hi)}`, s.worldW - 22 - scoreW, 10);
  ctx.textAlign = 'left';
}

/** @param {CanvasRenderingContext2D} ctx @param {State} s @param {Colors} colors @param {Record<string,string>} pal */
function drawDuck(ctx, s, colors, pal) {
  const { h } = duckSize(s);
  const y = s.groundY - s.duck.y - h;
  const step = Math.floor(s.time * 12) % 2;
  let sp;
  if (s.phase === 'ready' || s.phase === 'over' || s.duck.y > 0) sp = duckSprites.stand;
  else if (s.duck.ducking) sp = duckSprites.duck[step];
  else sp = duckSprites.run[step];
  drawSprite(ctx, sp, DUCK_X, y, PX, pal);

  if (s.phase === 'over') {
    // Crossed-out eye: the duck has been dumped
    const eye = s.duck.ducking ? { x: 17, y: 2 } : { x: 12, y: 2 };
    const ex = Math.round(DUCK_X + eye.x * PX);
    const ey = Math.round(y + eye.y * PX);
    ctx.fillStyle = colors.duck;
    ctx.fillRect(ex - 2, ey - 2, 6, 6);
    ctx.strokeStyle = colors.eye;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(ex - 1.5, ey - 1.5);
    ctx.lineTo(ex + 3.5, ey + 3.5);
    ctx.moveTo(ex + 3.5, ey - 1.5);
    ctx.lineTo(ex - 1.5, ey + 3.5);
    ctx.stroke();
  }
}

/** A merge conflict: the three markers, stacked in a box. @param {CanvasRenderingContext2D} ctx @param {import('./engine.js').Obstacle} o @param {Colors} colors */
function drawConflict(ctx, o, colors) {
  const x = Math.round(o.x);
  const y = Math.round(o.y);
  ctx.fillStyle = colors.conflictBg;
  ctx.fillRect(x, y, o.w, o.h);
  ctx.strokeStyle = colors.bug;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, o.w - 1, o.h - 1);
  ctx.font = `700 7.5px ${MONO}`;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  const cx = x + o.w / 2;
  ctx.fillStyle = colors.bug;
  ctx.fillText('<<<<<<<', cx, y + 5);
  ctx.fillStyle = colors.muted;
  ctx.fillText('=======', cx, y + 16);
  ctx.fillStyle = colors.accent2;
  ctx.fillText('>>>>>>>', cx, y + 27);
  ctx.textAlign = 'left';
}
