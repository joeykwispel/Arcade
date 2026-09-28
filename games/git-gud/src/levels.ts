/**
 * The puzzles. Each one starts from a repo and has a reference solution: the goal is whatever that solution leaves
 * behind, and par is its length. Any other way to reach the same shape counts too.
 */
import { type Repo, repo } from './git';

export interface Level {
  id: string;
  chapter: 0 | 1 | 2;
  title: { en: string; nl: string };
  /** the story, and what to do */
  brief: { en: string; nl: string };
  /** shown after asking for a hint */
  hint: { en: string; nl: string };
  start: Repo;
  solution: string[];
}

export const CHAPTERS = [
  { en: 'Basics', nl: 'Basis' },
  { en: 'Branching', nl: 'Branches' },
  { en: 'Rewriting history', nl: 'Geschiedenis herschrijven' }
];

export const LEVELS: Level[] = [
  {
    id: 'first-commit',
    chapter: 0,
    title: { en: 'Hello, git', nl: 'Hallo, git' },
    brief: {
      en: 'A fresh repo with one commit. Make two more on main. Every commit is a save point you can come back to.',
      nl: 'Een verse repo met één commit. Maak er nog twee op main. Elke commit is een savepoint waar je naar terug kunt.'
    },
    hint: { en: 'Type git commit, twice.', nl: 'Typ twee keer git commit.' },
    start: repo(['C0'], { main: 'C0' }, 'main'),
    solution: ['git commit', 'git commit']
  },
  {
    id: 'branch-out',
    chapter: 0,
    title: { en: 'Branch out', nl: 'Aftakken' },
    brief: {
      en: "Don't work on main directly. Start a branch called feature and commit your work there.",
      nl: 'Werk niet direct op main. Maak een branch feature en commit je werk daar.'
    },
    hint: {
      en: 'git switch -c feature creates the branch and moves you onto it. Then git commit.',
      nl: 'git switch -c feature maakt de branch en zet je erop. Daarna git commit.'
    },
    start: repo(['C0', 'C1:C0'], { main: 'C1' }, 'main'),
    solution: ['git switch -c feature', 'git commit']
  },
  {
    id: 'merge',
    chapter: 0,
    title: { en: 'Merge it', nl: 'Mergen' },
    brief: {
      en: 'main and feature went different ways. Bring feature into main with a merge commit.',
      nl: 'main en feature zijn elk hun eigen kant op gegaan. Haal feature binnen in main met een merge commit.'
    },
    hint: { en: "You're on main already: git merge feature.", nl: 'Je staat al op main: git merge feature.' },
    start: repo(['C0', 'C1:C0', 'C2:C1', 'C3:C1'], { main: 'C3', feature: 'C2' }, 'main'),
    solution: ['git merge feature']
  },
  {
    id: 'fast-forward',
    chapter: 0,
    title: { en: 'Fast-forward', nl: 'Fast-forward' },
    brief: {
      en: "feature is done and main didn't move in the meantime. Merge it (no merge commit needed) and delete the branch.",
      nl: 'feature is af en main is intussen niet veranderd. Merge hem (zonder merge commit) en verwijder de branch.'
    },
    hint: {
      en: 'git merge feature just moves main forward. Then git branch -d feature.',
      nl: 'git merge feature schuift main gewoon door. Daarna git branch -d feature.'
    },
    start: repo(['C0', 'C1:C0', 'C2:C1', 'C3:C2'], { main: 'C1', feature: 'C3' }, 'main'),
    solution: ['git merge feature', 'git branch -d feature']
  },
  {
    id: 'hotfix',
    chapter: 1,
    title: { en: 'Hotfix', nl: 'Hotfix' },
    brief: {
      en: "Production is on fire while you're halfway through a feature. Fix it on a hotfix branch from main, merge that into main, and clean up.",
      nl: 'Productie staat in brand terwijl je halverwege een feature zit. Fix het op een branch hotfix vanaf main, merge die in main en ruim op.'
    },
    hint: {
      en: 'git switch -c hotfix main, commit, switch to main, merge hotfix, delete hotfix.',
      nl: 'git switch -c hotfix main, commit, switch naar main, merge hotfix, verwijder hotfix.'
    },
    start: repo(['C0', 'C1:C0', 'C2:C1', 'C3:C2'], { main: 'C1', feature: 'C3' }, 'feature'),
    solution: ['git switch -c hotfix main', 'git commit', 'git switch main', 'git merge hotfix', 'git branch -d hotfix']
  },
  {
    id: 'detached',
    chapter: 1,
    title: { en: 'Time travel', nl: 'Tijdreizen' },
    brief: {
      en: 'Something broke after C1. Go back to C1, start a branch bisect there and make a commit to test a theory.',
      nl: 'Na C1 ging er iets stuk. Ga terug naar C1, begin daar een branch bisect en maak een commit om een theorie te testen.'
    },
    hint: {
      en: 'A branch can start at any commit: git switch -c bisect C1. (Click a commit to type its id.)',
      nl: 'Een branch kan bij elke commit beginnen: git switch -c bisect C1. (Klik op een commit om zijn id te typen.)'
    },
    start: repo(['C0', 'C1:C0', 'C2:C1', 'C3:C2'], { main: 'C3' }, 'main'),
    solution: ['git switch -c bisect C1', 'git commit']
  },
  {
    id: 'wrong-branch',
    chapter: 1,
    title: { en: 'Wrong branch', nl: 'Verkeerde branch' },
    brief: {
      en: 'Oops: C2 and C3 went straight onto main. Move them to a new branch feature and put main back on C1.',
      nl: 'Oeps: C2 en C3 staan direct op main. Zet ze op een nieuwe branch feature en zet main terug op C1.'
    },
    hint: {
      en: 'git branch feature keeps the work, git reset --hard HEAD~2 moves main back, then switch to feature.',
      nl: 'git branch feature bewaart het werk, git reset --hard HEAD~2 zet main terug, daarna switch naar feature.'
    },
    start: repo(['C0', 'C1:C0', 'C2:C1', 'C3:C2'], { main: 'C3' }, 'main'),
    solution: ['git branch feature', 'git reset --hard HEAD~2', 'git switch feature']
  },
  {
    id: 'no-ff',
    chapter: 1,
    title: { en: 'Keep the bubble', nl: 'Houd de bubbel' },
    brief: {
      en: 'Your team wants every feature visible as its own bubble in the history, even when a fast-forward is possible. Merge feature into main with a merge commit.',
      nl: 'Je team wil elke feature als eigen bubbel in de geschiedenis zien, ook als een fast-forward kan. Merge feature in main met een merge commit.'
    },
    hint: { en: 'git merge --no-ff feature', nl: 'git merge --no-ff feature' },
    start: repo(['C0', 'C1:C0', 'C2:C1', 'C3:C2'], { main: 'C1', feature: 'C3' }, 'main'),
    solution: ['git merge --no-ff feature']
  },
  {
    id: 'rebase',
    chapter: 2,
    title: { en: 'A straight line', nl: 'Een rechte lijn' },
    brief: {
      en: 'No merge commits allowed here. Replay feature on top of main, then fast-forward main to it.',
      nl: 'Merge commits zijn hier niet toegestaan. Speel feature opnieuw af bovenop main en schuif main daarna door.'
    },
    hint: {
      en: "You're on feature: git rebase main. Then git switch main and git merge feature.",
      nl: 'Je staat op feature: git rebase main. Daarna git switch main en git merge feature.'
    },
    start: repo(['C0', 'C1:C0', 'C2:C1', 'C3:C1', 'C4:C3'], { main: 'C2', feature: 'C4' }, 'feature'),
    solution: ['git rebase main', 'git switch main', 'git merge feature']
  },
  {
    id: 'cherry-pick',
    chapter: 2,
    title: { en: 'Cherry picking', nl: 'Krenten uit de pap' },
    brief: {
      en: 'C3 on the experiment branch fixes a real bug. The rest is half-baked. Get just C3 onto main.',
      nl: 'C3 op de branch experiment fixt een echte bug. De rest is half af. Zet alleen C3 op main.'
    },
    hint: { en: 'git switch main, then git cherry-pick C3.', nl: 'git switch main, daarna git cherry-pick C3.' },
    start: repo(['C0', 'C1:C0', 'C2:C1', 'C3:C2', 'C4:C3'], { main: 'C1', experiment: 'C4' }, 'experiment'),
    solution: ['git switch main', 'git cherry-pick C3']
  },
  {
    id: 'revert',
    chapter: 2,
    title: { en: 'Undo in public', nl: 'Openbaar terugdraaien' },
    brief: {
      en: "C2 broke production, and main is already pushed, so you can't rewrite it. Undo C2 with a new commit instead.",
      nl: 'C2 heeft productie gesloopt, en main is al gepusht, dus herschrijven mag niet. Draai C2 terug met een nieuwe commit.'
    },
    hint: { en: 'git revert C2', nl: 'git revert C2' },
    start: repo(['C0', 'C1:C0', 'C2:C1', 'C3:C2'], { main: 'C3' }, 'main'),
    solution: ['git revert C2']
  },
  {
    id: 'stacked',
    chapter: 2,
    title: { en: 'Stacked branches', nl: 'Gestapelde branches' },
    brief: {
      en: 'part-2 builds on part-1, and main moved on. Rebase part-1 onto main, then part-2 onto part-1. Git skips work that is already there.',
      nl: 'part-2 bouwt voort op part-1, en main is verder gegaan. Rebase part-1 op main, en daarna part-2 op part-1. Git slaat werk over dat er al is.'
    },
    hint: {
      en: 'git rebase main part-1, then git rebase part-1 part-2. (With two arguments rebase switches first.)',
      nl: 'git rebase main part-1, daarna git rebase part-1 part-2. (Met twee argumenten switcht rebase eerst.)'
    },
    start: repo(['C0', 'C1:C0', 'C2:C1', 'C3:C2', 'C4:C3', 'C5:C1'], { main: 'C5', 'part-1': 'C3', 'part-2': 'C4' }, 'main'),
    solution: ['git rebase main part-1', 'git rebase part-1 part-2']
  },
  {
    id: 'friday',
    chapter: 2,
    title: { en: 'Friday cleanup', nl: 'Vrijdag opruimen' },
    brief: {
      en: 'Before the weekend: get the hotfix and the feature onto main in one straight line, feature last, and delete both branches. You end on main.',
      nl: 'Voor het weekend: zet de hotfix en de feature in één rechte lijn op main, feature als laatste, en verwijder beide branches. Je eindigt op main.'
    },
    hint: {
      en: 'Fast-forward main to hotfix, rebase feature onto main, fast-forward main to feature, delete both.',
      nl: 'Schuif main door naar hotfix, rebase feature op main, schuif main door naar feature, verwijder beide.'
    },
    start: repo(['C0', 'C1:C0', 'C2:C1', 'C3:C1', 'C4:C3', 'C5:C2'], { main: 'C2', feature: 'C4', hotfix: 'C5' }, 'main'),
    solution: ['git merge hotfix', 'git rebase main feature', 'git switch main', 'git merge feature', 'git branch -d feature hotfix']
  }
];
