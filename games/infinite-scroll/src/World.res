// The rules of Infinite Scroll, without any 3D: you ride the inside wall of a tunnel, at an angle (0 = the bottom),
// and things come at you from ahead. Positions ahead are in tunnel units; angles in radians.
// Every obstacle is placed around a "safe" angle that you can always reach in time, so there is always a way through.

type kind = Block | Ring | Half | Spin | Semi | Shield | Coffee
type phase = Ready | Running | Paused | Over

type thing = {
  id: int,
  kind: kind,
  /** distance ahead of you; it's reached at 0 */
  mutable z: float,
  /** center of what blocks (block, half, spin) or of the gap (ring); where a pickup sits */
  mutable angle: float,
  /** a spinning obstacle turns this many radians per unit you travel, so where it points on arrival is exact */
  spin: float,
  /** where the safe way through is when this reaches you */
  safe: float,
  mutable done: bool,
}

type t = {
  mutable phase: phase,
  mutable angle: float,
  mutable speed: float,
  mutable distance: float,
  mutable bonus: int,
  mutable shield: bool,
  /** seconds of coffee (slow motion) left */
  mutable slow: float,
  /** seconds you can't be hit after losing a shield */
  mutable safeFor: float,
  mutable things: array<thing>,
  /** for the page: "hit", "shield", "pickup:<kind>", "over" */
  mutable events: array<string>,
  mutable nextAt: float,
  mutable lastSafe: float,
  mutable nextId: int,
  rand: unit => float,
}

let pi = Math.Constants.pi
let tau = 2.0 *. pi

/** How wide each obstacle is, in radians (for the ring: the width of its gap) */
let spanBlock = 0.62
let spanRing = 1.0
let spanHalf = pi
let spanSpin = 0.5
/** How far around you count as touching something */
let reach = 0.12
/** Radians per second you can turn at full steer */
let turn = 3.4
let startSpeed = 14.0
let maxSpeed = 44.0
/** Speed added per second of play */
let accel = 0.32
/** How far ahead new things appear */
let horizon = 110.0

/** An angle in [0, 2π) */
let wrap = a => a -. tau *. Math.floor(a /. tau)

/** The signed shortest turn from a to b, in (-π, π] */
let diff = (a, b) => {
  let d = wrap(b -. a)
  d > pi ? d -. tau : d
}

/** Deterministic random numbers (mulberry32): the same seed gives the same tunnel, for tests and `?seed=` */
let seeded: int => unit => float = %raw(`seed => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}`)

let make = (~rand=Math.random) => {
  phase: Ready,
  angle: 0.0,
  speed: startSpeed,
  distance: 0.0,
  bonus: 0,
  shield: false,
  slow: 0.0,
  safeFor: 0.0,
  things: [],
  events: [],
  nextAt: 30.0,
  lastSafe: 0.0,
  nextId: 0,
  rand,
}

let score = w => Float.toInt(w.distance /. 2.0) + w.bonus

let start = w =>
  if w.phase == Ready {
    w.phase = Running
  }

let togglePause = w =>
  switch w.phase {
  | Running => w.phase = Paused
  | Paused => w.phase = Running
  | _ => ()
  }

let isPickup = kind =>
  switch kind {
  | Semi | Shield | Coffee => true
  | _ => false
  }

/** Whether a thing covers `angle` right now */
let covers = (t: thing, angle) => {
  let d = Math.abs(diff(t.angle, angle))
  switch t.kind {
  | Block => d < spanBlock /. 2.0 +. reach
  | Ring => d > spanRing /. 2.0 -. reach
  | Half => d < spanHalf /. 2.0 +. reach
  | Spin =>
    d < spanSpin /. 2.0 +. reach || Math.abs(diff(wrap(t.angle +. pi), angle)) < spanSpin /. 2.0 +. reach
  | Semi | Shield | Coffee => d < 0.35 // pickups are forgiving
  }
}

let kindName = kind =>
  switch kind {
  | Block => "block"
  | Ring => "ring"
  | Half => "half"
  | Spin => "spin"
  | Semi => "semi"
  | Shield => "shield"
  | Coffee => "coffee"
  }

let reachYou = (w: t, t: thing) => {
  t.done = true
  if covers(t, w.angle) {
    if isPickup(t.kind) {
      switch t.kind {
      | Semi => w.bonus = w.bonus + 25
      | Shield => w.shield = true
      | _ => w.slow = 3.0
      }
      w.events->Array.push("pickup:" ++ kindName(t.kind))
      t.z = -99.0 // gone
    } else if w.safeFor > 0.0 {
      ()
    } else if w.shield {
      w.shield = false
      w.safeFor = 0.6
      w.events->Array.push("shield")
    } else {
      w.events->Array.push("hit")
      w.events->Array.push("over")
      w.phase = Over
    }
  }
}

/** Units between obstacles: roomy at first, tighter when fast */
let spacing = w => Math.max(15.0, 30.0 -. (w.speed -. startSpeed) *. 0.4)

let put = (w, kind, z, angle, spin, safe) => {
  w.nextId = w.nextId + 1
  w.things->Array.push({id: w.nextId, kind, z, angle, spin, safe, done: false})
}

let pickKind = w => {
  let pool = [Block, Block]
  if w.distance > 150.0 {
    pool->Array.push(Ring)
    pool->Array.push(Ring)
  }
  if w.distance > 400.0 {
    pool->Array.push(Half)
  }
  if w.distance > 700.0 {
    pool->Array.push(Spin)
  }
  pool->Array.getUnsafe(Float.toInt(w.rand() *. Int.toFloat(Array.length(pool))))
}

let addObstacle = (w, kind, z, safe) =>
  switch kind {
  | Ring => put(w, Ring, z, safe, 0.0, safe)
  | Half => put(w, Half, z, wrap(safe +. pi), 0.0, safe)
  | Spin =>
    // turning bars, set so they point 90° away from the safe angle when they arrive
    let spin = (w.rand() < 0.5 ? -1.0 : 1.0) *. (0.06 +. w.rand() *. 0.05)
    put(w, Spin, z, wrap(safe +. pi /. 2.0 -. spin *. z), spin, safe)
  | _ =>
    // a block somewhere that leaves the safe angle free
    let off = spanBlock /. 2.0 +. reach +. 0.25 +. w.rand() *. (pi -. spanBlock)
    put(w, Block, z, wrap(safe +. (w.rand() < 0.5 ? off : -.off)), 0.0, safe)
  }

let spawn = w =>
  while w.distance +. horizon >= w.nextAt {
    let z = w.nextAt -. w.distance
    let gap = spacing(w)
    // how far you can turn between the previous obstacle and this one, with some slack
    let canTurn = turn *. (gap /. w.speed) *. 0.6
    let safe = wrap(w.lastSafe +. (w.rand() *. 2.0 -. 1.0) *. Math.min(canTurn, pi))
    addObstacle(w, pickKind(w), z, safe)
    // a pickup now and then, on the safe path between two obstacles
    let roll = w.rand()
    let extra = roll < 0.04 ? Some(Shield) : roll < 0.08 ? Some(Coffee) : roll < 0.5 ? Some(Semi) : None
    switch extra {
    | Some(kind) => put(w, kind, z -. gap /. 2.0, wrap(w.lastSafe +. diff(w.lastSafe, safe) /. 2.0), 0.0, safe)
    | None => ()
    }
    w.lastSafe = safe
    w.nextAt = w.nextAt +. gap
  }

/** `steer` is -1 (left) to 1 (right) */
let update = (w, dt, steer) =>
  if w.phase == Running {
    let slowed = w.slow > 0.0 ? 0.55 : 1.0
    w.slow = Math.max(0.0, w.slow -. dt)
    w.safeFor = Math.max(0.0, w.safeFor -. dt)
    w.speed = Math.min(maxSpeed, w.speed +. accel *. dt)
    let move = w.speed *. slowed *. dt
    w.distance = w.distance +. move
    w.angle = wrap(w.angle +. Math.max(-1.0, Math.min(1.0, steer)) *. turn *. dt)

    w.things->Array.forEach(t => {
      let before = t.z
      t.z = t.z -. move
      t.angle = wrap(t.angle +. t.spin *. move)
      // it reaches you when it crosses z = 0
      if !t.done && before >= 0.0 && t.z < 0.0 {
        reachYou(w, t)
      }
    })
    w.things = w.things->Array.filter(t => t.z > -8.0)
    spawn(w)
  }
