// Kernel Panic Pinball: the animation loop and the drawing. Every frame this calls Frame() on the Blazor component
// (App.razor), which steps the C# physics and returns a flat snapshot; this draws it on the canvas. Keys and touches
// go back to C# as Hold() and Primary().
import { followHub, initialLang, loadBest, saveBest } from './host.js';

const W = 300;
const H = 520;
const PHASE = ['ready', 'playing', 'panic', 'over'];

/** @type {any} */
let app;
let layout;
let names = [];
let prev = performance.now();
let lastBest = 0;

const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Called by App.razor once it has rendered. Returns [language, best score]. */
export function start(dotnet, flatLayout, bumperNames) {
  app = dotnet;
  names = bumperNames;
  const [nWalls, nBumpers] = flatLayout;
  let i = 2;
  const walls = [];
  for (let k = 0; k < nWalls; k++, i += 4) walls.push(flatLayout.slice(i, i + 4));
  const bumpers = [];
  for (let k = 0; k < nBumpers; k++, i += 3) bumpers.push(flatLayout.slice(i, i + 3));
  const [lx, ly, rx, ry, flipperLength] = flatLayout.slice(i);
  layout = { walls, bumpers, left: [lx, ly], right: [rx, ry], flipperLength };

  followHub((lang) => app.invokeMethod('SetLang', lang));
  wireInput();
  lastBest = loadBest();
  requestAnimationFrame(frame);
  return [initialLang(), String(lastBest)];
}

function frame(now) {
  const dt = Math.min(0.05, (now - prev) / 1000);
  prev = now;
  const s = app.invokeMethod('Frame', dt);
  draw(s);
  // state for the end-to-end tests, and the best score
  const [phase, score, ballsLeft] = s;
  document.body.dataset.phase = document.querySelector('.stage')?.getAttribute('data-phase') ?? PHASE[phase];
  document.body.dataset.score = String(score);
  document.body.dataset.balls = String(ballsLeft);
  const best = app.invokeMethod('Best');
  if (best > lastBest) {
    lastBest = best;
    saveBest(best);
  }
  requestAnimationFrame(frame);
}

function draw(s) {
  const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('table'));
  if (!canvas) return;
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  const k = canvas.width / W;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.fillStyle = css('--table');
  ctx.fillRect(0, 0, W, H);

  const [, , , plunger, leftAngle, rightAngle, nBalls] = s;
  const flashes = s.slice(7, 7 + layout.bumpers.length);
  const balls = s.slice(7 + layout.bumpers.length);

  // walls
  ctx.strokeStyle = css('--wall');
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (const [x1, y1, x2, y2] of layout.walls) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // bumpers: syscalls
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  layout.bumpers.forEach(([x, y, r], i) => {
    const lit = flashes[i] > 0;
    ctx.fillStyle = lit ? css('--hit') : css('--bumper');
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = css('--accent');
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = lit ? css('--on-hit') : css('--text');
    ctx.font = `700 ${r > 16 ? 8 : 7}px "JetBrains Mono", monospace`;
    ctx.fillText(names[i], x, y);
  });

  // the plunger
  ctx.fillStyle = css('--muted');
  ctx.fillRect(270, 492 + plunger * 20, 12, 28);

  // flippers
  ctx.strokeStyle = css('--flipper');
  ctx.lineWidth = 9;
  for (const [[px, py], angle] of [
    [layout.left, leftAngle],
    [layout.right, rightAngle]
  ]) {
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + Math.cos(angle) * layout.flipperLength, py + Math.sin(angle) * layout.flipperLength);
    ctx.stroke();
  }

  // balls
  for (let b = 0; b < nBalls; b++) {
    const x = balls[b * 2];
    const y = balls[b * 2 + 1];
    ctx.fillStyle = css('--ball');
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.beginPath();
    ctx.arc(x - 2, y - 2, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ---------- input ----------

const KEYS = { ArrowLeft: 'left', a: 'left', z: 'left', ArrowRight: 'right', l: 'right', m: 'right', '/': 'right', ArrowDown: 'plunger' };

function wireInput() {
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if ([' ', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp'].includes(k)) e.preventDefault();
    if (e.repeat) return;
    const phase = document.querySelector('.stage')?.getAttribute('data-phase');
    if ((k === ' ' || k === 'Enter') && phase !== 'playing') return app.invokeMethod('Primary');
    if (k === ' ' || k === 'Enter') return app.invokeMethod('Hold', 'plunger', true);
    if (KEYS[k]) app.invokeMethod('Hold', KEYS[k], true);
  });
  window.addEventListener('keyup', (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === ' ' || k === 'Enter') app.invokeMethod('Hold', 'plunger', false);
    else if (KEYS[k]) app.invokeMethod('Hold', KEYS[k], false);
  });
  window.addEventListener('blur', () => {
    for (const what of ['left', 'right', 'plunger']) app.invokeMethod('Hold', what, false);
  });
  // the overlays are re-rendered by Blazor: listen on the document
  document.addEventListener('click', (e) => {
    if (/** @type {HTMLElement} */ (e.target).closest('[data-primary]')) app.invokeMethod('Primary');
  });
  // touch buttons: held while pressed
  document.addEventListener('pointerdown', (e) => {
    const b = /** @type {HTMLElement} */ (e.target).closest('[data-hold]');
    if (!b) return;
    e.preventDefault();
    app.invokeMethod('Hold', b.getAttribute('data-hold'), true);
    const up = () => {
      app.invokeMethod('Hold', b.getAttribute('data-hold'), false);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  });
}
