/** Every word Deploy Tycoon shows, in English and Dutch. */
import type { GenId, RoundId } from './engine';

export type Lang = 'en' | 'nl';
export const isLang = (v: unknown): v is Lang => v === 'en' || v === 'nl';

export interface Text {
  title: string;
  tagline: string;
  cash: string;
  perSec: string;
  push: string;
  perPush: string;
  team: string;
  upgrades: string;
  noUpgrades: string;
  owned: string;
  each: string;
  buyMode: string;
  max: string;
  feed: string;
  stats: string;
  clicks: string;
  played: string;
  options: string;
  optionsBonus: string;
  ipo: string;
  ipoDesc: string;
  ipoLocked: string;
  ipoConfirm: string;
  cancel: string;
  welcome: string;
  welcomeDesc: string;
  nice: string;
  reset: string;
  resetConfirm: string;
  incidentFix: string;
  incidentDesc: string;
  incidentAuto: string;
  resolved: string;
  autoResolved: string;
  newRound: string;
  bought: string;
  gens: Record<GenId, [string, string]>;
  tiers: [string, string, string, string];
  tierDesc: string;
  specials: Record<string, [string, string]>;
  rounds: Record<RoundId, string>;
  news: string[];
  incidents: string[];
}

export const text: Record<Lang, Text> = {
  en: {
    title: 'Deploy Tycoon',
    tagline: 'From a laptop in a garage to an IPO.',
    cash: 'cash',
    perSec: '/s',
    push: '$ git push',
    perPush: '+${n} per push',
    team: 'team & infra',
    upgrades: 'upgrades',
    noUpgrades: 'Nothing to buy yet. Keep shipping.',
    owned: 'owned',
    each: 'each',
    buyMode: 'buy',
    max: 'max',
    feed: 'feed',
    stats: 'stats',
    clicks: 'pushes',
    played: 'played',
    options: 'stock options',
    optionsBonus: '+{p}% on all income',
    ipo: 'Go public (IPO)',
    ipoDesc: 'Start a new company and keep {n} new stock options: +{p}% on all income, forever.',
    ipoLocked: 'Reach ${n} this run to go public.',
    ipoConfirm: 'Ring the bell',
    cancel: 'cancel',
    welcome: 'Welcome back',
    welcomeDesc: 'While you were away for {time}, your team earned ${n}.',
    nice: 'nice',
    reset: 'rm -rf company',
    resetConfirm: 'Really? Everything goes, stock options too.',
    incidentFix: 'git revert HEAD',
    incidentDesc: 'Income is down to 20% until you roll back.',
    incidentAuto: 'Your on-call SRE is on it.',
    resolved: '✓ Rolled back. Prod is up.',
    autoResolved: '✓ The SRE rolled it back. Prod is up.',
    newRound: '🎉 {round} closed!',
    bought: '+ {n}× {name}',
    gens: {
      intern: ['Intern', 'Fixes typos. Eats all the snacks.'],
      junior: ['Junior dev', 'Ships fast. Asks a lot.'],
      senior: ['Senior dev', 'Says "it depends". Is right.'],
      lead: ['Tech lead', 'Turns meetings into roadmaps.'],
      ci: ['CI pipeline', 'Deploys while you sleep.'],
      k8s: ['Kubernetes cluster', 'Nobody knows how it works. It works.'],
      agent: ['AI agent', 'Writes code, reviews its own code.'],
      datacenter: ['Datacenter', 'Your own cloud. Heats a small town.']
    },
    tiers: ['Onboarding', 'Mentoring', 'Promotions', 'Stock grants'],
    tierDesc: '{name}: twice the output.',
    specials: {
      keyboard: ['Mechanical keyboard', 'git push earns twice as much.'],
      vim: ['Vim keybindings', 'git push earns twice as much again.'],
      copilot: ['Copilot', 'Every push also earns 5% of your income per second.'],
      monorepo: ['Monorepo', 'Another 5% of income per second on every push.'],
      coffee: ['Coffee machine', '+10% on all income.'],
      desks: ['Standing desks', '+10% on all income.'],
      remote: ['Remote work', '+20% on all income.'],
      fourday: ['Four-day week', '+25% on all income.'],
      sre: ['On-call SRE', 'Rolls back incidents by itself after 10 seconds.'],
      chaos: ['Chaos engineering', 'Half as many incidents.']
    },
    rounds: { garage: '~/garage', seed: 'Seed round', seriesA: 'Series A', seriesB: 'Series B', seriesC: 'Series C', unicorn: 'Unicorn' },
    news: [
      'Front page of Hacker News!',
      'A tweet about you went viral.',
      'A big client signed a three-year deal.',
      'Your open source repo hit 10k stars.',
      'A YouTuber reviewed your product. Positively.',
      'Your conference talk got a standing ovation.',
      'The competitor went down. Everyone came to you.',
      'Someone called your API "actually pleasant".'
    ],
    incidents: [
      'Production is down!',
      'The database is on fire.',
      "DNS. It's always DNS.",
      'Someone deployed on a Friday.',
      'The TLS certificate expired.',
      'The intern ran DROP TABLE.'
    ]
  },
  nl: {
    title: 'Deploy Tycoon',
    tagline: 'Van een laptop in een garage naar een beursgang.',
    cash: 'kas',
    perSec: '/s',
    push: '$ git push',
    perPush: '+${n} per push',
    team: 'team & infra',
    upgrades: 'upgrades',
    noUpgrades: 'Nog niets te koop. Blijf shippen.',
    owned: 'in dienst',
    each: 'per stuk',
    buyMode: 'koop',
    max: 'max',
    feed: 'feed',
    stats: 'stats',
    clicks: 'pushes',
    played: 'gespeeld',
    options: 'aandelenopties',
    optionsBonus: '+{p}% op alle inkomsten',
    ipo: 'Naar de beurs (IPO)',
    ipoDesc: 'Begin een nieuw bedrijf en houd {n} nieuwe aandelenopties: +{p}% op alle inkomsten, voor altijd.',
    ipoLocked: 'Verdien ${n} in deze ronde om naar de beurs te gaan.',
    ipoConfirm: 'Luid de bel',
    cancel: 'annuleer',
    welcome: 'Welkom terug',
    welcomeDesc: 'Je was {time} weg. Je team verdiende intussen ${n}.',
    nice: 'lekker',
    reset: 'rm -rf company',
    resetConfirm: 'Echt? Alles gaat weg, ook je aandelenopties.',
    incidentFix: 'git revert HEAD',
    incidentDesc: 'Inkomsten staan op 20% tot je terugrolt.',
    incidentAuto: 'Je SRE met piketdienst is ermee bezig.',
    resolved: '✓ Teruggerold. Productie draait weer.',
    autoResolved: '✓ De SRE heeft teruggerold. Productie draait weer.',
    newRound: '🎉 {round} rond!',
    bought: '+ {n}× {name}',
    gens: {
      intern: ['Stagiair', "Fixt typo's. Eet alle snacks op."],
      junior: ['Junior dev', 'Shipt snel. Vraagt veel.'],
      senior: ['Senior dev', 'Zegt "het hangt ervan af". Heeft gelijk.'],
      lead: ['Tech lead', 'Maakt van meetings roadmaps.'],
      ci: ['CI-pipeline', 'Deployt terwijl jij slaapt.'],
      k8s: ['Kubernetes-cluster', 'Niemand snapt hoe het werkt. Het werkt.'],
      agent: ['AI-agent', 'Schrijft code, reviewt zijn eigen code.'],
      datacenter: ['Datacenter', 'Je eigen cloud. Verwarmt een klein dorp.']
    },
    tiers: ['Onboarding', 'Mentoring', 'Promoties', 'Aandelen'],
    tierDesc: '{name}: dubbele output.',
    specials: {
      keyboard: ['Mechanisch toetsenbord', 'git push levert twee keer zoveel op.'],
      vim: ['Vim-sneltoetsen', 'git push levert nog eens twee keer zoveel op.'],
      copilot: ['Copilot', 'Elke push levert ook 5% van je inkomen per seconde op.'],
      monorepo: ['Monorepo', 'Nog eens 5% van je inkomen per seconde bij elke push.'],
      coffee: ['Koffiemachine', '+10% op alle inkomsten.'],
      desks: ['Sta-bureaus', '+10% op alle inkomsten.'],
      remote: ['Thuiswerken', '+20% op alle inkomsten.'],
      fourday: ['Vierdaagse werkweek', '+25% op alle inkomsten.'],
      sre: ['SRE met piketdienst', 'Rolt incidenten na 10 seconden zelf terug.'],
      chaos: ['Chaos engineering', 'Half zoveel incidenten.']
    },
    rounds: { garage: '~/garage', seed: 'Seedronde', seriesA: 'Series A', seriesB: 'Series B', seriesC: 'Series C', unicorn: 'Unicorn' },
    news: [
      'Voorpagina van Hacker News!',
      'Een tweet over jullie ging viraal.',
      'Een grote klant tekende voor drie jaar.',
      'Je open source repo heeft 10k sterren.',
      'Een YouTuber reviewde je product. Positief.',
      'Je conferentietalk kreeg een staande ovatie.',
      'De concurrent lag plat. Iedereen kwam naar jou.',
      'Iemand noemde je API "eigenlijk best prettig".'
    ],
    incidents: [
      'Productie ligt plat!',
      'De database staat in brand.',
      'DNS. Het is altijd DNS.',
      'Iemand heeft op vrijdag gedeployd.',
      'Het TLS-certificaat is verlopen.',
      'De stagiair heeft DROP TABLE gedraaid.'
    ]
  }
};

export const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (m, k) => String(vars[k] ?? m));
