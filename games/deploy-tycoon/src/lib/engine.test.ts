import { describe, expect, it } from 'vitest';
import {
  GENERATORS,
  IPO_AT,
  affordable,
  buy,
  buyUpgrade,
  canIpo,
  clickValue,
  cost,
  ipo,
  money,
  newState,
  offline,
  push,
  rate,
  revive,
  rollback,
  tick,
  visibleUpgrades
} from './engine';

const intern = GENERATORS[0];
const never = () => 0.999;

describe('economy', () => {
  it('prices climb 15% per purchase, and a bulk price is the sum', () => {
    expect(cost(intern, 0)).toBe(15);
    expect(cost(intern, 1)).toBe(Math.ceil(15 * 1.15));
    let sum = 0;
    for (let i = 0; i < 10; i++) sum += 15 * 1.15 ** i;
    expect(cost(intern, 0, 10)).toBe(Math.ceil(sum));
  });

  it('buying the max buys exactly what you can afford', () => {
    for (const cash of [14, 15, 1_000, 123_456, 9.9e9]) {
      const n = affordable(intern, 3, cash);
      expect(cost(intern, 3, n)).toBeLessThanOrEqual(cash);
      expect(cost(intern, 3, n + 1)).toBeGreaterThan(cash);
    }
    const s = newState();
    s.money = 1_000;
    const n = buy(s, 'intern', Infinity);
    expect(s.owned.intern).toBe(n);
    expect(s.money).toBeGreaterThanOrEqual(0);
    expect(s.money).toBeLessThan(cost(intern, n));
  });

  it('earns from clicks, and from generators over time', () => {
    const s = newState();
    expect(push(s)).toBe(1);
    s.owned.junior = 10;
    expect(rate(s)).toBe(10);
    tick(s, 2, never);
    expect(s.money).toBeCloseTo(21);
  });

  it('upgrades double generators and grow clicks', () => {
    const s = newState();
    s.owned.junior = 1;
    s.money = 1e9;
    s.earned = 1e6;
    expect(buyUpgrade(s, 'junior-0')).toBe(true);
    expect(rate(s)).toBe(2);
    expect(buyUpgrade(s, 'keyboard')).toBe(true);
    expect(clickValue(s)).toBe(2);
    expect(buyUpgrade(s, 'keyboard')).toBe(false); // only once
    expect(buyUpgrade(s, 'junior-3')).toBe(false); // needs 50 juniors
  });

  it('an incident cuts income until you roll back, or the SRE does', () => {
    const s = newState();
    s.owned.junior = 10;
    s.nextIncident = 0.5;
    const events = tick(s, 1, never);
    expect(events).toContainEqual({ kind: 'incident' });
    expect(rate(s)).toBe(2);
    expect(rollback(s)).toBe(true);
    expect(rate(s)).toBe(10);

    s.upgrades.push('sre');
    s.incident = 0;
    const later = tick(s, 11, never);
    expect(later).toContainEqual({ kind: 'resolved', auto: true });
  });

  it('pays for time away: half speed, at most eight hours', () => {
    const s = newState(0, 0, 0);
    s.owned.junior = 10;
    const back = offline(s, 24 * 3600 * 1000);
    expect(back.seconds).toBe(8 * 3600);
    expect(back.earned).toBe(10 * 8 * 3600 * 0.5);
    expect(offline(s, 24 * 3600 * 1000 + 30_000).earned).toBe(0); // a short break isn't "away"
  });

  it('goes public for stock options, and keeps them', () => {
    const s = newState();
    expect(canIpo(s)).toBe(false);
    s.earned = s.allTime = IPO_AT * 10;
    s.owned.intern = 50;
    expect(canIpo(s)).toBe(true);
    const next = ipo(s);
    expect(next.options).toBeGreaterThan(0);
    expect(next.owned.intern).toBe(0);
    expect(next.allTime).toBe(s.allTime);
    expect(clickValue(next)).toBeGreaterThan(1);
  });

  it('reaches the IPO in a reasonable time with a simple strategy', () => {
    // buy the best dollars-per-second per dollar, click 5 times a second, roll back incidents after 5 seconds
    const s = newState();
    let rolled = 0;
    let t = 0;
    while (s.earned < IPO_AT && t < 6 * 3600) {
      for (let i = 0; i < 5; i++) push(s);
      for (const u of visibleUpgrades(s)) buyUpgrade(s, u.id);
      const best = GENERATORS.filter((g) => s.money >= cost(g, s.owned[g.id])).sort(
        (a, b) => cost(a, s.owned[a.id]) / a.rate - cost(b, s.owned[b.id]) / b.rate
      )[0];
      if (best) buy(s, best.id, 1);
      tick(s, 1);
      if (s.incident >= 5) rolled += rollback(s) ? 1 : 0;
      t++;
    }
    expect(s.earned).toBeGreaterThanOrEqual(IPO_AT);
    // not too fast, not a whole day: an idle game you can finish a first run of in an evening
    expect(t).toBeGreaterThan(20 * 60);
    expect(t).toBeLessThan(4 * 3600);
    expect(rolled).toBeGreaterThan(0);
  });

  it('survives a broken or old save', () => {
    expect(revive(null).money).toBe(0);
    const s = revive({ money: 50, owned: { intern: 3 }, upgrades: ['keyboard', 'nope'], clicks: 'x' });
    expect(s.money).toBe(50);
    expect(s.owned.intern).toBe(3);
    expect(s.owned.datacenter).toBe(0);
    expect(s.upgrades).toEqual(['keyboard']);
    expect(s.clicks).toBe(0);
  });

  it('formats money short', () => {
    expect(money(0)).toBe('0');
    expect(money(2.5)).toBe('2.5');
    expect(money(999)).toBe('999');
    expect(money(1234)).toBe('1.23K');
    expect(money(56_700_000)).toBe('56.7M');
    expect(money(4.2e15)).toBe('4.20Qa');
  });
});
