import { describe, expect, it } from 'vitest';
import en from './en';
import nl from './nl';

/** Every key path in an object, e.g. "games.play", with array items as "how.steps.0.title". */
const keys = (o: unknown, prefix = ''): string[] =>
  o && typeof o === 'object' ? Object.entries(o).flatMap(([k, v]) => keys(v, prefix ? `${prefix}.${k}` : k)) : [prefix];

describe('hub text', () => {
  it('has the same keys in English and Dutch', () => {
    expect(keys(nl)).toEqual(keys(en));
  });

  it('has no empty strings', () => {
    const empty = (o: unknown): boolean => (typeof o === 'string' ? !o.trim() : !!o && typeof o === 'object' && Object.values(o).some(empty));
    expect(empty(en)).toBe(false);
    expect(empty(nl)).toBe(false);
  });
});
