/**
 * SQL Heist: the bank's database, the levels, and the checks, without any DOM. Real SQLite (sql.js, SQLite compiled to
 * WebAssembly) runs every query, so any SQL that gets the right result counts, not just the one in the answer key.
 *
 * A SELECT level passes when your result has the same rows as the solution's (order only matters when the task says
 * so). A level that changes data passes when a check query sees the same thing after your statement as after the
 * solution's, each run on a fresh copy of the bank.
 */
import type { Database, QueryExecResult, SqlJsStatic } from 'sql.js';

export type Lang = 'en' | 'nl';

export const SCHEMA = `
CREATE TABLE vaults (id INTEGER PRIMARY KEY, name TEXT, floor INTEGER, balance INTEGER);
CREATE TABLE staff (id INTEGER PRIMARY KEY, name TEXT, role TEXT);
CREATE TABLE keys (staff_id INTEGER, vault_id INTEGER);
CREATE TABLE shifts (guard TEXT, hour INTEGER);
CREATE TABLE hours (hour INTEGER);
CREATE TABLE alarms (vault_id INTEGER, armed INTEGER);
CREATE TABLE logs (id INTEGER PRIMARY KEY, user TEXT, action TEXT);
CREATE TABLE transfers (id INTEGER PRIMARY KEY, from_vault INTEGER, to_account TEXT, amount INTEGER);

INSERT INTO vaults VALUES (1, 'Petty Cash', 0, 1200), (2, 'Main', -1, 4800000), (3, 'Gold Room', -2, 2750000),
  (4, 'Coin Jar', 1, 37), (5, 'Deposit Boxes', -1, 910000);
INSERT INTO staff VALUES (1, 'Priya', 'manager'), (2, 'Mark', 'teller'), (3, 'Dave', 'intern'),
  (4, 'Sanne', 'security'), (5, 'Tom', 'teller');
INSERT INTO keys VALUES (1, 2), (1, 3), (2, 1), (3, 4), (4, 2), (4, 5), (5, 1);
INSERT INTO shifts VALUES ('Sanne', 0), ('Sanne', 1), ('Sanne', 2), ('Bob', 3), ('Bob', 5), ('Bob', 6), ('Kim', 4);
INSERT INTO hours VALUES (0), (1), (2), (3), (4), (5), (6), (7);
INSERT INTO alarms VALUES (1, 1), (2, 1), (3, 1), (4, 0), (5, 1);
INSERT INTO logs (user, action) VALUES ('priya', 'login'), ('you', 'login'), ('mark', 'coffee'),
  ('you', 'SELECT * FROM vaults'), ('you', 'looked at the Main vault a bit too long'), ('dave', 'login');
`;

export interface Level {
  title: Record<Lang, string>;
  task: Record<Lang, string>;
  /** a nudge in the right direction, shown on request */
  hint: Record<Lang, string>;
  solution: string;
  /** for levels that change data: the query that shows whether it worked */
  check?: string;
  /** only for SELECT levels whose task asks for an order */
  ordered?: boolean;
}

export const LEVELS: Level[] = [
  {
    title: { en: 'Case the joint', nl: 'De boel verkennen' },
    task: {
      en: 'You are in. First, look around: show every vault, with all its columns.',
      nl: 'Je bent binnen. Kijk eerst rond: laat elke kluis zien, met alle kolommen.'
    },
    hint: { en: 'SELECT * FROM …', nl: 'SELECT * FROM …' },
    solution: 'SELECT * FROM vaults'
  },
  {
    title: { en: 'Pick a target', nl: 'Kies een doelwit' },
    task: { en: 'Which vault holds the most money? Show just its name.', nl: 'Welke kluis bevat het meeste geld? Laat alleen de naam zien.' },
    hint: { en: 'ORDER BY balance DESC, and LIMIT 1.', nl: 'ORDER BY balance DESC, en LIMIT 1.' },
    solution: 'SELECT name FROM vaults ORDER BY balance DESC LIMIT 1'
  },
  {
    title: { en: 'Follow the keys', nl: 'Volg de sleutels' },
    task: { en: 'Who has a key to the Main vault? Show their names.', nl: 'Wie heeft een sleutel van de Main-kluis? Laat hun namen zien.' },
    hint: {
      en: 'JOIN staff to keys on staff.id = keys.staff_id, and keys to vaults on vault_id.',
      nl: 'JOIN staff aan keys op staff.id = keys.staff_id, en keys aan vaults op vault_id.'
    },
    solution: "SELECT s.name FROM staff s JOIN keys k ON k.staff_id = s.id JOIN vaults v ON v.id = k.vault_id WHERE v.name = 'Main'"
  },
  {
    title: { en: 'Mind the gap', nl: 'Let op het gat' },
    task: {
      en: 'The night has hours 0 to 7. Which hour has no guard at all?',
      nl: 'De nacht heeft uren 0 tot en met 7. Welk uur heeft helemaal geen bewaker?'
    },
    hint: { en: 'Every hour is in hours. NOT IN (SELECT hour FROM shifts)…', nl: 'Elk uur staat in hours. NOT IN (SELECT hour FROM shifts)…' },
    solution: 'SELECT hour FROM hours WHERE hour NOT IN (SELECT hour FROM shifts)'
  },
  {
    title: { en: 'Silence the alarm', nl: 'Zet het alarm uit' },
    task: {
      en: 'Disarm the alarm of the Main vault (id 2). Just that one: the others would notice.',
      nl: 'Schakel het alarm van de Main-kluis (id 2) uit. Alleen die: de rest zou het merken.'
    },
    hint: { en: 'UPDATE alarms SET armed = 0 WHERE …', nl: 'UPDATE alarms SET armed = 0 WHERE …' },
    solution: 'UPDATE alarms SET armed = 0 WHERE vault_id = 2',
    check: 'SELECT vault_id, armed FROM alarms ORDER BY vault_id'
  },
  {
    title: { en: 'Move the money', nl: 'Verplaats het geld' },
    task: {
      en: "Queue a transfer of 4800000 from vault 2 to account 'NL00 HEIST 0000 0001'.",
      nl: "Zet een overboeking klaar van 4800000 vanuit kluis 2 naar rekening 'NL00 HEIST 0000 0001'."
    },
    hint: { en: 'INSERT INTO transfers (from_vault, to_account, amount) VALUES (…)', nl: 'INSERT INTO transfers (from_vault, to_account, amount) VALUES (…)' },
    solution: "INSERT INTO transfers (from_vault, to_account, amount) VALUES (2, 'NL00 HEIST 0000 0001', 4800000)",
    check: 'SELECT from_vault, to_account, amount FROM transfers'
  },
  {
    title: { en: 'Cover your tracks', nl: 'Wis je sporen' },
    task: {
      en: "Delete every log line of user 'you'. Leave everyone else's alone.",
      nl: "Verwijder elke logregel van gebruiker 'you'. Laat die van de rest staan."
    },
    hint: { en: "DELETE FROM logs WHERE user = 'you'", nl: "DELETE FROM logs WHERE user = 'you'" },
    solution: "DELETE FROM logs WHERE user = 'you'",
    check: 'SELECT user, action FROM logs ORDER BY id'
  }
];

export type Outcome =
  { kind: 'error'; message: string } | { kind: 'bobby'; message: string } | { kind: 'result'; result: QueryExecResult | null; solved: boolean };

/** Rows, as strings, for comparing results without caring about column names. */
function rows(r: QueryExecResult[] | undefined): string[] {
  const last = r?.[r.length - 1];
  return last ? last.values.map((row) => JSON.stringify(row)) : [];
}

function same(a: string[], b: string[], ordered: boolean): boolean {
  if (a.length !== b.length) return false;
  if (ordered) return a.every((x, i) => x === b[i]);
  const s1 = [...a].sort();
  const s2 = [...b].sort();
  return s1.every((x, i) => x === s2[i]);
}

export class Heist {
  constructor(private SQL: SqlJsStatic) {}

  /** A fresh copy of the bank. */
  bank(): Database {
    const db = new this.SQL.Database();
    db.run(SCHEMA);
    return db;
  }

  /** What the solution of level i gives (its result, or its check query's result). */
  expected(i: number): string[] {
    const level = LEVELS[i];
    const db = this.bank();
    try {
      const r = db.exec(level.solution);
      return level.check ? rows(db.exec(level.check)) : rows(r);
    } finally {
      db.close();
    }
  }

  /**
   * Runs the player's SQL against the bank (which it may change, like the real thing) and checks it on a fresh copy.
   * Dropping a table sets off security instead of running.
   */
  run(db: Database, i: number, sql: string): Outcome {
    if (/\bdrop\s+table\b/i.test(sql)) {
      return { kind: 'bobby', message: 'DROP TABLE' };
    }
    let result: QueryExecResult[];
    try {
      result = db.exec(sql);
    } catch (e) {
      return { kind: 'error', message: e instanceof Error ? e.message : String(e) };
    }
    const level = LEVELS[i];
    // check on a fresh bank, so earlier experiments don't count for or against you
    const fresh = this.bank();
    let got: string[];
    try {
      const r = fresh.exec(sql);
      got = level.check ? rows(fresh.exec(level.check)) : rows(r);
    } catch {
      got = [];
    } finally {
      fresh.close();
    }
    const solved = same(got, this.expected(i), !!level.ordered);
    return { kind: 'result', result: result[result.length - 1] ?? null, solved };
  }
}
