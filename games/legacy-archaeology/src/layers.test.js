// With the real PHP (php-wasm for Node): every layer runs, its minimum is right, and the traps really are traps.
import { beforeAll, describe, expect, it } from 'vitest';
import { PHP } from '@php-wasm/universal';
import { loadNodeRuntime } from '@php-wasm/node';
import { LAYERS, Runner, source } from './layers.js';

const runner = new Runner(async () => new PHP(await loadNodeRuntime('8.4')));
beforeAll(() => runner.run('<?php echo 1;'), 60_000);

const run = (layer, gone) => runner.run(source(layer, gone));

describe('Legacy Code Archaeology, in real PHP', () => {
  it('every layer prints something, without warnings', async () => {
    for (const layer of LAYERS) {
      const out = await run(layer, new Set());
      expect(out.length, layer.title.en).toBeGreaterThan(3);
      expect(out).not.toMatch(/Warning|Error|\[/);
    }
  });

  it('digging out every dead line keeps the output, and after that no single line more can go', async () => {
    for (const layer of LAYERS) {
      const expected = await run(layer, new Set());
      const dug = new Set(layer.dig);
      expect(await run(layer, dug), layer.title.en).toBe(expected);
      for (let i = 0; i < layer.code.length; i++) {
        if (dug.has(i)) continue;
        expect(await run(layer, new Set([...dug, i])), `${layer.title.en}: line ${i + 1} is load-bearing`).not.toBe(expected);
      }
    }
  }, 120_000);

  it('the traps: $debug, the /* */ block and the DO NOT REMOVE line only go after what depends on them', async () => {
    const [l1, l2, l3] = LAYERS;
    const e1 = await run(l1, new Set());
    expect(await run(l1, new Set([2]))).not.toBe(e1); // $debug alone: an undefined-variable warning
    expect(await run(l1, new Set([10, 2]))).toBe(e1); // the if first, then $debug is dead
    const e2 = await run(l2, new Set());
    expect(await run(l2, new Set([3]))).not.toBe(e2); // only the /* line: the code comes back to life
    expect(await run(l2, new Set([5]))).not.toBe(e2); // only the */ line: the rest is commented out
    expect(await run(l2, new Set([3, 4, 5]))).toBe(e2); // the whole block together is fine
    const e3 = await run(l3, new Set());
    expect(await run(l3, new Set([5]))).not.toBe(e3); // DO NOT REMOVE really is load-bearing…
    expect(await run(l3, new Set([6, 5]))).toBe(e3); // …until the check that uses it is gone
  }, 60_000);
});
