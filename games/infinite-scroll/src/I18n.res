// The game's own text in English and Dutch.

type lang = En | Nl

type text = {
  title: string,
  tagline: string,
  start: string,
  controls: string,
  legend: string,
  paused: string,
  resume: string,
  over: array<string>,
  result: string,
  newBest: string,
  retry: string,
  score: string,
  best: string,
  speed: string,
  shield: string,
  slow: string,
  sayShield: string,
  sayLost: string,
}

let en = {
  title: "Infinite Scroll",
  tagline: "The feed never ends. Neither do the exceptions.",
  start: "Press Space or tap to start scrolling",
  controls: "← → or A / D to steer. On a phone: hold the left or right side.",
  legend: "; points · { } shield · ☕ slow motion",
  paused: "Paused",
  resume: "Space or tap to continue",
  over: ["Uncaught exception", "Scrolled into a 404", "Stack trace incoming", "Segmentation fault (cursor dumped)"],
  result: "{score} lines scrolled",
  newBest: "New best: {score} lines!",
  retry: "> npm run scroll  (Space or tap)",
  score: "lines",
  best: "best",
  speed: "speed",
  shield: "shield",
  slow: "slow-mo",
  sayShield: "Shield up.",
  sayLost: "Shield used.",
}

let nl = {
  title: "Infinite Scroll",
  tagline: "De feed houdt nooit op. De exceptions ook niet.",
  start: "Druk op spatie of tik om te beginnen met scrollen",
  controls: "← → of A / D om te sturen. Op je telefoon: houd de linker- of rechterkant vast.",
  legend: "; punten · { } schild · ☕ slow motion",
  paused: "Gepauzeerd",
  resume: "Spatie of tik om verder te gaan",
  over: ["Uncaught exception", "In een 404 gescrold", "Stack trace onderweg", "Segmentation fault (cursor dumped)"],
  result: "{score} regels gescrold",
  newBest: "Nieuw record: {score} regels!",
  retry: "> npm run scroll  (spatie of tik)",
  score: "regels",
  best: "record",
  speed: "snelheid",
  shield: "schild",
  slow: "slow-mo",
  sayShield: "Schild aan.",
  sayLost: "Schild gebruikt.",
}

let text = lang =>
  switch lang {
  | En => en
  | Nl => nl
  }

let fromString = s =>
  switch s {
  | Some("en") => Some(En)
  | Some("nl") => Some(Nl)
  | _ => None
  }

let code = lang =>
  switch lang {
  | En => "en"
  | Nl => "nl"
  }

let fillScore = (s, score) => s->String.replace("{score}", Int.toString(score))
