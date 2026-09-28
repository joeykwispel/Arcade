import dev_ware/games.{
  Bracket, DarkMode, Done, DontDeploy, Kill, Modal, Partial, Round, TypeCmd, Typo, Wrong, Zero,
}
import gleam/list
import gleam/string
import gleeunit

pub fn main() -> Nil {
  gleeunit.main()
}

/// Every kind, many times over: the right answer is always one of the options, and says what it should.
pub fn rounds_always_have_a_right_answer_test() {
  list.each(games.upto(200), fn(_) {
    list.each(games.kinds, fn(kind) {
      let r = games.new(kind)
      let n = list.length(r.options)
      case kind {
        TypeCmd -> {
          let assert True = r.answer == -1
          let assert True = string.length(r.prompt) >= 2
          Nil
        }
        DontDeploy -> {
          let assert True = r.answer == -1
          let assert False = games.pick_right(r, 0)
          Nil
        }
        _ -> {
          let assert True = r.answer >= 0 && r.answer < n
          let assert Ok(right) = list.drop(r.options, r.answer) |> list.first
          case kind {
            Modal -> {
              let assert "×" = right
              Nil
            }
            Kill -> {
              let assert True = string.ends_with(right, "100%")
              Nil
            }
            Zero -> {
              let assert "O" = right
              let assert 1 = list.count(r.options, fn(o) { o == "O" })
              Nil
            }
            DarkMode -> {
              let assert "☾ dark" = right
              Nil
            }
            Typo -> {
              // exactly one misspelled word, and it's the answer
              let assert True =
                list.contains(["retrun", "fucntion", "lenght", "cosnt", "improt", "pubilc", "stirng", "awiat"], right)
              Nil
            }
            _ -> Nil
          }
        }
      }
    })
  })
}

/// The bracket that closes the innermost one still open, worked out with a stack.
fn closer(code: String) -> String {
  let stack =
    string.to_graphemes(code)
    |> list.fold([], fn(stack, c) {
      case c, stack {
        "(", _ | "[", _ | "{", _ -> [c, ..stack]
        ")", [_, ..rest] | "]", [_, ..rest] | "}", [_, ..rest] -> rest
        _, _ -> stack
      }
    })
  case stack {
    ["(", ..] -> ")"
    ["[", ..] -> "]"
    ["{", ..] -> "}"
    _ -> "?"
  }
}

pub fn bracket_answers_close_the_code_test() {
  games.upto(100)
  |> list.each(fn(_) {
    let r = games.new(Bracket)
    let assert Ok(right) = list.drop(r.options, r.answer) |> list.first
    let assert True = right == closer(r.prompt)
  })
}

pub fn typing_a_command_test() {
  let r = Round(TypeCmd, [], -1, "ls", 0)
  let assert Partial = games.typed(r, "l")
  let assert Done = games.typed(r, "ls")
  let assert Wrong = games.typed(r, "k")
}

pub fn only_dont_deploy_is_won_by_waiting_test() {
  let assert True = games.timeout_wins(games.new(DontDeploy))
  let assert False = games.timeout_wins(games.new(Modal))
}

pub fn score_lives_and_speed_test() {
  let s = games.new_score()
  let assert 4 = s.lives
  // five wins: a level up, and less time per round
  let s = list.fold(games.upto(5), s, fn(s, _) { games.after(s, True) })
  let assert 5 = s.score
  let assert 1 = s.level
  let assert True = games.limit(1) <. games.limit(0)
  // four misses: game over
  let s = list.fold(games.upto(4), s, fn(s, _) { games.after(s, False) })
  let assert True = games.is_over(s)
  // never faster than 2.5 s
  let assert 2.5 = games.limit(50)
}

pub fn never_the_same_kind_twice_test() {
  list.each(games.upto(100), fn(_) {
    let assert False = games.random(Zero).kind == Zero
  })
}
