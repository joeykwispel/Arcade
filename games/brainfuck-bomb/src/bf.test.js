import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { BOMBS, interpreter } from './bombs.js';

/** @type {(program: string) => string} */
let bf;
beforeAll(async () => {
  const { instance } = await WebAssembly.instantiate(readFileSync(new URL('./bf.wasm', import.meta.url)));
  bf = interpreter(instance);
});

describe('the hand-written WebAssembly interpreter', () => {
  it('runs the classics', () => {
    expect(bf('++++++++[>++++[>++>+++>+++>+<<<<-]>+>+>->>+[<]<-]>>.>---.+++++++..+++.>>.<-.<.+++.------.--------.>>+.')).toBe('Hello World!');
    expect(bf('')).toBe('');
    expect(bf('+.')).toBe('\x01');
  });

  it('wraps cells at 256 and the tape at both ends', () => {
    // 0 - 1 = 255, then 49 more wraps around to 48: '0'
    expect(bf('-' + '+'.repeat(49) + '.')).toBe('0');
    expect(bf('<+++++[>++++++++++<-]>.')).toBe('2');
  });

  it('handles nested loops', () => {
    expect(bf('++[>++[>++++++++++++<-]<-]>>.')).toBe('0');
  });

  it('stops endless loops and broken brackets instead of hanging', () => {
    expect(() => bf('+[]')).toThrow('endless loop');
    expect(() => bf('+[')).toThrow('unmatched bracket');
    expect(() => bf('+]')).toThrow('unmatched bracket');
  });

  it('every bomb prints a short code of digits or capitals', () => {
    const codes = BOMBS.map((b) => bf(b.program));
    expect(codes).toEqual(['0', '5', '123', 'HI', 'OK', '404']);
    for (const b of BOMBS) expect(b.seconds).toBeGreaterThan(20);
  });
});
