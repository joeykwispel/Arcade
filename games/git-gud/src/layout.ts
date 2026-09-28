/**
 * Where each commit goes: columns by generation (left to right, oldest first), one row ("lane") per branch.
 * Pure, so the goal graph and the live graph are laid out the same way.
 */
import { type Repo, headCommit, reachable } from './git';

export interface Placed {
  id: string;
  col: number;
  lane: number;
}

export function layout(r: Repo): { placed: Map<string, Placed>; cols: number; lanes: number } {
  const visible = reachable(r);
  const col = new Map<string, number>();
  const colOf = (id: string): number => {
    const hit = col.get(id);
    if (hit !== undefined) return hit;
    const c = r.commits[id].parents.length ? 1 + Math.max(...r.commits[id].parents.map(colOf)) : 0;
    col.set(id, c);
    return c;
  };

  const lane = new Map<string, number>();
  let lanes = 0;
  /** Gives the first-parent chain from `tip` a lane, until it meets a commit that already has one. */
  const claim = (tip: string) => {
    let c: string | undefined = tip;
    let used = false;
    while (c && !lane.has(c)) {
      lane.set(c, lanes);
      used = true;
      c = r.commits[c].parents[0];
    }
    if (used) lanes++;
  };
  for (const tip of Object.values(r.branches)) claim(tip);
  claim(headCommit(r));
  // commits only reachable through the second parent of a merge (their branch was deleted)
  for (const id of [...visible].sort((a, b) => colOf(b) - colOf(a))) claim(id);

  const placed = new Map<string, Placed>();
  let cols = 0;
  for (const id of visible) {
    const c = colOf(id);
    cols = Math.max(cols, c + 1);
    placed.set(id, { id, col: c, lane: lane.get(id)! });
  }
  return { placed, cols, lanes: Math.max(lanes, 1) };
}
