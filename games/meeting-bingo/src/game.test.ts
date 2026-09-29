import { describe, expect, it } from 'vitest';
import { FREE, MEETING, PHRASES, SIZE, cardText, mark, newGame, step, text } from './game';

describe('Meeting Bingo rules', () => {
  it('deals 24 different phrases around a free middle square', () => {
    const s = newGame(3);
    expect(s.card).toHaveLength(SIZE * SIZE);
    expect(s.card[FREE]).toBe(-1);
    expect(s.marked[FREE]).toBe(true);
    const rest = s.card.filter((i) => i >= 0);
    expect(new Set(rest).size).toBe(24);
  });

  it('says every phrase on the card during the meeting, before it runs over', () => {
    for (let seed = 1; seed < 50; seed++) {
      const s = newGame(seed);
      const said = new Set(s.script.filter((l) => l.phrase >= 0).map((l) => l.phrase));
      for (const i of s.card) if (i >= 0) expect(said.has(i)).toBe(true);
      expect(s.script.at(-1)!.at).toBeLessThan(MEETING);
    }
  });

  it('marking something nobody said is a false alarm', () => {
    const s = newGame(5);
    const r = mark(s, 0);
    expect(r).toBe('false-alarm');
    expect(s.marked[0]).toBe(false);
    expect(s.falseAlarms).toBe(1);
  });

  it('marking what was said works, and five in a row is bingo', () => {
    const s = newGame(7);
    // play the meeting until the whole top row has been said
    const row = [0, 1, 2, 3, 4];
    while (!row.every((i) => s.said.has(s.card[i])) && s.phase === 'playing') step(s, 0.5);
    for (const i of row.slice(0, 4)) expect(mark(s, i)).toBe('marked');
    expect(mark(s, 4)).toBe('bingo');
    expect(s.phase).toBe('bingo');
    expect(s.line).toEqual(row);
    expect(s.score).toBeGreaterThan(1000);
  });

  it('the free square counts: four of the middle row are enough', () => {
    const s = newGame(11);
    const row = [10, 11, 13, 14];
    while (!row.every((i) => s.said.has(s.card[i]))) step(s, 0.5);
    for (const i of row.slice(0, 3)) mark(s, i);
    expect(mark(s, 14)).toBe('bingo');
  });

  it('a meeting that runs over without bingo is lost', () => {
    const s = newGame(13);
    step(s, MEETING + 1);
    expect(s.phase).toBe('overtime');
    expect(mark(s, 0)).toBe('ignored');
  });

  it('has every phrase in both languages', () => {
    for (let i = 0; i < PHRASES.length; i++) {
      for (const lang of ['en', 'nl'] as const) {
        expect(cardText(i, lang).trim()).not.toBe('');
        expect(PHRASES[i].said[lang].length).toBeGreaterThan(0);
      }
    }
    const s = newGame(1);
    expect(text(s, s.script[0], 'nl').trim()).not.toBe('');
  });
});
