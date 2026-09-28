//// Dev-Ware: the Lustre app. The Elm Architecture: a Model, messages that change it (update), and a view of it.
//// The microgames and the score live in dev_ware/games; the browser bits (clock, keys, storage) in dev_ware_ffi.mjs.

import dev_ware/games.{
  type Kind, type Round, type Score, Bracket, DarkMode, Done, DontDeploy, Kill, Modal, Partial, TypeCmd, Typo, Wrong,
  Zero,
}
import dev_ware/text.{type Lang, En, Nl}
import gleam/float
import gleam/int
import gleam/list
import gleam/string
import lustre
import lustre/attribute.{attribute, class}
import lustre/effect.{type Effect}
import lustre/element.{type Element}
import lustre/element/html
import lustre/event

// ---------- the browser, through the FFI ----------

@external(javascript, "./dev_ware_ffi.mjs", "now")
fn now() -> Float

@external(javascript, "./dev_ware_ffi.mjs", "every")
fn every(ms: Int, callback: fn(Float) -> Nil) -> Nil

@external(javascript, "./dev_ware_ffi.mjs", "onKey")
fn on_key(callback: fn(String) -> Nil) -> Nil

@external(javascript, "./dev_ware_ffi.mjs", "onBlur")
fn on_blur(callback: fn() -> Nil) -> Nil

@external(javascript, "./dev_ware_ffi.mjs", "best")
fn load_best() -> Int

@external(javascript, "./dev_ware_ffi.mjs", "saveBest")
fn save_best(n: Int) -> Nil

@external(javascript, "./dev_ware_ffi.mjs", "initialLang")
fn initial_lang() -> String

@external(javascript, "./dev_ware_ffi.mjs", "setHtmlLang")
fn set_html_lang(lang: String) -> Nil

@external(javascript, "./dev_ware_ffi.mjs", "followHub")
fn follow_hub(on_lang: fn(String) -> Nil) -> Nil

pub fn main() {
  let app = lustre.application(init, update, view)
  let assert Ok(_) = lustre.start(app, "#app", Nil)
  Nil
}

// ---------- model ----------

pub type Phase {
  Title
  /// the order is shown, the round is about to start
  Intro
  Playing
  /// ✓ or ✗ for a moment
  Result
  Paused
  Over
}

pub type Model {
  Model(
    phase: Phase,
    round: Round,
    score: Score,
    /// seconds left in this phase (the round's clock, or the pause between rounds)
    left: Float,
    /// what you've typed in a TypeCmd round
    typed: String,
    won: Bool,
    lang: Lang,
    best: Int,
    new_best: Bool,
    last: Float,
    /// what the screen reader should say
    say: String,
  )
}

const intro_time = 1.1

const result_time = 0.8

fn lang_of(code: String) -> Lang {
  case text.from_code(code) {
    Ok(l) -> l
    Error(_) -> En
  }
}

fn code_of(lang: Lang) -> String {
  case lang {
    En -> "en"
    Nl -> "nl"
  }
}

fn init(_flags) -> #(Model, Effect(Msg)) {
  let lang = lang_of(initial_lang())
  set_html_lang(code_of(lang))
  let model =
    Model(
      phase: Title,
      round: games.new(Modal),
      score: games.new_score(),
      left: 0.0,
      typed: "",
      won: False,
      lang: lang,
      best: load_best(),
      new_best: False,
      last: now(),
      say: "",
    )
  #(model, listen())
}

/// Hooks the page up to the app: a clock, keys, focus loss, and the hub's settings.
fn listen() -> Effect(Msg) {
  use dispatch <- effect.from
  every(50, fn(t) { dispatch(Tick(t)) })
  on_key(fn(k) { dispatch(Pressed(k)) })
  on_blur(fn() { dispatch(Blurred) })
  follow_hub(fn(l) { dispatch(LangChanged(l)) })
}

// ---------- update ----------

pub type Msg {
  Tick(Float)
  Pressed(String)
  Picked(Int)
  Tapped
  Blurred
  LangChanged(String)
}

fn next_round(m: Model) -> Model {
  let round = games.random(m.round.kind)
  Model(
    ..m,
    phase: Intro,
    round: round,
    left: intro_time,
    typed: "",
    say: text.order(m.lang, round.kind, round.prompt),
  )
}

fn start(m: Model) -> Model {
  next_round(Model(..m, score: games.new_score(), new_best: False))
}

/// A round ends, won or lost.
fn finish(m: Model, won: Bool) -> Model {
  let t = text.text(m.lang)
  let score = games.after(m.score, won)
  let say = case won {
    True -> t.shipped
    False -> t.failed
  }
  Model(..m, phase: Result, score: score, won: won, left: result_time, say: say)
}

fn game_over(m: Model) -> #(Model, Effect(Msg)) {
  let t = text.text(m.lang)
  let new_best = m.score.score > m.best
  let best = int.max(m.best, m.score.score)
  let effect = case new_best {
    True -> effect.from(fn(_) { save_best(best) })
    False -> effect.none()
  }
  #(Model(..m, phase: Over, best: best, new_best: new_best, left: 0.5, say: t.over), effect)
}

fn update(m: Model, msg: Msg) -> #(Model, Effect(Msg)) {
  case msg {
    Tick(t) -> {
      let dt = float.min(0.2, { t -. m.last } /. 1000.0)
      let m = Model(..m, last: t)
      tick(m, dt)
    }

    Tapped -> press(m)

    Pressed(" ") | Pressed("Enter") ->
      case m.phase, m.round.kind {
        Playing, TypeCmd -> #(m, effect.none())
        _, _ -> press(m)
      }

    Pressed("Escape") ->
      case m.phase {
        Playing -> #(Model(..m, phase: Paused), effect.none())
        Paused -> #(Model(..m, phase: Playing), effect.none())
        _ -> #(m, effect.none())
      }

    // typing a command
    Pressed(key) ->
      case m.phase, m.round.kind, string.length(key) == 1 {
        Playing, TypeCmd, True -> typed(m, string.lowercase(key))
        _, _, _ -> #(m, effect.none())
      }

    Picked(index) ->
      case m.phase, m.round.kind {
        Playing, TypeCmd ->
          case list.drop(m.round.options, index) {
            [key, ..] -> typed(m, key)
            [] -> #(m, effect.none())
          }
        Playing, _ -> #(finish(m, games.pick_right(m.round, index)), effect.none())
        _, _ -> #(m, effect.none())
      }

    Blurred ->
      case m.phase {
        Playing -> #(Model(..m, phase: Paused, say: text.text(m.lang).paused), effect.none())
        _ -> #(m, effect.none())
      }

    LangChanged(code) -> {
      set_html_lang(code)
      #(Model(..m, lang: lang_of(code)), effect.none())
    }
  }
}

fn typed(m: Model, key: String) -> #(Model, Effect(Msg)) {
  let so_far = m.typed <> key
  case games.typed(m.round, so_far) {
    Done -> #(finish(Model(..m, typed: so_far), True), effect.none())
    Partial -> #(Model(..m, typed: so_far), effect.none())
    Wrong -> #(finish(Model(..m, typed: so_far), False), effect.none())
  }
}

/// Space, Enter or a tap on the overlay: start, resume, or play again.
fn press(m: Model) -> #(Model, Effect(Msg)) {
  case m.phase {
    Title -> #(start(m), effect.none())
    Paused -> #(Model(..m, phase: Playing), effect.none())
    Over ->
      case m.left <=. 0.0 {
        True -> #(start(m), effect.none())
        False -> #(m, effect.none())
      }
    _ -> #(m, effect.none())
  }
}

fn tick(m: Model, dt: Float) -> #(Model, Effect(Msg)) {
  case m.phase {
    Title | Paused -> #(m, effect.none())
    Over -> #(Model(..m, left: float.max(0.0, m.left -. dt)), effect.none())
    Intro ->
      case m.left -. dt <=. 0.0 {
        True -> #(Model(..m, phase: Playing, left: games.limit(m.score.level)), effect.none())
        False -> #(Model(..m, left: m.left -. dt), effect.none())
      }
    Playing ->
      case m.left -. dt <=. 0.0 {
        True -> #(finish(m, games.timeout_wins(m.round)), effect.none())
        False -> #(Model(..m, left: m.left -. dt), effect.none())
      }
    Result ->
      case m.left -. dt <=. 0.0, games.is_over(m.score) {
        True, True -> game_over(m)
        True, False -> #(next_round(m), effect.none())
        False, _ -> #(Model(..m, left: m.left -. dt), effect.none())
      }
  }
}

// ---------- view ----------

fn phase_name(p: Phase) -> String {
  case p {
    Title -> "title"
    Intro -> "intro"
    Playing -> "playing"
    Result -> "result"
    Paused -> "paused"
    Over -> "over"
  }
}

fn kind_name(k: Kind) -> String {
  case k {
    Modal -> "modal"
    Typo -> "typo"
    Bracket -> "bracket"
    Kill -> "kill"
    TypeCmd -> "type"
    Zero -> "zero"
    DontDeploy -> "deploy"
    DarkMode -> "dark"
  }
}

fn view(m: Model) -> Element(Msg) {
  let t = text.text(m.lang)
  html.main(
    [class("stage"), attribute("data-phase", phase_name(m.phase)), attribute("data-kind", kind_name(m.round.kind))],
    [
      hud(m),
      case m.phase {
        Title -> overlay(t.title, t.tagline, t.how, t.start, m)
        Paused -> overlay(t.paused, "", "", t.resume, m)
        Over -> {
          let sub = case m.new_best {
            True -> text.fill(t.new_best, m.score.score, int.to_string)
            False -> text.fill(t.result, m.score.score, int.to_string)
          }
          overlay(t.over, sub, "", t.retry, m)
        }
        Intro -> order(m)
        Result -> result(m)
        Playing -> html.div([class("round")], [timer(m), game(m)])
      },
      html.p([class("sr-only"), attribute("aria-live", "polite")], [html.text(m.say)]),
    ],
  )
}

fn hud(m: Model) -> Element(Msg) {
  let t = text.text(m.lang)
  let lives =
    string.repeat("▮", int.max(0, m.score.lives))
    <> string.repeat("▯", int.max(0, games.start_lives - m.score.lives))
  html.header([class("hud")], [
    html.p([], [html.text(t.builds <> " "), html.span([class("lives")], [html.text(lives)])]),
    html.p([], [html.text(t.score <> " "), html.b([], [html.text(int.to_string(m.score.score))])]),
    html.p([], [html.text(t.speed <> " ×" <> int.to_string(m.score.level + 1))]),
    html.p([], [html.text(t.best <> " " <> int.to_string(int.max(m.best, m.score.score)))]),
  ])
}

fn overlay(title: String, sub: String, how: String, hint: String, _m: Model) -> Element(Msg) {
  html.div([class("overlay"), event.on_click(Tapped)], [
    html.h1([class("title")], [html.text(title)]),
    html.p([class("sub")], [html.text(sub)]),
    html.p([class("how")], [html.text(how)]),
    html.p([class("hint")], [html.text(hint)]),
  ])
}

fn order(m: Model) -> Element(Msg) {
  html.div([class("order")], [html.p([], [html.text(text.order(m.lang, m.round.kind, m.round.prompt))])])
}

fn result(m: Model) -> Element(Msg) {
  let t = text.text(m.lang)
  let #(cls, label) = case m.won {
    True -> #("result won", t.shipped)
    False -> #("result lost", t.failed)
  }
  html.div([class(cls)], [html.p([], [html.text(label)])])
}

fn timer(m: Model) -> Element(Msg) {
  let pct = float.round(100.0 *. m.left /. games.limit(m.score.level))
  html.div([class("timer")], [
    html.p([class("instruction")], [html.text(text.order(m.lang, m.round.kind, m.round.prompt))]),
    // a <progress> rather than a styled div: its value is an attribute, not an inline style, which the CSP blocks
    html.progress([class("bar"), attribute("max", "100"), attribute("value", int.to_string(pct)), attribute("aria-hidden", "true")], []),
  ])
}

/// The options as buttons; `index` is what a click sends.
fn buttons(options: List(String), cls: String) -> List(Element(Msg)) {
  list.index_map(options, fn(label, i) {
    html.button([attribute.type_("button"), class(cls), event.on_click(Picked(i))], [html.text(label)])
  })
}

fn game(m: Model) -> Element(Msg) {
  let t = text.text(m.lang)
  let r = m.round
  case r.kind {
    Modal -> {
      // the × is the answer; it goes in a corner of the modal, the rest are big tempting buttons
      let #(close, rest) =
        list.index_map(r.options, fn(o, i) { #(o, i) })
        |> list.partition(fn(p) { p.1 == r.answer })
      html.div([class("page")], [
        html.div(
          [class("modal corner-" <> int.to_string(r.corner))],
          list.append(
            list.map(close, fn(p) {
              html.button([attribute.type_("button"), class("close"), attribute("aria-label", "close"), event.on_click(Picked(p.1))], [
                html.text(p.0),
              ])
            }),
            [
              html.p([], [html.text(t.cookie)]),
              html.div(
                [class("actions")],
                list.map(rest, fn(p) {
                  html.button([attribute.type_("button"), class("big"), event.on_click(Picked(p.1))], [html.text(p.0)])
                }),
              ),
            ],
          ),
        ),
      ])
    }
    Typo -> html.div([class("code")], buttons(r.options, "token"))
    Bracket ->
      html.div([class("bracket")], [
        html.pre([class("code")], [html.text(r.prompt), html.span([class("caret")], [html.text("▌")])]),
        html.div([class("choices")], buttons(r.options, "big mono")),
      ])
    Kill ->
      html.div([class("tasks")], [
        html.p([class("window-title")], [html.text(t.tasks)]),
        html.div([class("rows")], buttons(r.options, "row")),
      ])
    TypeCmd ->
      html.div([class("terminal")], [
        html.pre([], [
          html.span([class("prompt")], [html.text("$ ")]),
          html.text(m.typed),
          html.span([class("caret")], [html.text("▌")]),
        ]),
        html.div([class("keys")], buttons(r.options, "key")),
      ])
    Zero -> html.div([class("grid")], buttons(r.options, "cell"))
    DontDeploy ->
      html.div([class("deploy")], [
        html.p([], [html.text(t.friday)]),
        ..buttons(r.options, "danger")
      ])
    DarkMode ->
      html.div([class("settings")], [
        html.p([class("window-title")], [html.text(t.settings)]),
        html.div([class("choices")], buttons(r.options, "big")),
      ])
  }
}
