/** The game's own text in English and Dutch. Git's output stays English, like the real thing. */
export type Lang = 'en' | 'nl';

export const isLang = (v: unknown): v is Lang => v === 'en' || v === 'nl';

export const text = {
  en: {
    tagline: 'A git puzzle game. Get the commit graph into shape with real git commands.',
    how: 'Type commands in the terminal, or click a commit or branch to type its name. Match the goal in as few moves as you can.',
    levels: 'levels',
    locked: 'locked',
    back: 'levels',
    moves: 'moves',
    par: 'par',
    yourRepo: 'your repo',
    goal: 'goal',
    hint: 'hint',
    undo: 'undo',
    restart: 'restart',
    solved: 'Level solved',
    underPar: 'Under par. Nice.',
    atPar: 'Right on par.',
    overPar: 'Par is {par}: can you do it in fewer?',
    next: 'next level',
    replay: 'replay',
    allDone: 'All levels done. You may now call yourself a git wizard.',
    placeholder: 'git commit',
    terminalLabel: 'git command',
    help: 'Try: git commit, git switch -c <name>, git merge <branch>, git rebase <branch>, git cherry-pick <commit>, git reset --hard <ref>, git revert <commit>. Also: undo, hint, clear.',
    graphLabel: 'Commit graph: {summary}',
    solvedSay: 'Solved in {moves} moves, {stars} of 3 stars.',
    startSay: 'Level {n}: {title}. {brief}'
  },
  nl: {
    tagline: 'Een git-puzzelspel. Krijg de commit graph in vorm met echte git commands.',
    how: 'Typ commands in de terminal, of klik op een commit of branch om zijn naam te typen. Haal het doel in zo weinig mogelijk zetten.',
    levels: 'levels',
    locked: 'op slot',
    back: 'levels',
    moves: 'zetten',
    par: 'par',
    yourRepo: 'jouw repo',
    goal: 'doel',
    hint: 'hint',
    undo: 'undo',
    restart: 'opnieuw',
    solved: 'Level opgelost',
    underPar: 'Onder par. Netjes.',
    atPar: 'Precies op par.',
    overPar: 'Par is {par}: lukt het in minder?',
    next: 'volgend level',
    replay: 'opnieuw',
    allDone: 'Alle levels gehaald. Je mag jezelf nu git-tovenaar noemen.',
    placeholder: 'git commit',
    terminalLabel: 'git command',
    help: 'Probeer: git commit, git switch -c <naam>, git merge <branch>, git rebase <branch>, git cherry-pick <commit>, git reset --hard <ref>, git revert <commit>. Ook: undo, hint, clear.',
    graphLabel: 'Commit graph: {summary}',
    solvedSay: 'Opgelost in {moves} zetten, {stars} van 3 sterren.',
    startSay: 'Level {n}: {title}. {brief}'
  }
} satisfies Record<Lang, Record<string, string>>;

export type Text = (typeof text)['en'];

export const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k) => String(vars[k] ?? m));
