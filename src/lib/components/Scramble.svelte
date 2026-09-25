<script lang="ts">
  import { onMount } from 'svelte';
  import { reduced } from '$lib/utils/actions';

  /** Decodes `text` from random glyphs, on mount or when scrolled into view. Hovering replays it. */
  let {
    text,
    trigger = 'view',
    duration = 900,
    delay = 0,
    hover = true
  }: { text: string; trigger?: 'mount' | 'view'; duration?: number; delay?: number; hover?: boolean } = $props();

  const GLYPHS = '!<>-_\\/[]{}=+*^?#01$%&';
  let p = $state(1);
  let frame = $state(0);
  let el: HTMLSpanElement;
  let raf = 0;

  const shown = $derived.by(() => {
    void frame;
    if (p >= 1) return text;
    const cut = Math.floor(p * text.length);
    let out = '';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      out += i < cut || ch === ' ' ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
    }
    return out;
  });

  function run(wait = 0) {
    if (reduced()) return;
    cancelAnimationFrame(raf);
    p = 0;
    const start = performance.now() + wait;
    const tick = (t: number) => {
      const k = Math.max(0, (t - start) / duration);
      p = Math.min(1, k);
      frame++;
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  onMount(() => {
    if (reduced()) return;
    if (trigger === 'mount') {
      run(delay);
      return () => cancelAnimationFrame(raf);
    }
    p = 0;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          io.disconnect();
          run(delay);
        }
      },
      { threshold: 0.3 }
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<span class="scramble" bind:this={el} onpointerenter={() => hover && p >= 1 && run()}
  ><span class="sr-only">{text}</span><span aria-hidden="true">{shown}</span></span
>

<style>
  .scramble {
    display: inline;
  }
</style>
