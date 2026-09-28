import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { COMMAND_NAMES, GitError, headCommit, matches, reachable, run, type Repo } from './git';
import { Graph } from './Graph';
import { CHAPTERS, LEVELS, type Level } from './levels';
import { type Lang, fill, isLang, text } from './i18n';

const STARS_KEY = 'play:git-gud:stars';

const store = {
  get(key: string) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* private mode: progress just won't stick */
    }
  }
};

const loadStars = () => {
  const saved = (store.get(STARS_KEY) ?? '').split(',').map(Number);
  return LEVELS.map((_, i) => Math.min(3, saved[i] || 0));
};

const starsFor = (moves: number, par: number) => (moves <= par ? 3 : moves <= par + 2 ? 2 : 1);
const starStr = (n: number) => '★'.repeat(n) + '☆'.repeat(3 - n);
const unlocked = (stars: number[], i: number) => i === 0 || stars[i - 1] > 0;

function summary(r: Repo) {
  const refs = Object.entries(r.branches).map(([b, c]) => `${b} at ${c}`);
  const head = 'branch' in r.head ? `HEAD on ${r.head.branch}` : `HEAD detached at ${r.head.commit}`;
  return [...refs, head].join(', ');
}

export function App({ initialLang }: { initialLang: Lang }) {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [stars, setStars] = useState(loadStars);
  const [level, setLevel] = useState<number | null>(null);
  const [say, setSay] = useState('');
  const t = text[lang];

  // language from the hub (optional); the theme is handled in main.tsx
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.data?.type !== 'play:settings') return;
      if (isLang(e.data.lang)) setLang(e.data.lang);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const solved = (i: number, n: number) => {
    setStars((s) => {
      const next = s.map((v, k) => (k === i ? Math.max(v, n) : v));
      store.set(STARS_KEY, next.join(','));
      return next;
    });
  };

  const open = (i: number) => {
    setLevel(i);
    const l = LEVELS[i];
    setSay(fill(t.startSay, { n: i + 1, title: l.title[lang], brief: l.brief[lang] }));
  };

  return (
    <div className="app" data-screen={level === null ? 'menu' : 'level'}>
      {level === null ? (
        <Menu lang={lang} stars={stars} onOpen={open} />
      ) : (
        <Play
          key={level}
          lang={lang}
          index={level}
          onBack={() => setLevel(null)}
          onNext={() => (level + 1 < LEVELS.length ? open(level + 1) : setLevel(null))}
          onSolved={(n) => solved(level, n)}
          onSay={setSay}
        />
      )}
      <p className="sr-only" aria-live="polite">
        {say}
      </p>
    </div>
  );
}

/* ---------- level select ---------- */

function Menu({ lang, stars, onOpen }: { lang: Lang; stars: number[]; onOpen: (i: number) => void }) {
  const t = text[lang];
  return (
    <main className="menu">
      <header className="menu-head">
        <p className="comment">$ git log --oneline --graph</p>
        <h1>
          git gud
          <span className="caret" aria-hidden="true" />
        </h1>
        <p className="tagline">{t.tagline}</p>
        <p className="how">{t.how}</p>
      </header>
      {CHAPTERS.map((ch, c) => (
        <section key={c} className="chapter">
          <h2>
            <span className="num">{c + 1}.</span> {ch[lang]}
          </h2>
          <ol className="level-list">
            {LEVELS.map((l, i) =>
              l.chapter !== c ? null : (
                <li key={l.id}>
                  <button className="level-card" disabled={!unlocked(stars, i)} onClick={() => onOpen(i)}>
                    <span className="n">{String(i + 1).padStart(2, '0')}</span>
                    <span className="title">{l.title[lang]}</span>
                    <span className={stars[i] ? 'stars got' : 'stars'} aria-label={`${stars[i]}/3`}>
                      {unlocked(stars, i) ? starStr(stars[i]) : t.locked}
                    </span>
                  </button>
                </li>
              )
            )}
          </ol>
        </section>
      ))}
      {stars.every((s) => s > 0) && <p className="all-done">{t.allDone}</p>}
    </main>
  );
}

/* ---------- one level ---------- */

type Line = { text: string; kind: 'cmd' | 'out' | 'err' | 'info' };

interface PlayProps {
  lang: Lang;
  index: number;
  onBack: () => void;
  onNext: () => void;
  onSolved: (stars: number) => void;
  onSay: (s: string) => void;
}

function Play({ lang, index, onBack, onNext, onSolved, onSay }: PlayProps) {
  const t = text[lang];
  const level: Level = LEVELS[index];
  const par = level.solution.length;
  const goal = useMemo(() => level.solution.reduce((r, l) => run(r, l).repo, level.start), [level]);
  const original = useMemo(() => new Set(Object.keys(level.start.commits)), [level]);

  const [history, setHistory] = useState<Repo[]>([level.start]);
  const [lines, setLines] = useState<Line[]>([{ text: level.brief[lang], kind: 'info' }]);
  const [input, setInput] = useState('');
  const [typed, setTyped] = useState<string[]>([]);
  const [recall, setRecall] = useState(-1);
  const [done, setDone] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const repo = history[history.length - 1];
  const moves = history.length - 1;

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [lines]);
  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true });
  }, []);

  const print = (...add: Line[]) => setLines((l) => [...l, ...add].slice(-200));

  const undo = () => {
    if (history.length > 1) {
      setHistory((h) => h.slice(0, -1));
      print({ text: 'undo', kind: 'info' });
    }
  };
  const restart = () => {
    setHistory([level.start]);
    setDone(null);
    setLines([{ text: level.brief[lang], kind: 'info' }]);
  };
  const hint = () => print({ text: `hint: ${level.hint[lang]}`, kind: 'info' });

  function submit(raw: string) {
    const line = raw.trim();
    setInput('');
    setRecall(-1);
    if (!line) return;
    setTyped((h) => [...h.filter((x) => x !== line), line]);
    print({ text: line, kind: 'cmd' });
    if (line === 'clear') return setLines([]);
    if (line === 'undo') return undo();
    if (line === 'hint') return hint();
    if (line === 'restart') return restart();
    if (line === 'help') return print({ text: t.help, kind: 'info' });
    if (done !== null) return;
    try {
      const res = run(repo, line);
      print(...res.out.map((text): Line => ({ text, kind: 'out' })));
      if (!res.changed) return;
      setHistory((h) => [...h, res.repo]);
      if (matches(res.repo, goal, level.start)) {
        const n = starsFor(moves + 1, par);
        setDone(n);
        onSolved(n);
        onSay(fill(t.solvedSay, { moves: moves + 1, stars: n }));
      }
    } catch (e) {
      if (!(e instanceof GitError)) throw e;
      print({ text: e.message, kind: 'err' });
    }
  }

  /** Tab: completes a git command, then branch names and commit ids. */
  function complete() {
    const words = input.split(' ');
    const last = words[words.length - 1];
    const pool =
      words.length === 2 && words[0] === 'git'
        ? COMMAND_NAMES
        : words.length === 1
          ? ['git', 'undo', 'hint', 'clear', 'restart', 'help']
          : [...Object.keys(repo.branches), ...reachable(repo), 'HEAD'];
    const hits = pool.filter((p) => p.toLowerCase().startsWith(last.toLowerCase()));
    if (hits.length === 1) setInput([...words.slice(0, -1), hits[0]].join(' ') + ' ');
    else if (hits.length > 1) print({ text: hits.join('  '), kind: 'out' });
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      submit(input);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      complete();
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (!typed.length) return;
      const i = e.key === 'ArrowUp' ? (recall < 0 ? typed.length - 1 : Math.max(0, recall - 1)) : recall < 0 ? -1 : recall + 1;
      if (i >= typed.length || i < 0) {
        setRecall(-1);
        setInput('');
      } else {
        setRecall(i);
        setInput(typed[i]);
      }
    } else if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !input) {
      e.preventDefault();
      undo();
    }
  }

  const insert = (word: string) => {
    setInput((v) => (v === '' ? `git ${word}` : v.endsWith(' ') ? v + word : `${v} ${word}`));
    inputRef.current?.focus();
  };
  const chip = (cmd: string) => {
    setInput(`git ${cmd}`);
    inputRef.current?.focus();
  };

  const where = 'branch' in repo.head ? repo.head.branch : headCommit(repo);

  return (
    <main className="play" data-solved={done !== null}>
      <header className="bar">
        <button className="btn ghost" onClick={onBack}>
          <span aria-hidden="true">←</span> {t.back}
        </button>
        <h1>
          <span className="n">{String(index + 1).padStart(2, '0')}</span> {level.title[lang]}
        </h1>
        <p className="score">
          {t.moves} <b data-testid="moves">{moves}</b> · {t.par} <b>{par}</b>
        </p>
        <div className="actions">
          <button className="btn" onClick={hint}>
            {t.hint}
          </button>
          <button className="btn" onClick={undo} disabled={moves === 0}>
            {t.undo}
          </button>
          <button className="btn" onClick={restart}>
            {t.restart}
          </button>
        </div>
      </header>

      <section className="board">
        <figure className="panel live">
          <figcaption>{t.yourRepo}</figcaption>
          <Graph repo={repo} original={original} animate label={fill(t.graphLabel, { summary: summary(repo) })} onPick={insert} />
        </figure>
        <aside className="side">
          <figure className="panel goal">
            <figcaption>{t.goal}</figcaption>
            <Graph repo={goal} original={original} label={fill(t.graphLabel, { summary: summary(goal) })} />
          </figure>
          <p className="brief">{level.brief[lang]}</p>
        </aside>
      </section>

      <section className="terminal" onClick={() => inputRef.current?.focus()}>
        <div className="log" ref={logRef} role="log" aria-live="polite">
          {lines.map((l, i) => (
            <p key={i} className={l.kind}>
              {l.kind === 'cmd' && <span className="prompt">$ </span>}
              {l.text}
            </p>
          ))}
        </div>
        <div className="chips" role="group" aria-label="git">
          {['commit', 'switch ', 'switch -c ', 'merge ', 'rebase ', 'cherry-pick ', 'reset --hard ', 'revert ', 'branch -d '].map((c) => (
            <button key={c} className="chip" onClick={() => chip(c)} tabIndex={-1}>
              {c.trim()}
            </button>
          ))}
        </div>
        <label className="input-row">
          <span className="prompt">
            <span className="path">~/repo</span> <span className="branch">({where})</span> $
          </span>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder={t.placeholder}
            aria-label={t.terminalLabel}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>
      </section>

      {done !== null && (
        <div className="dialog-backdrop">
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="solved-title">
            <p className="comment">$ git status</p>
            <h2 id="solved-title">✓ {t.solved}</h2>
            <p className="big-stars">{starStr(done)}</p>
            <p className="result">
              {t.moves} {moves} · {t.par} {par}
            </p>
            <p className="note">{moves < par ? t.underPar : moves === par ? t.atPar : fill(t.overPar, { par })}</p>
            <div className="row">
              <button className="btn primary" onClick={onNext} autoFocus>
                {index + 1 < LEVELS.length ? t.next : t.back}
              </button>
              <button className="btn" onClick={restart}>
                {t.replay}
              </button>
              <button className="btn" onClick={onBack}>
                {t.back}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
