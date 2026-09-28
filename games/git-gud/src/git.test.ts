import { describe, expect, it } from 'vitest';
import { GitError, ancestors, headCommit, matches, reachable, repo, resolve, run, tokenize, type Repo } from './git';
import { LEVELS } from './levels';

const play = (r: Repo, ...lines: string[]) => lines.reduce((acc, l) => run(acc, l).repo, r);
const base = () => repo(['C0', 'C1:C0', 'C2:C1', 'C3:C1'], { main: 'C3', feature: 'C2' }, 'main');

describe('commands', () => {
  it('commits on the current branch, or on a detached HEAD', () => {
    const r = play(base(), 'git commit');
    expect(r.branches.main).toBe('C4');
    expect(r.commits.C4.parents).toEqual(['C3']);
    const d = play(base(), 'git checkout C1', 'git commit');
    expect(d.head).toEqual({ commit: 'C4' });
    expect(d.branches.main).toBe('C3');
  });

  it('resolves ids in any case, branches, HEAD~n and ^n', () => {
    const r = play(base(), 'git merge feature');
    expect(resolve(r, 'c2')).toBe('C2');
    expect(resolve(r, 'HEAD')).toBe('C4');
    expect(resolve(r, 'HEAD^2')).toBe('C2');
    expect(resolve(r, 'main~2')).toBe('C1');
    expect(() => resolve(r, 'nope')).toThrow(GitError);
  });

  it('fast-forwards when it can, and makes a merge commit when it must', () => {
    const ff = play(repo(['C0', 'C1:C0'], { main: 'C0', f: 'C1' }, 'main'), 'git merge f');
    expect(ff.branches.main).toBe('C1');
    const noff = play(repo(['C0', 'C1:C0'], { main: 'C0', f: 'C1' }, 'main'), 'git merge --no-ff f');
    expect(noff.commits[noff.branches.main].parents).toEqual(['C0', 'C1']);
    expect(run(base(), 'git merge C1').out).toEqual(['Already up to date.']);
  });

  it('rebases by copying commits, and skips patches upstream already has', () => {
    const r = play(base(), 'git switch feature', 'git rebase main');
    expect(r.branches.feature).toBe("C2'");
    expect(r.commits["C2'"].parents).toEqual(['C3']);
    const picked = play(base(), 'git cherry-pick C2', 'git switch feature', 'git rebase main');
    expect(picked.branches.feature).toBe(picked.branches.main);
  });

  it('refuses what git refuses', () => {
    expect(() => run(base(), 'git branch -d feature')).toThrow(/not fully merged/);
    expect(() => run(base(), 'git branch -d main')).toThrow(/used by HEAD/);
    expect(() => run(base(), 'git branch main')).toThrow(/already exists/);
    expect(() => run(base(), 'git switch C1')).toThrow(/branch is expected/);
    expect(() => run(base(), 'rm -rf /')).toThrow(/command not found/);
    expect(() => run(base(), 'git push')).toThrow(/not a git command/);
  });

  it('reverts with a new commit and keeps history', () => {
    const r = play(base(), 'git revert C1');
    expect(r.commits[r.branches.main].parents).toEqual(['C3']);
    expect(r.commits[r.branches.main].patch).toBe('revert C1');
  });

  it('forgets commits nothing points at', () => {
    const r = play(base(), 'git branch -D feature');
    expect(reachable(r).has('C2')).toBe(false);
    expect(ancestors(r, headCommit(r)).size).toBe(3);
  });

  it('never changes the repo it was given', () => {
    const r = base();
    const before = JSON.stringify(r);
    play(r, 'git commit', 'git switch feature', 'git rebase main', 'git branch -f main C0');
    expect(JSON.stringify(r)).toBe(before);
  });

  it('splits command lines like a shell', () => {
    expect(tokenize('git commit -m "fix the thing"')).toEqual(['git', 'commit', '-m', 'fix the thing']);
    expect(run(base(), 'git commit -m "x y"').repo.branches.main).toBe('C4');
  });
});

describe('levels', () => {
  it('have unique ids', () => {
    expect(new Set(LEVELS.map((l) => l.id)).size).toBe(LEVELS.length);
  });

  for (const level of LEVELS) {
    describe(level.id, () => {
      const goal = play(level.start, ...level.solution);

      it('is solved by its reference solution, and not before', () => {
        expect(matches(goal, goal, level.start)).toBe(true);
        expect(matches(level.start, goal, level.start)).toBe(false);
        let r = level.start;
        for (const line of level.solution.slice(0, -1)) {
          r = run(r, line).repo;
          expect(matches(r, goal, level.start), `already solved after "${line}"`).toBe(false);
        }
      });

      it('has every solution step change something', () => {
        let r = level.start;
        for (const line of level.solution) {
          const res = run(r, line);
          expect(res.changed, line).toBe(true);
          r = res.repo;
        }
      });
    });
  }

  it('accept another route to the same shape', () => {
    // commit on feature first, the id is different (C2 vs C3), the shape is the same
    const level = LEVELS.find((l) => l.id === 'branch-out')!;
    const goal = play(level.start, ...level.solution);
    const other = play(level.start, 'git branch feature', 'git checkout feature', 'git commit -m "my way"');
    expect(matches(other, goal, level.start)).toBe(true);
    // but not the wrong branch name
    expect(matches(play(level.start, 'git switch -c feat', 'git commit'), goal, level.start)).toBe(false);
  });
});
