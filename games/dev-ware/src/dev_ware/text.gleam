//// Every word Dev-Ware shows, in English and Dutch.

import dev_ware/games.{
  type Kind, Bracket, DarkMode, DontDeploy, Kill, Modal, TypeCmd, Typo, Zero,
}
import gleam/string

pub type Lang {
  En
  Nl
}

pub fn from_code(code: String) -> Result(Lang, Nil) {
  case code {
    "en" -> Ok(En)
    "nl" -> Ok(Nl)
    _ -> Error(Nil)
  }
}

pub type Text {
  Text(
    title: String,
    tagline: String,
    how: String,
    start: String,
    best: String,
    builds: String,
    score: String,
    speed: String,
    shipped: String,
    failed: String,
    over: String,
    result: String,
    new_best: String,
    retry: String,
    paused: String,
    resume: String,
    cookie: String,
    friday: String,
    settings: String,
    tasks: String,
  )
}

pub fn text(lang: Lang) -> Text {
  case lang {
    En ->
      Text(
        title: "Dev-Ware",
        tagline: "Five-second microgames for developers. They keep getting faster.",
        how: "Click the right thing, or type when it asks. Four builds may fail before you're out.",
        start: "Press Space or tap to start",
        best: "best",
        builds: "builds",
        score: "shipped",
        speed: "speed",
        shipped: "✓ Shipped!",
        failed: "✗ Build failed",
        over: "Out of builds",
        result: "You shipped {n} things.",
        new_best: "New best: {n} shipped!",
        retry: "> npm run dev  (Space or tap)",
        paused: "Paused",
        resume: "Space or tap to continue",
        cookie: "We value your privacy 🍪 (and your data)",
        friday: "It's Friday, 16:59.",
        settings: "Settings › Appearance",
        tasks: "Task Manager",
      )
    Nl ->
      Text(
        title: "Dev-Ware",
        tagline: "Microgames van vijf seconden voor developers. Ze gaan steeds sneller.",
        how: "Klik op het juiste ding, of typ als het gevraagd wordt. Vier builds mogen falen voor je eruit ligt.",
        start: "Druk op spatie of tik om te beginnen",
        best: "record",
        builds: "builds",
        score: "geshipt",
        speed: "tempo",
        shipped: "✓ Geshipt!",
        failed: "✗ Build mislukt",
        over: "Geen builds meer",
        result: "Je hebt {n} dingen geshipt.",
        new_best: "Nieuw record: {n} geshipt!",
        retry: "> npm run dev  (spatie of tik)",
        paused: "Gepauzeerd",
        resume: "Spatie of tik om verder te gaan",
        cookie: "Wij waarderen je privacy 🍪 (en je data)",
        friday: "Het is vrijdag, 16:59.",
        settings: "Instellingen › Weergave",
        tasks: "Taakbeheer",
      )
  }
}

/// The one-line order for a microgame, shouted at the top of the screen.
pub fn order(lang: Lang, kind: Kind, prompt: String) -> String {
  case lang, kind {
    En, Modal -> "Close the modal!"
    En, Typo -> "Click the typo!"
    En, Bracket -> "Close the bracket!"
    En, Kill -> "Kill the process!"
    En, TypeCmd -> "Type " <> prompt <> "!"
    En, Zero -> "Find the O!"
    En, DontDeploy -> "Don't deploy!"
    En, DarkMode -> "Dark mode!"
    Nl, Modal -> "Sluit de modal!"
    Nl, Typo -> "Klik de typo!"
    Nl, Bracket -> "Sluit het haakje!"
    Nl, Kill -> "Kill het proces!"
    Nl, TypeCmd -> "Typ " <> prompt <> "!"
    Nl, Zero -> "Vind de O!"
    Nl, DontDeploy -> "Niet deployen!"
    Nl, DarkMode -> "Dark mode!"
  }
}

pub fn fill(s: String, n: Int, as_text: fn(Int) -> String) -> String {
  string.replace(s, "{n}", as_text(n))
}
