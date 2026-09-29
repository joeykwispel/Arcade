import { beforeAll, describe, expect, it } from 'vitest';
import initSqlJs from 'sql.js';
import { Heist, LEVELS } from './heist';

let heist: Heist;
beforeAll(async () => {
  heist = new Heist(await initSqlJs());
});

describe('SQL Heist', () => {
  it('every level is solved by its own solution, and has text in both languages', () => {
    for (let i = 0; i < LEVELS.length; i++) {
      const db = heist.bank();
      const r = heist.run(db, i, LEVELS[i].solution);
      expect(r.kind === 'result' && r.solved, LEVELS[i].title.en).toBe(true);
      for (const lang of ['en', 'nl'] as const) {
        expect(LEVELS[i].title[lang]).not.toBe('');
        expect(LEVELS[i].task[lang]).not.toBe('');
        expect(LEVELS[i].hint[lang]).not.toBe('');
      }
      db.close();
    }
  });

  it('other SQL with the same result counts too', () => {
    const db = heist.bank();
    expect(heist.run(db, 1, 'SELECT name FROM vaults WHERE balance = (SELECT MAX(balance) FROM vaults)')).toMatchObject({ solved: true });
    expect(heist.run(db, 2, 'SELECT name FROM staff WHERE id IN (SELECT staff_id FROM keys WHERE vault_id = 2)')).toMatchObject({ solved: true });
    expect(heist.run(db, 3, 'SELECT h.hour FROM hours h LEFT JOIN shifts s ON s.hour = h.hour WHERE s.guard IS NULL')).toMatchObject({ solved: true });
  });

  it('a near miss is not solved', () => {
    const db = heist.bank();
    expect(heist.run(db, 1, 'SELECT name FROM vaults ORDER BY balance ASC LIMIT 1')).toMatchObject({ solved: false });
    // disarming every alarm is too much
    expect(heist.run(db, 4, 'UPDATE alarms SET armed = 0')).toMatchObject({ solved: false });
    // deleting all logs is suspicious
    expect(heist.run(db, 6, 'DELETE FROM logs')).toMatchObject({ solved: false });
  });

  it("SQLite's own error comes back for broken SQL", () => {
    const r = heist.run(heist.bank(), 0, 'SELEKT * FROM vaults');
    expect(r.kind).toBe('error');
    expect(r.kind === 'error' && r.message).toMatch(/syntax error/);
  });

  it('DROP TABLE sets off security instead of running', () => {
    const db = heist.bank();
    expect(heist.run(db, 0, 'DROP TABLE vaults; --').kind).toBe('bobby');
    expect(db.exec('SELECT COUNT(*) FROM vaults')[0].values[0][0]).toBe(5);
  });

  it("checks on a fresh bank: earlier experiments don't count", () => {
    const db = heist.bank();
    heist.run(db, 4, 'UPDATE alarms SET armed = 0 WHERE vault_id = 2');
    // the level after: running a harmless SELECT doesn't solve "move the money"
    expect(heist.run(db, 5, 'SELECT * FROM transfers')).toMatchObject({ solved: false });
  });
});
