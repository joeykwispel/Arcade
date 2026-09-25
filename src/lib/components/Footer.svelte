<script lang="ts">
  import { app } from '$lib/app.svelte';
  import { t } from '$lib/locales';

  /** Footer in the portfolio's style, like the other subdomains: mono, muted, a // comment, external links marked with ↗. */
  const f = $derived(t(app.locale).footer);
  const year = new Date().getUTCFullYear();
</script>

<footer>
  <div class="container row mono">
    <p><span class="com">// </span>© {year} Play · {f.tagline}</p>
    <p>
      {f.madeBy}
      <a href="https://joeyoosenbrug.nl/" target="_blank" rel="noopener noreferrer">Joey Oosenbrug ↗<span class="sr-only"> {f.newTab}</span></a>
      ·
      <a href="https://github.com/joeykwispel/arcade" target="_blank" rel="noopener noreferrer">{f.source} ↗<span class="sr-only"> {f.newTab}</span></a>
    </p>
  </div>
</footer>

<style>
  footer {
    border-top: 1px solid var(--border);
    padding-block: 1.25rem 1.5rem;
    color: var(--muted);
    font-size: 0.8rem;
    background: color-mix(in srgb, var(--bg) 70%, transparent);
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem 1rem;
    flex-wrap: wrap;
  }
  a {
    display: inline-block;
    padding-block: 0.25rem;
  }
</style>
