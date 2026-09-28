// Tests for the rules, run with Vitest on the compiled JavaScript: `npm test`.
open World

@module("vitest") external test: (string, unit => unit) => unit = "test"
@module("vitest") external describe: (string, unit => unit) => unit = "describe"

let fail = (msg: string) => JsError.throwWithMessage(msg)
let check = (ok, msg) =>
  if !ok {
    fail(msg)
  }
let near = (a, b, msg) => check(Math.abs(a -. b) < 1e-6, `${msg}: ${Float.toString(a)} vs ${Float.toString(b)}`)

let dt = 1.0 /. 60.0

let running = seed => {
  let w = make(~rand=seeded(seed))
  start(w)
  w
}

let only = (w, kind, angle) => w.things = [{id: 999, kind, z: 0.5, angle, spin: 0.0, safe: 0.0, done: false}]

/** Steers toward the safe angle of the next obstacle, like a player who reads the tunnel */
let follow = w => {
  let next =
    w.things
    ->Array.filter(t => !t.done && t.z > 0.0 && !isPickup(t.kind))
    ->Array.reduce(None, (best, t) =>
      switch best {
      | Some(b) if b.z <= t.z => best
      | _ => Some(t)
      }
    )
  switch next {
  | None => 0.0
  | Some(t) =>
    let d = diff(w.angle, t.safe)
    Math.abs(d) < 0.02 ? 0.0 : Math.sign(d) *. Math.min(1.0, Math.abs(d) /. (turn *. dt))
  }
}

describe("world", () => {
  test("waits for the start", () => {
    let w = make(~rand=seeded(1))
    update(w, 1.0, 1.0)
    near(w.distance, 0.0, "distance")
    near(w.angle, 0.0, "angle")
  })

  test("wraps and compares angles the short way round", () => {
    near(diff(0.1, wrap(-0.1)), -0.2, "across zero")
    near(diff(3.0, -3.0), 2.0 *. pi -. 6.0, "across π")
  })

  test("ends the run when a block reaches you, unless you have a shield", () => {
    let w = running(1)
    only(w, Block, 0.0)
    update(w, 0.1, 0.0)
    check(w.phase == Over, "a block should end the run")

    let s = running(1)
    s.shield = true
    only(s, Block, 0.0)
    update(s, 0.1, 0.0)
    check(s.phase == Running && !s.shield, "the shield should take the hit")
    check(s.events->Array.includes("shield"), "a shield event")
  })

  test("lets you through the gap of a 404 ring, and nowhere else", () => {
    let through = running(1)
    only(through, Ring, 0.0)
    update(through, 0.1, 0.0)
    check(through.phase == Running, "through the gap")
    let beside = running(1)
    only(beside, Ring, pi /. 2.0)
    update(beside, 0.1, 0.0)
    check(beside.phase == Over, "into the ring")
  })

  test("picks things up for points and slow motion", () => {
    let w = running(1)
    only(w, Semi, 0.0)
    update(w, 0.1, 0.0)
    check(w.bonus == 25, "25 points for a ;")
    only(w, Coffee, w.angle)
    update(w, 0.1, 0.0)
    check(w.slow > 2.5, "coffee slows things down")
  })

  test("points spinning bars away from the safe angle when they arrive", () => {
    let w = running(3)
    let checked = ref(0)
    let i = ref(0)
    while i.contents < 60 * 240 && w.phase == Running {
      w.things->Array.forEach(t =>
        if t.kind == Spin && !t.done && t.z < 0.6 && t.z > 0.0 {
          check(Math.abs(Math.abs(diff(t.angle, t.safe)) -. pi /. 2.0) < 0.1, "bars at 90°")
          checked := checked.contents + 1
        }
      )
      update(w, dt, follow(w))
      i := i.contents + 1
    }
    check(checked.contents > 0, "saw a spinning obstacle")
  })

  test("always leaves a way through: a player who follows it never crashes", () => {
    [1, 2, 3, 4, 5]->Array.forEach(seed => {
      let w = running(seed)
      let i = ref(0)
      while i.contents < 60 * 300 && w.phase == Running {
        update(w, dt, follow(w))
        i := i.contents + 1
      }
      check(w.phase == Running, `seed ${Int.toString(seed)} crashed at ${Float.toString(w.distance)}`)
      near(w.speed, maxSpeed, "top speed")
    })
  })

  test("seed 2 crashes a player who never steers at the first obstacle (the e2e test relies on it)", () => {
    let w = running(2)
    let i = ref(0)
    while i.contents < 60 * 3 && w.phase == Running {
      update(w, dt, 0.0)
      i := i.contents + 1
    }
    check(w.phase == Over, "seed 2 should crash within three seconds")
  })

  test("does end a run that never steers", () => {
    let w = running(1)
    let i = ref(0)
    while i.contents < 60 * 300 && w.phase == Running {
      update(w, dt, 0.0)
      i := i.contents + 1
    }
    check(w.phase == Over, "never steering should crash")
  })
})
