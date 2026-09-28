/**
 * A tiny, pure git: just enough of the commit graph to play with. No files, no working tree, no index.
 * Every command returns a new Repo (the old one is never changed), so undo is just keeping the old one.
 */

export interface Commit {
  id: string;
  parents: string[];
  /**
   * What the commit changes, as an id. A fresh commit has its own patch; a rebased or cherry-picked copy keeps the
   * patch of the original (C3 and C3' both have patch "C3"). Rebase uses it to skip work that's already there.
   */
  patch: string;
}

export interface Repo {
  commits: Record<string, Commit>;
  /** branch name → commit id, in creation order */
  branches: Record<string, string>;
  /** a branch name, or a commit id when detached */
  head: { branch: string } | { commit: string };
  /** next number for a fresh commit id */
  next: number;
}

export interface Result {
  repo: Repo;
  /** lines for the terminal */
  out: string[];
  /** false for errors and for commands that only look (log, status, help) */
  changed: boolean;
}

export class GitError extends Error {}

/* ---------- building repos ---------- */

/**
 * A repo from a compact description, for level definitions:
 * `commits` lists `id:parent1,parent2` (root has no parents), branches map name → commit, head is a branch or commit.
 */
export function repo(commits: string[], branches: Record<string, string>, head: string): Repo {
  const all: Record<string, Commit> = {};
  let next = 0;
  for (const spec of commits) {
    const [id, parents = ''] = spec.split(':');
    all[id] = { id, parents: parents ? parents.split(',') : [], patch: id.replace(/'+$/, '') };
    next = Math.max(next, Number(id.replace(/\D/g, '')) + 1);
  }
  return { commits: all, branches: { ...branches }, head: head in branches ? { branch: head } : { commit: head }, next };
}

export const headCommit = (r: Repo) => ('branch' in r.head ? r.branches[r.head.branch] : r.head.commit);

/** Every commit reachable from `id`, including itself. */
export function ancestors(r: Repo, id: string): Set<string> {
  const seen = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const c = stack.pop()!;
    if (seen.has(c)) continue;
    seen.add(c);
    stack.push(...r.commits[c].parents);
  }
  return seen;
}

/** Commits reachable from a branch or HEAD; the rest is garbage and isn't drawn. */
export function reachable(r: Repo): Set<string> {
  const all = new Set<string>();
  for (const tip of [...Object.values(r.branches), headCommit(r)]) for (const c of ancestors(r, tip)) all.add(c);
  return all;
}

/* ---------- refs ---------- */

/** Resolves HEAD, a branch, a commit id (any case) and ~n / ^ suffixes to a commit id. */
export function resolve(r: Repo, ref: string): string {
  const m = ref.match(/^(.*?)((?:[~^]\d*)*)$/)!;
  const base = m[1];
  const found =
    base === 'HEAD' || base === '@'
      ? headCommit(r)
      : base in r.branches
        ? r.branches[base]
        : Object.keys(r.commits).find((c) => c.toUpperCase() === base.toUpperCase());
  if (!found) throw new GitError(`fatal: ambiguous argument '${ref}': unknown revision`);
  let id: string = found;
  for (const [, op, n] of m[2].matchAll(/([~^])(\d*)/g)) {
    const steps = n === '' ? 1 : Number(n);
    if (op === '^') {
      const p = r.commits[id].parents[steps - 1];
      if (steps === 0) continue;
      if (!p) throw new GitError(`fatal: '${ref}': ${id} has no parent ${steps}`);
      id = p;
    } else {
      for (let i = 0; i < steps; i++) {
        const p = r.commits[id].parents[0];
        if (!p) throw new GitError(`fatal: '${ref}': ${id} has no parent`);
        id = p;
      }
    }
  }
  return id;
}

/* ---------- helpers that build the next repo ---------- */

function clone(r: Repo): Repo {
  return { commits: { ...r.commits }, branches: { ...r.branches }, head: { ...r.head }, next: r.next };
}

/** Moves HEAD's branch (or detached HEAD) to `id`. */
function advance(r: Repo, id: string) {
  if ('branch' in r.head) r.branches[r.head.branch] = id;
  else r.head = { commit: id };
}

function fresh(r: Repo, parents: string[], patch?: string): string {
  const id = `C${r.next++}`;
  r.commits[id] = { id, parents, patch: patch ?? id };
  return id;
}

/** A copy of `src` on top of `onto`: C3 → C3', C3' → C3''. */
function copy(r: Repo, src: string, onto: string): string {
  let id = `${src}'`;
  while (r.commits[id]) id += "'";
  r.commits[id] = { id, parents: [onto], patch: r.commits[src].patch };
  return id;
}

const validName = (n: string) => /^[A-Za-z0-9][\w./-]*$/.test(n) && n !== 'HEAD' && !/^C\d+'*$/i.test(n);

function where(r: Repo) {
  return 'branch' in r.head ? r.head.branch : `detached HEAD at ${r.head.commit}`;
}

/** Commits of `tip` that `base` doesn't have, oldest first, merge commits left out (like a plain rebase). */
function missing(r: Repo, tip: string, base: string): string[] {
  const have = ancestors(r, base);
  const list: string[] = [];
  const seen = new Set<string>();
  const visit = (c: string) => {
    if (seen.has(c) || have.has(c)) return;
    seen.add(c);
    for (const p of r.commits[c].parents) visit(p);
    if (r.commits[c].parents.length < 2) list.push(c);
  };
  visit(tip);
  return list;
}

/* ---------- commands ---------- */

type Cmd = (r: Repo, args: string[], flags: Set<string>) => Result;

const commit: Cmd = (r, _args, flags) => {
  const next = clone(r);
  const parent = headCommit(r);
  if (flags.has('--amend')) {
    const old = r.commits[parent];
    if (!old.parents.length) throw new GitError('fatal: can’t amend the root commit here');
    let id = `${parent}'`;
    while (next.commits[id]) id += "'";
    next.commits[id] = { id, parents: old.parents, patch: old.patch };
    advance(next, id);
    return { repo: next, out: [`[${where(next)} ${id}] amended ${parent}`], changed: true };
  }
  const id = fresh(next, [parent]);
  advance(next, id);
  return { repo: next, out: [`[${where(next)} ${id}] ${commitMessage(id)}`], changed: true };
};

const branch: Cmd = (r, args, flags) => {
  if (flags.has('-d') || flags.has('-D') || flags.has('--delete')) {
    if (!args.length) throw new GitError('fatal: branch name required');
    const next = clone(r);
    const out: string[] = [];
    for (const name of args) {
      if (!(name in r.branches)) throw new GitError(`error: branch '${name}' not found`);
      if ('branch' in r.head && r.head.branch === name) throw new GitError(`error: cannot delete branch '${name}' used by HEAD`);
      if (!flags.has('-D') && !ancestors(r, headCommit(r)).has(r.branches[name])) {
        throw new GitError(`error: the branch '${name}' is not fully merged (use -D to delete it anyway)`);
      }
      out.push(`Deleted branch ${name} (was ${r.branches[name]}).`);
      delete next.branches[name];
    }
    return { repo: next, out, changed: true };
  }
  if (!args.length) {
    const cur = 'branch' in r.head ? r.head.branch : null;
    const lines = Object.keys(r.branches).map((b) => `${b === cur ? '*' : ' '} ${b}`);
    if (!cur) lines.unshift(`* (HEAD detached at ${headCommit(r)})`);
    return { repo: r, out: lines, changed: false };
  }
  const [name, start = 'HEAD'] = args;
  if (!validName(name)) throw new GitError(`fatal: '${name}' is not a valid branch name`);
  const force = flags.has('-f') || flags.has('--force');
  if (name in r.branches && !force) throw new GitError(`fatal: a branch named '${name}' already exists`);
  if (force && 'branch' in r.head && r.head.branch === name) throw new GitError(`fatal: cannot force update the current branch`);
  const next = clone(r);
  next.branches[name] = resolve(r, start);
  return { repo: next, out: force ? [`${name} now points at ${next.branches[name]}`] : [], changed: true };
};

function switchTo(r: Repo, target: string, create: string | null, allowDetach: boolean): Result {
  const next = clone(r);
  if (create !== null) {
    if (!validName(create)) throw new GitError(`fatal: '${create}' is not a valid branch name`);
    if (create in r.branches) throw new GitError(`fatal: a branch named '${create}' already exists`);
    next.branches[create] = resolve(r, target);
    next.head = { branch: create };
    return { repo: next, out: [`Switched to a new branch '${create}'`], changed: true };
  }
  if (target in r.branches) {
    if ('branch' in r.head && r.head.branch === target) return { repo: r, out: [`Already on '${target}'`], changed: false };
    next.head = { branch: target };
    return { repo: next, out: [`Switched to branch '${target}'`], changed: true };
  }
  if (!allowDetach) throw new GitError(`fatal: a branch is expected, got '${target}' (use --detach to go to a commit)`);
  const id = resolve(r, target);
  next.head = { commit: id };
  return { repo: next, out: [`HEAD is now at ${id} (detached HEAD)`], changed: true };
}

const checkout: Cmd = (r, args, flags) => {
  const create = flags.has('-b') ? (args[0] ?? '') : null;
  const target = create !== null ? (args[1] ?? 'HEAD') : args[0];
  if (!target) throw new GitError('fatal: you must specify a branch or commit');
  return switchTo(r, target, create, true);
};

const gitSwitch: Cmd = (r, args, flags) => {
  const create = flags.has('-c') ? (args[0] ?? '') : null;
  const target = create !== null ? (args[1] ?? 'HEAD') : args[0];
  if (!target) throw new GitError('fatal: missing branch or commit argument');
  return switchTo(r, target, create, flags.has('--detach') || flags.has('-d'));
};

const merge: Cmd = (r, args, flags) => {
  if (!args.length) throw new GitError('fatal: no branch to merge');
  const head = headCommit(r);
  const other = resolve(r, args[0]);
  if (ancestors(r, head).has(other)) return { repo: r, out: ['Already up to date.'], changed: false };
  const next = clone(r);
  if (ancestors(r, other).has(head) && !flags.has('--no-ff')) {
    advance(next, other);
    return { repo: next, out: [`Updating ${head}..${other}`, 'Fast-forward'], changed: true };
  }
  const id = fresh(next, [head, other], `merge ${args[0]}`);
  advance(next, id);
  return { repo: next, out: [`Merge made by the 'ort' strategy: ${id}`], changed: true };
};

const rebase: Cmd = (r, args) => {
  if (!args.length) throw new GitError('fatal: no upstream to rebase onto');
  let start = r;
  const out: string[] = [];
  if (args[1]) {
    const moved = switchTo(r, args[1], null, true);
    start = moved.repo;
    out.push(...moved.out);
  }
  const head = headCommit(start);
  const upstream = resolve(start, args[0]);
  const upstreamPatches = new Set([...ancestors(start, upstream)].map((c) => start.commits[c].patch));
  const todo = missing(start, head, upstream);
  const next = clone(start);
  if (!todo.length) {
    if (ancestors(start, upstream).has(head) && head !== upstream) {
      advance(next, upstream);
      return { repo: next, out: [...out, `Fast-forwarded to ${upstream}.`], changed: true };
    }
    return { repo: start, out: [...out, 'Current branch is up to date.'], changed: start !== r };
  }
  let tip = upstream;
  for (const c of todo) {
    // like git: a patch that upstream already has is skipped
    if (upstreamPatches.has(start.commits[c].patch)) {
      out.push(`skipped ${c} (already upstream)`);
      continue;
    }
    tip = copy(next, c, tip);
  }
  advance(next, tip);
  out.push(`Successfully rebased and updated ${where(next)}.`);
  return { repo: next, out, changed: true };
};

const cherryPick: Cmd = (r, args) => {
  if (!args.length) throw new GitError('fatal: nothing to cherry-pick');
  const next = clone(r);
  const out: string[] = [];
  const have = new Set([...ancestors(r, headCommit(r))].map((c) => r.commits[c].patch));
  for (const a of args) {
    const src = resolve(r, a);
    if (r.commits[src].parents.length > 1) throw new GitError(`error: ${src} is a merge; cherry-pick needs a normal commit`);
    if (have.has(r.commits[src].patch)) throw new GitError(`The previous cherry-pick is now empty: ${src} is already here`);
    const id = copy(next, src, headCommit(next));
    advance(next, id);
    out.push(`[${where(next)} ${id}] picked ${src}`);
  }
  return { repo: next, out, changed: true };
};

const revert: Cmd = (r, args) => {
  if (!args.length) throw new GitError('fatal: nothing to revert');
  const src = resolve(r, args[0]);
  if (!ancestors(r, headCommit(r)).has(src)) throw new GitError(`error: ${src} is not in the current history`);
  const next = clone(r);
  const id = fresh(next, [headCommit(r)], `revert ${r.commits[src].patch}`);
  advance(next, id);
  return { repo: next, out: [`[${where(next)} ${id}] Revert "${commitMessage(src)}"`], changed: true };
};

const reset: Cmd = (r, args) => {
  const target = resolve(r, args[0] ?? 'HEAD');
  const next = clone(r);
  advance(next, target);
  return { repo: next, out: [`HEAD is now at ${target}`], changed: target !== headCommit(r) };
};

const log: Cmd = (r) => {
  const out: string[] = [];
  let c: string | undefined = headCommit(r);
  const labels = (id: string) => {
    const names = Object.entries(r.branches)
      .filter(([, v]) => v === id)
      .map(([k]) => ('branch' in r.head && r.head.branch === k ? `HEAD -> ${k}` : k));
    if (!('branch' in r.head) && r.head.commit === id) names.unshift('HEAD');
    return names.length ? ` (${names.join(', ')})` : '';
  };
  while (c && out.length < 12) {
    out.push(`${c}${labels(c)} ${commitMessage(c)}`);
    c = r.commits[c].parents[0];
  }
  return { repo: r, out, changed: false };
};

const status: Cmd = (r) => ({
  repo: r,
  out: ['branch' in r.head ? `On branch ${r.head.branch}` : `HEAD detached at ${r.head.commit}`, 'nothing to commit, working tree clean'],
  changed: false
});

const COMMANDS: Record<string, Cmd> = {
  commit,
  branch,
  checkout,
  switch: gitSwitch,
  merge,
  rebase,
  'cherry-pick': cherryPick,
  revert,
  reset,
  log,
  status
};

export const COMMAND_NAMES = Object.keys(COMMANDS);

/** Short fake commit messages, so `log` has something to show. Stable per id. */
const MESSAGES = ['fix typo', 'add tests', 'wip', 'refactor', 'update deps', 'fix the fix', 'final version', 'please work', 'cleanup', 'oops'];
export function commitMessage(id: string) {
  const n = Number(id.replace(/\D/g, '')) || 0;
  return MESSAGES[n % MESSAGES.length];
}

/** Splits a command line like a shell would, keeping "quoted strings" together. */
export function tokenize(line: string): string[] {
  return [...line.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)].map((m) => m[1] ?? m[2] ?? m[3]);
}

/** Flags that take the next word as their value (so it isn't read as an argument). */
const VALUE_FLAGS = new Set(['-m', '--message']);

/** Runs one command line against a repo. Throws GitError for anything git would refuse. */
export function run(r: Repo, line: string): Result {
  const words = tokenize(line.trim());
  if (words[0] !== 'git') throw new GitError(`${words[0] ?? ''}: command not found (try git help)`);
  const [, name, ...rest] = words;
  if (!name || name === 'help' || name === '--help') {
    return { repo: r, out: [`commands: ${COMMAND_NAMES.map((c) => `git ${c}`).join(', ')}`], changed: false };
  }
  const cmd = COMMANDS[name];
  if (!cmd) throw new GitError(`git: '${name}' is not a git command here. See 'git help'.`);
  const flags = new Set<string>();
  const args: string[] = [];
  for (let i = 0; i < rest.length; i++) {
    const w = rest[i];
    if (w.startsWith('-') && w.length > 1) {
      flags.add(w);
      if (VALUE_FLAGS.has(w)) i++;
    } else args.push(w);
  }
  return cmd(r, args, flags);
}

/* ---------- comparing with the goal ---------- */

/**
 * A description of the history behind a commit that ignores ids of new commits: two repos match when their branches
 * have the same shape, the same original commits and the same copies of them. Fresh commits count as "new".
 */
function shape(r: Repo, id: string, fixed: Set<string>, memo: Map<string, string>): string {
  const hit = memo.get(id);
  if (hit) return hit;
  const c = r.commits[id];
  const label = fixed.has(c.patch) || c.patch.startsWith('revert ') ? c.patch : c.patch.startsWith('merge ') ? 'merge' : 'new';
  const s = `${label}(${c.parents.map((p) => shape(r, p, fixed, memo)).join(',')})`;
  memo.set(id, s);
  return s;
}

/** Whether `r` looks like `goal`: same branches with the same history shape, and HEAD on the same branch. */
export function matches(r: Repo, goal: Repo, start: Repo): boolean {
  const fixed = new Set(Object.values(start.commits).map((c) => c.patch));
  const names = Object.keys(goal.branches);
  if (names.length !== Object.keys(r.branches).length || names.some((b) => !(b in r.branches))) return false;
  const [ma, mb] = [new Map<string, string>(), new Map<string, string>()];
  if (names.some((b) => shape(r, r.branches[b], fixed, ma) !== shape(goal, goal.branches[b], fixed, mb))) return false;
  if ('branch' in goal.head) return 'branch' in r.head && r.head.branch === goal.head.branch;
  return shape(r, headCommit(r), fixed, ma) === shape(goal, headCommit(goal), fixed, mb);
}
