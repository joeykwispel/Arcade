/**
 * The commit graph as SVG. Commits glide to their new place after every command (new ones grow out of their
 * parent), so a rebase visibly moves work from one branch to another.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { type Repo, headCommit } from './git';
import { layout } from './layout';

const GAP_X = 70;
const GAP_Y = 66;
const PAD_X = 40;
const PAD_TOP = 58;
const R = 15;
const DURATION = 380;

type Point = { x: number; y: number };

interface Props {
  repo: Repo;
  /** the commits the level started with, drawn plain; everything else is new work */
  original: Set<string>;
  label: string;
  animate?: boolean;
  /** click a commit or branch: its name goes into the terminal */
  onPick?: (name: string) => void;
}

const ease = (t: number) => 1 - (1 - t) ** 3;

/** Moves every commit from where it is drawn now to its new place. */
function useTween(targets: Map<string, Point>, parents: (id: string) => string[], animate: boolean) {
  const [shown, setShown] = useState(targets);
  const current = useRef(targets);
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!animate || reduce) {
      current.current = targets;
      setShown(targets);
      return;
    }
    const from = new Map<string, Point>();
    for (const [id, p] of targets) {
      const was =
        current.current.get(id) ??
        parents(id)
          .map((q) => current.current.get(q) ?? targets.get(q))
          .find(Boolean) ??
        p;
      from.set(id, was);
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const k = ease(Math.min(1, (now - t0) / DURATION));
      const next = new Map<string, Point>();
      for (const [id, p] of targets) {
        const f = from.get(id)!;
        next.set(id, { x: f.x + (p.x - f.x) * k, y: f.y + (p.y - f.y) * k });
      }
      current.current = next;
      setShown(next);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // `parents` changes every render; the targets are what matter
  }, [targets, animate]);
  return shown;
}

export function Graph({ repo, original, label, animate = false, onPick }: Props) {
  const { placed, cols, lanes } = useMemo(() => layout(repo), [repo]);
  const targets = useMemo(() => toPoints(placed), [placed]);
  const pos = useTween(targets, (id) => repo.commits[id]?.parents ?? [], animate);

  const head = headCommit(repo);
  const headBranch = 'branch' in repo.head ? repo.head.branch : null;
  const width = PAD_X * 2 + Math.max(cols - 1, 1) * GAP_X;
  const height = PAD_TOP + (lanes - 1) * GAP_Y + R + 22;
  const labels = new Map<string, string[]>();
  for (const [name, id] of Object.entries(repo.branches)) labels.set(id, [...(labels.get(id) ?? []), name]);
  if (!headBranch) labels.set(head, ['HEAD', ...(labels.get(head) ?? [])]);

  const pick = (name: string) => onPick && (() => onPick(name));
  const kind = (id: string) => {
    const c = repo.commits[id];
    if (c.parents.length > 1) return 'merge';
    if (c.patch.startsWith('revert ')) return 'revert';
    if (id.endsWith("'")) return 'copy';
    return original.has(id) ? 'old' : 'new';
  };

  return (
    <svg className="graph" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
      <g className="edges">
        {[...placed.keys()].flatMap((id) =>
          repo.commits[id].parents
            .filter((p) => pos.has(p))
            .map((p, i) => {
              const a = pos.get(p)!;
              const b = pos.get(id);
              if (!b) return null;
              const mid = (a.x + b.x) / 2;
              const d = a.y === b.y ? `M${a.x},${a.y}L${b.x},${b.y}` : `M${a.x},${a.y}C${mid},${a.y} ${mid},${b.y} ${b.x},${b.y}`;
              return <path key={`${p}-${id}`} d={d} className={i ? 'edge second' : 'edge'} />;
            })
        )}
      </g>
      {[...placed.keys()].map((id) => {
        const p = pos.get(id);
        if (!p) return null;
        const names = labels.get(id) ?? [];
        return (
          <g key={id} transform={`translate(${p.x},${p.y})`}>
            {id === head && <circle r={R + 5} className="head-ring" />}
            <g className={`commit ${kind(id)}${onPick ? ' pickable' : ''}`} onClick={pick(id)}>
              <circle r={R} />
              {kind(id) === 'merge' && <circle r={R - 4} className="inner" />}
              <text dy="0.35em">{id}</text>
            </g>
            {names.map((name, i) => {
              const w = name.length * 7.2 + (name === headBranch ? 26 : 14);
              const y = -R - 14 - i * 20;
              return (
                <g
                  key={name}
                  className={`ref${name === 'HEAD' ? ' detached' : ''}${name === headBranch ? ' current' : ''}${onPick && name !== 'HEAD' ? ' pickable' : ''}`}
                  transform={`translate(0,${y})`}
                  onClick={name === 'HEAD' ? undefined : pick(name)}
                >
                  <rect x={-w / 2} y={-9} width={w} height={18} rx={9} />
                  <text dy="0.35em">{name === headBranch ? `* ${name}` : name}</text>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

function toPoints(placed: ReturnType<typeof layout>['placed']) {
  const m = new Map<string, Point>();
  for (const p of placed.values()) m.set(p.id, { x: PAD_X + p.col * GAP_X, y: PAD_TOP + p.lane * GAP_Y });
  return m;
}
