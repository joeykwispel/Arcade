<script setup lang="ts">
/**
 * The whole screen: a canvas for the arena, Vue for the HUD and the overlays. The rules (game.ts) run in a
 * requestAnimationFrame loop; Vue only re-renders the few numbers that change.
 */
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { H, PLAYER_R, W, newGame, step, type State } from './game';
import { followHub, initialLang, loadBest, saveBest } from './host.js';
import { TEXT, fill, type Lang } from './text';

type Mode = 'title' | 'playing' | 'paused' | 'crashed';

const lang = ref<Lang>(initialLang());
const t = computed(() => TEXT[lang.value]);
const mode = ref<Mode>('title');
const best = ref(loadBest());
const newBest = ref(false);
const canvas = ref<HTMLCanvasElement | null>(null);
const game = shallowRef<State>(newGame(1));
// what the HUD shows, updated a few times a second
const hud = ref({ time: 0, score: 0, grazes: 0, shield: false });
const flash = ref('');

const keys = new Set<string>();
let pointer: { x: number; y: number } | null = null;
let raf = 0;
let prev = 0;
let flashTime = 0;

function start() {
  game.value = newGame((Date.now() % 2 ** 31) | 1);
  mode.value = 'playing';
  newBest.value = false;
  keys.clear();
  pointer = null;
}

function primary() {
  if (mode.value === 'title' || mode.value === 'crashed') start();
  else if (mode.value === 'paused') mode.value = 'playing';
}

const crashMessage = computed(() => {
  const k = game.value.killer;
  return k === 'TypeError' ? t.value.wall : fill(t.value.crashed, { killer: k });
});

function css(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function draw() {
  const cv = canvas.value;
  if (!cv) return;
  const ctx = cv.getContext('2d')!;
  const s = game.value;
  const k = cv.width / W;
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.fillStyle = css('--arena');
  ctx.fillRect(0, 0, W, H);
  // a faint grid, like a debugger's memory view
  ctx.strokeStyle = css('--grid');
  ctx.lineWidth = 1 / k;
  for (let x = 0; x <= W; x += 24) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const w of s.walls) {
    ctx.fillStyle = css('--danger');
    ctx.fillRect(0, w.y, w.gapX, 6);
    ctx.fillRect(w.gapX + w.gapW, w.y, W - w.gapX - w.gapW, 6);
    ctx.font = '600 7px "JetBrains Mono Variable", monospace';
    ctx.fillStyle = css('--danger');
    if (w.gapX > 60) ctx.fillText('TypeError', w.gapX / 2, w.y - 6);
    else if (W - w.gapX - w.gapW > 60) ctx.fillText('TypeError', (w.gapX + w.gapW + W) / 2, w.y - 6);
  }

  for (const b of s.bullets) {
    const colour = b.kind === 'null' ? css('--null') : b.kind === 'undefined' ? css('--undefined') : b.kind === 'NaN' ? css('--nan') : css('--accent');
    ctx.fillStyle = colour;
    ctx.globalAlpha = 0.2;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r + 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css('--text');
    ctx.font = '600 7px "JetBrains Mono Variable", monospace';
    const label = b.kind === 'shield' ? '??' : b.kind === 'undefined' ? 'undef' : b.kind;
    ctx.fillText(label, b.x, b.y - b.r - 6);
  }

  // you
  if (s.phase === 'playing' || Math.floor(performance.now() / 120) % 2) {
    if (s.shield) {
      ctx.strokeStyle = css('--accent');
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, PLAYER_R + 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = css('--player');
    ctx.beginPath();
    ctx.arc(s.x, s.y, PLAYER_R, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = css('--on-player');
    ctx.font = '800 9px "JetBrains Mono Variable", monospace';
    ctx.fillText('?.', s.x, s.y + 0.5);
  }
}

function loop(now: number) {
  const dt = Math.min(0.05, (now - prev) / 1000 || 0);
  prev = now;
  const s = game.value;
  if (mode.value === 'playing') {
    const dx = (keys.has('ArrowRight') || keys.has('d') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('a') ? 1 : 0);
    const dy = (keys.has('ArrowDown') || keys.has('s') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('w') ? 1 : 0);
    const events = step(s, dt, { dx, dy, target: dx || dy ? null : pointer });
    if (events.includes('graze')) showFlash('graze +25');
    if (events.includes('shield')) showFlash('?? shield');
    if (events.includes('blocked')) showFlash('?? caught it');
    if (s.phase === 'crashed') {
      mode.value = 'crashed';
      if (Math.floor(s.score) > best.value) {
        best.value = Math.floor(s.score);
        newBest.value = true;
        saveBest(best.value);
      }
    }
    hud.value = { time: Math.floor(s.time), score: Math.floor(s.score), grazes: s.grazes, shield: s.shield };
  }
  flashTime = Math.max(0, flashTime - dt);
  if (!flashTime) flash.value = '';
  draw();
  raf = requestAnimationFrame(loop);
}

function showFlash(text: string) {
  flash.value = text;
  flashTime = 0.8;
}

function onKey(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (e.type === 'keyup') {
    keys.delete(k);
    return;
  }
  if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
  if (k === ' ' || k === 'Enter') {
    if (!e.repeat) primary();
    return;
  }
  if ((k === 'p' || k === 'Escape') && mode.value === 'playing') {
    mode.value = 'paused';
    return;
  }
  keys.add(k);
}

function toWorld(e: PointerEvent) {
  const r = canvas.value!.getBoundingClientRect();
  // aim a little above the finger, so you can see yourself
  return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H - (e.pointerType === 'touch' ? 24 : 0) };
}
function onPointer(e: PointerEvent) {
  if (mode.value !== 'playing') return;
  if (e.type === 'pointerup' || e.type === 'pointercancel') pointer = null;
  else if (e.type === 'pointerdown' || e.buttons || e.pointerType === 'touch') pointer = toWorld(e);
}

function resize() {
  const cv = canvas.value;
  if (!cv) return;
  const r = cv.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(r.width * dpr);
  cv.height = Math.round((r.width * dpr * H) / W);
}

function onBlur() {
  if (mode.value === 'playing') mode.value = 'paused';
  keys.clear();
}

let observer: ResizeObserver;
onMounted(() => {
  followHub((l: Lang) => (lang.value = l));
  document.documentElement.lang = lang.value;
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  window.addEventListener('blur', onBlur);
  observer = new ResizeObserver(resize);
  observer.observe(canvas.value!);
  resize();
  raf = requestAnimationFrame(loop);
});
onBeforeUnmount(() => {
  cancelAnimationFrame(raf);
  observer.disconnect();
  window.removeEventListener('keydown', onKey);
  window.removeEventListener('keyup', onKey);
  window.removeEventListener('blur', onBlur);
});

// keep <html lang> in step with the arcade
watch(lang, (l) => (document.documentElement.lang = l));
</script>

<template>
  <main class="stage" :data-phase="mode" :data-score="hud.score" :data-time="hud.time">
    <header class="hud">
      <p>
        {{ t.time }} <b>{{ hud.time }} s</b>
      </p>
      <p>
        {{ t.score }} <b>{{ hud.score }}</b>
      </p>
      <p>
        {{ t.grazes }} <b>{{ hud.grazes }}</b>
      </p>
      <p :class="{ on: hud.shield }" class="shield">{{ t.shield }}</p>
      <p>
        {{ t.best }} <b>{{ best }}</b>
      </p>
    </header>
    <div class="arena">
      <canvas ref="canvas" aria-label="arena" @pointerdown="onPointer" @pointermove="onPointer" @pointerup="onPointer" @pointercancel="onPointer"></canvas>
      <p class="flash" :class="{ show: flash }" aria-live="polite">{{ flash }}</p>
      <div v-if="mode !== 'playing'" class="overlay" @click="primary">
        <template v-if="mode === 'title'">
          <p class="big">Null Pointer Dodge</p>
          <p class="sub">{{ t.tagline }}</p>
          <p class="how">{{ t.how }}</p>
          <p class="hint">{{ t.start }}</p>
        </template>
        <template v-else-if="mode === 'paused'">
          <p class="big">{{ t.paused }}</p>
          <p class="hint">{{ t.resume }}</p>
        </template>
        <template v-else>
          <p class="big error">{{ crashMessage }}</p>
          <p class="sub">{{ fill(t.result, { time: hud.time, score: hud.score, grazes: hud.grazes }) }}</p>
          <p v-if="newBest" class="accent">{{ t.newBest }}</p>
          <p class="hint">{{ t.again }}</p>
        </template>
      </div>
    </div>
  </main>
</template>
