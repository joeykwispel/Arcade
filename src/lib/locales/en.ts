/** Every piece of hub text in English. nl.ts must have the same shape (checked by TypeScript and locales.test.ts). */
export default {
  meta: {
    title: 'Play | small browser games by Joey Oosenbrug',
    description:
      'Small browser games, each built with a different frontend stack: vanilla JS, Rust + WebAssembly, React, Kotlin, ReScript, Elm, Lua, C++, Gleam, Flutter, Python, Godot, Go, Ruby, Zig, Vue, Solid, ClojureScript, SQL, C#, F#, plain HTML and CSS, and more to come. A playground for comparing how frameworks feel on the same kind of project.',
    gameTitle: '{title} | Play',
    gameDescription: '{description} Built with {framework}.'
  },
  header: {
    home: 'joeyoosenbrug.nl',
    main: 'Main',
    language: 'Switch language',
    toLight: 'Switch to light theme',
    toDark: 'Switch to dark theme',
    menu: 'Menu',
    skip: 'Skip to content',
    games: 'Games',
    how: 'How it works'
  },
  hero: {
    kicker: 'arcade.joeyoosenbrug.nl',
    title: 'Small games,',
    titleAccent: 'different stacks.',
    intro:
      'Every game here is its own little app, built with a different frontend framework. Same kind of project, different tools, so I can feel the difference instead of reading about it.'
  },
  games: {
    title: 'Games',
    builtWith: 'Built with',
    play: 'Play',
    next: 'Next game',
    nextDescription: 'Another stack is on its way. React, Vue, Solid, Svelte, Angular: which one feels best for a tiny game?',
    soon: 'coming soon'
  },
  upcoming: {
    title: 'Coming soon',
    intro: 'Planned next, each in a stack this hub has not used yet.'
  },
  how: {
    title: 'How it works',
    intro: 'One shell, many stacks, nothing shared between them.',
    steps: [
      {
        title: 'The hub is just a shell',
        body: 'This page is SvelteKit, like the portfolio. It draws the header, the grid and the back link, and nothing else.'
      },
      {
        title: 'Every game stands alone',
        body: 'Each game lives in games/<slug>/ with its own package.json and its own bundler. No shared code, no shared bundle.'
      },
      {
        title: 'An iframe glues them together',
        body: 'Each game builds to /games/<slug>/ and runs in an iframe, so it looks like part of the site but stays fully isolated.'
      }
    ],
    table: {
      caption: 'Which game uses which stack',
      game: 'Game',
      framework: 'Framework',
      tooling: 'Build tool'
    }
  },
  play: {
    back: 'back to games',
    frame: '{title}, built with {framework}',
    controls: 'Controls',
    standalone: 'Open on its own page',
    focusHint: 'Click the game or press Tab to give it the keyboard.'
  },
  footer: {
    tagline: 'A playground for frontend frameworks.',
    madeBy: 'Made by',
    source: 'Source',
    newTab: '(opens in a new tab)'
  },
  error: {
    notFound: 'game not found',
    line: 'This game does not exist (yet), or it got refactored away.',
    home: 'back to games'
  }
};
