<script lang="ts">
  import { reveal } from '$lib/utils/actions';
  import Scramble from './Scramble.svelte';

  /** The portfolio's section heading: a file path, the title as a <Tag />, and a // comment. */
  let { title, intro = '', num = '', slug = '', ext = '.ts' }: { title: string; intro?: string; num?: string; slug?: string; ext?: string } = $props();
</script>

<header class="section-head" use:reveal>
  {#if num || slug}
    <p class="path mono" aria-hidden="true">
      {#if num}<span class="n">{num}</span>{/if}
      <span class="dir">~/play/</span><span class="file">{slug}</span><span class="ext">{ext}</span>
      <span class="line"></span>
    </p>
  {/if}
  <h2>
    <span class="br" aria-hidden="true">&lt;</span><Scramble text={title} /><span class="br" aria-hidden="true"> /&gt;</span>
  </h2>
  {#if intro}<p class="intro"><span class="com" aria-hidden="true">// </span>{intro}</p>{/if}
</header>

<style>
  .path {
    display: flex;
    align-items: center;
    gap: 0.1rem;
    font-size: 0.8rem;
    color: var(--muted);
    max-width: none;
  }
  .n {
    color: var(--accent-text);
    font-weight: 700;
    margin-right: 0.6rem;
  }
  .file {
    color: var(--text);
  }
  .ext {
    color: var(--accent-2-text);
  }
  .line {
    flex: 1;
    height: 1px;
    margin-left: 0.9rem;
    max-width: 280px;
    background: linear-gradient(90deg, var(--border), transparent);
    transform-origin: left;
    transform: scaleX(0);
    transition: transform 1.1s var(--ease) 0.25s;
  }
  :global(.reveal.in) .line,
  :global(html:not(.js)) .line {
    transform: none;
  }
  h2 {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
  }
  .br {
    color: var(--accent-text);
    opacity: 0.55;
    font-weight: 500;
  }
  .br:first-child {
    margin-right: 0.08em;
  }
  .intro {
    font-size: 0.95rem;
  }
  .intro .com {
    font-style: normal;
    font-family: var(--mono);
  }
</style>
