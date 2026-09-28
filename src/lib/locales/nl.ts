import type en from './en';

export default {
  meta: {
    title: 'Play | kleine browsergames van Joey Oosenbrug',
    description:
      'Kleine browsergames, elk gebouwd met een andere frontend-stack: vanilla JS, Rust + WebAssembly, en er komen er meer. Een speeltuin om te voelen hoe frameworks zich verhouden bij hetzelfde soort project.',
    gameTitle: '{title} | Play',
    gameDescription: '{description} Gebouwd met {framework}.'
  },
  header: {
    home: 'joeyoosenbrug.nl',
    main: 'Hoofdmenu',
    language: 'Taal wijzigen',
    toLight: 'Schakel naar licht thema',
    toDark: 'Schakel naar donker thema',
    menu: 'Menu',
    skip: 'Naar de inhoud',
    games: 'Games',
    how: 'Hoe het werkt'
  },
  hero: {
    kicker: 'play.joeyoosenbrug.nl',
    title: 'Kleine games,',
    titleAccent: 'andere stacks.',
    intro:
      'Elke game hier is een eigen appje, gebouwd met een ander frontend-framework. Hetzelfde soort project, ander gereedschap, zodat ik het verschil voel in plaats van erover lees.'
  },
  games: {
    title: 'Games',
    builtWith: 'Gebouwd met',
    play: 'Spelen',
    next: 'Volgende game',
    nextDescription: 'Er komt nog een stack aan. React, Vue, Solid, Svelte, Angular: welke voelt het best voor een kleine game?',
    soon: 'binnenkort'
  },
  how: {
    title: 'Hoe het werkt',
    intro: 'Eén schil, veel stacks, niets gedeeld.',
    steps: [
      {
        title: 'De hub is alleen een schil',
        body: 'Deze pagina is SvelteKit, net als het portfolio. Hij tekent de header, het grid en de terugknop, en verder niets.'
      },
      {
        title: 'Elke game staat op zichzelf',
        body: 'Elke game woont in games/<slug>/ met een eigen package.json en een eigen bundler. Geen gedeelde code, geen gedeelde bundle.'
      },
      {
        title: 'Een iframe plakt het aan elkaar',
        body: 'Elke game bouwt naar /games/<slug>/ en draait in een iframe. Het voelt als onderdeel van de site, maar blijft volledig los.'
      }
    ],
    table: {
      caption: 'Welke game welke stack gebruikt',
      game: 'Game',
      framework: 'Framework',
      tooling: 'Buildtool'
    }
  },
  play: {
    back: 'terug naar games',
    frame: '{title}, gebouwd met {framework}',
    controls: 'Besturing',
    standalone: 'Open op een eigen pagina',
    focusHint: 'Klik op de game of druk op Tab om hem het toetsenbord te geven.'
  },
  footer: {
    tagline: 'Een speeltuin voor frontend-frameworks.',
    madeBy: 'Gemaakt door',
    source: 'Broncode',
    newTab: '(opent in een nieuw tabblad)'
  },
  error: {
    notFound: 'game niet gevonden',
    line: 'Deze game bestaat (nog) niet, of hij is weggerefactord.',
    home: 'terug naar games'
  }
} satisfies typeof en;
