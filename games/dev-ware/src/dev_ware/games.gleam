//// The microgames and the score, with no browser code. Every round is one short task with a time limit; most are
//// "click the right thing", one is "type this", and one is "don't touch anything".

import gleam/float
import gleam/int
import gleam/list
import gleam/string

pub type Kind {
  /// close the cookie modal: find the tiny ×
  Modal
  /// click the misspelled word in a line of code
  Typo
  /// pick the bracket that closes the code
  Bracket
  /// kill the process that eats 100% CPU
  Kill
  /// type a short shell command and Enter
  TypeCmd
  /// find the letter O among the zeros
  Zero
  /// do NOT press deploy on a Friday
  DontDeploy
  /// switch to dark mode
  DarkMode
}

pub const kinds = [Modal, Typo, Bracket, Kill, TypeCmd, Zero, DontDeploy, DarkMode]

/// One microgame, ready to play. `options` are the things you can click; `answer` is the right one (or -1 when the
/// right move is to do nothing, or when you have to type). `prompt` is extra text: code, or the command to type.
/// `corner` places the modal's × somewhere else every time.
pub type Round {
  Round(kind: Kind, options: List(String), answer: Int, prompt: String, corner: Int)
}

/// Lives, points and speed.
pub type Score {
  Score(lives: Int, score: Int, level: Int)
}

pub const start_lives = 4

/// Wins per level; every level is faster.
pub const per_level = 5

pub fn new_score() -> Score {
  Score(lives: start_lives, score: 0, level: 0)
}

/// Seconds for a round: five at first, down to two and a half.
pub fn limit(level: Int) -> Float {
  float.max(2.5, 5.0 -. 0.45 *. int.to_float(level))
}

/// The score after a round.
pub fn after(s: Score, won: Bool) -> Score {
  case won {
    True -> {
      let score = s.score + 1
      Score(..s, score: score, level: score / per_level)
    }
    False -> Score(..s, lives: s.lives - 1)
  }
}

pub fn is_over(s: Score) -> Bool {
  s.lives <= 0
}

// ---------- making rounds ----------

/// 0, 1, ... n - 1
pub fn upto(n: Int) -> List(Int) {
  list.repeat(Nil, n) |> list.index_map(fn(_, i) { i })
}

fn pick(list: List(a), fallback: a) -> a {
  let n = list.length(list)
  case list.drop(list, int.random(n)) {
    [x, ..] -> x
    [] -> fallback
  }
}

/// Puts `right` among `wrong` at a random place; returns the options and where `right` ended up.
fn place(right: String, wrong: List(String)) -> #(List(String), Int) {
  let at = int.random(list.length(wrong) + 1)
  let #(before, after) = list.split(list.shuffle(wrong), at)
  #(list.flatten([before, [right], after]), at)
}

/// A random round of any kind, but not the same kind as `last` twice in a row.
pub fn random(last: Kind) -> Round {
  let kind = pick(list.filter(kinds, fn(k) { k != last }), Modal)
  new(kind)
}

const typos = [
  #("return", "retrun"), #("function", "fucntion"), #("length", "lenght"), #("const", "cosnt"),
  #("import", "improt"), #("public", "pubilc"), #("string", "stirng"), #("await", "awiat"),
]

const lines = [
  ["const", "total", "=", "items.length", ";"], ["import", "{", "api", "}", "from", "'./api'"],
  ["return", "await", "fetch(url)", ";"], ["public", "static", "void", "main()"],
  ["function", "add(a,", "b)", "{", "}"], ["let", "name:", "string", "=", "''"],
]

const brackets = [
  #("foo(bar[0", "]"), #("if (ok) { run(", ")"), #("list = [1, [2, 3]", "]"), #("fn main() { print(x) ", "}"),
  #("obj = { a: f(", ")"), #("({ key: [1, 2] ", "}"),
]

const processes = ["node", "chrome", "docker", "slack", "vscode", "java", "webpack", "zoom"]

const commands = ["ls", "cd", "pwd", "git", "npm", "cat"]

pub fn new(kind: Kind) -> Round {
  case kind {
    Modal -> {
      let #(options, answer) = place("×", ["Accept all", "OK", "Accept", "Yes, track me"])
      Round(kind, options, answer, "", int.random(4))
    }
    Typo -> {
      let words = pick(lines, [])
      let #(right, wrong) = pick(typos, #("return", "retrun"))
      // put the misspelled word in place of one word of the line (or in front if it has none)
      let at = int.random(list.length(words))
      let #(before, after) = list.split(words, at)
      let options = list.flatten([before, [wrong], list.drop(after, 1)])
      let _ = right
      Round(kind, options, at, "", 0)
    }
    Bracket -> {
      let #(code, right) = pick(brackets, #("foo(", ")"))
      let options = [")", "]", "}"]
      let answer = case list.index_map(options, fn(o, i) { #(o, i) }) |> list.find(fn(p) { p.0 == right }) {
        Ok(#(_, i)) -> i
        Error(_) -> 0
      }
      Round(kind, options, answer, code, 0)
    }
    Kill -> {
      let names = list.take(list.shuffle(processes), 5)
      let loads = list.map(upto(4), fn(_) { int.to_string(2 + int.random(40)) <> "%" })
      let #(first, rest) = case names {
        [first, ..rest] -> #(first, rest)
        [] -> #("node", [])
      }
      let wrong = list.map2(rest, loads, fn(n, l) { n <> "  " <> l })
      let #(options, answer) = place(first <> "  100%", wrong)
      Round(kind, options, answer, "", 0)
    }
    TypeCmd -> {
      // on-screen keys for phones: the command's letters and a few others, shuffled
      let command = pick(commands, "ls")
      let keys =
        list.append(string.to_graphemes(command), list.take(list.shuffle(string.to_graphemes("aeiknrtuwx")), 4))
        |> list.unique
        |> list.shuffle
      Round(kind, keys, -1, command, 0)
    }
    Zero -> {
      let answer = int.random(24)
      let options =
        list.map(upto(24), fn(i) {
          case i == answer {
            True -> "O"
            False -> "0"
          }
        })
      Round(kind, options, answer, "", 0)
    }
    DontDeploy -> Round(kind, ["🚀 Deploy to production"], -1, "", 0)
    DarkMode -> {
      let #(options, answer) = place("☾ dark", ["☀ light"])
      Round(kind, options, answer, "", 0)
    }
  }
}

// ---------- judging ----------

/// Clicking option `index`: right or wrong. (Deploying is always wrong.)
pub fn pick_right(round: Round, index: Int) -> Bool {
  round.answer >= 0 && index == round.answer
}

/// Time's up: only "don't deploy" is won by doing nothing.
pub fn timeout_wins(round: Round) -> Bool {
  round.kind == DontDeploy
}

pub type Typed {
  /// typed the whole command
  Done
  /// on the right track
  Partial
  /// a key that isn't in the command
  Wrong
}

/// What typing `typed` so far means for a TypeCmd round.
pub fn typed(round: Round, typed: String) -> Typed {
  case typed == round.prompt, string.starts_with(round.prompt, typed) {
    True, _ -> Done
    False, True -> Partial
    False, False -> Wrong
  }
}
