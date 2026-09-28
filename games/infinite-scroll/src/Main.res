// Infinite Scroll: wires the World (rules) to the Scene (3D) and the page: the loop, keyboard and touch steering,
// the HUD and overlay, theme and language from the hub, and the best score in localStorage.

%%raw(`import '@fontsource-variable/jetbrains-mono'`)
%%raw(`import './style.css'`)

open Browser

let bestKey = "play:infinite-scroll:best"
let el = getElementById
let stage = el("stage")
let overlay = el("overlay")
let live = el("live")

let lang = ref(
  switch I18n.fromString(%raw(`new URLSearchParams(location.search).get("lang") ?? undefined`)) {
  | Some(l) => l
  | None => %raw(`navigator.language.startsWith("nl")`) ? I18n.Nl : I18n.En
  },
)
let best = ref(storageGet(bestKey)->Option.flatMap(s => Int.fromString(s))->Option.getOr(0))
let world = ref(World.make())
let overLine = ref(0)
let newBest = ref(false)
let endedAt = ref(0.0)

let readColors = (): Scene.colors => {
  let v = name => cssVar("--c-" ++ name)
  {
    bg: v("bg"),
    code: v("code"),
    keyword: v("keyword"),
    str: v("str"),
    comment: v("comment"),
    accent: v("accent"),
    accent2: v("accent2"),
    danger: v("danger"),
    warn: v("warn"),
    info: v("info"),
    success: v("success"),
    ink: v("ink"),
  }
}

let html: element = %raw(`document.documentElement`)
let themeOf = t => t == Some("light") ? "light" : "dark"
let cookieTheme: option<string> = %raw(`document.cookie.match(/(?:^|; )jo-theme=(dark|light)/)?.[1]`)
html->setAttribute(
  "data-theme",
  themeOf(
    switch cookieTheme {
    | Some(t) => Some(t)
    | None => storageGet("theme")
    },
  ),
)
html->setAttribute("lang", I18n.code(lang.contents))
if %raw(`window.top === window.self`) {
  addHtmlClass("standalone")
}

let scene = try Scene.make(el("game"), readColors()) catch {
| e =>
  el("fallback")->setHidden(false)
  throw(e)
}

let setTheme = t => {
  let t = themeOf(t)
  if %raw(`document.documentElement.dataset.theme`) != t {
    html->setAttribute("data-theme", t)
    Scene.setColors(scene, readColors())
  }
}

/* ---------- overlay and HUD ---------- */

let phaseName = (p: World.phase) =>
  switch p {
  | Ready => "ready"
  | Running => "running"
  | Paused => "paused"
  | Over => "over"
  }

let showOverlay = () => {
  let t = I18n.text(lang.contents)
  let w = world.contents
  overlay->setHidden(w.phase == Running)
  overlay->setAttribute("data-phase", phaseName(w.phase))
  stage->setAttribute("data-phase", phaseName(w.phase))
  let (title, sub, hint, small) = switch w.phase {
  | Ready => (t.title, t.tagline, t.start, t.controls ++ " " ++ t.legend)
  | Paused => (t.paused, I18n.fillScore(t.result, World.score(w)), t.resume, "")
  | Over => (
      t.over->Array.getUnsafe(mod(overLine.contents, Array.length(t.over))),
      I18n.fillScore(newBest.contents ? t.newBest : t.result, World.score(w)),
      t.retry,
      "",
    )
  | Running => ("", "", "", "")
  }
  el("title")->setTextContent(title)
  el("sub")->setTextContent(sub)
  el("hint")->setTextContent(hint)
  el("small")->setTextContent(small)
  el("score-label")->setTextContent(t.score)
  el("best-label")->setTextContent(t.best)
}

let setLang = l => {
  lang := l
  html->setAttribute("lang", I18n.code(l))
  showOverlay()
}

let hudAt = ref(0.0)
let hud = now =>
  // ten times a second is plenty for text
  if now -. hudAt.contents >= 100.0 {
    hudAt := now
    let t = I18n.text(lang.contents)
    let w = world.contents
    let score = World.score(w)
    el("score")->setTextContent(Int.toString(score))
    el("best")->setTextContent(Int.toString(w.phase == Over ? best.contents : Math.Int.max(best.contents, score)))
    let status =
      [w.shield ? "{ } " ++ t.shield : "", w.slow > 0.0 ? "☕ " ++ t.slow : ""]
      ->Array.filter(s => s != "")
      ->Array.join("   ")
    el("status")->setTextContent(
      w.phase != Running ? "" : status != "" ? status : t.speed ++ " " ++ Int.toString(Float.toInt(w.speed)),
    )
  }

/* ---------- input ---------- */

let left = ref(false)
let right = ref(false)
let touchSide = ref(0.0)
let steer = () => (right.contents ? 1.0 : 0.0) -. (left.contents ? 1.0 : 0.0) +. touchSide.contents

let press = () => {
  let w = world.contents
  switch w.phase {
  | Ready => World.start(w)
  | Paused => World.togglePause(w)
  | Over =>
    if performanceNow() -. endedAt.contents >= 500.0 {
      let fresh = World.make()
      World.start(fresh)
      world := fresh
    }
  | Running => ()
  }
  showOverlay()
}

let pause = () => {
  if world.contents.phase == Running {
    World.togglePause(world.contents)
    showOverlay()
  }
  left := false
  right := false
  touchSide := 0.0
}

let isLeft = code => code == "ArrowLeft" || code == "KeyA"
let isRight = code => code == "ArrowRight" || code == "KeyD"

let win: element = %raw(`window`)
let doc: element = %raw(`document`)

win->addEventListener("keydown", (e: keyboardEvent) =>
  if !(e.ctrlKey || e.metaKey || e.altKey) {
    let handled = if isLeft(e.code) {
      left := true
      true
    } else if isRight(e.code) {
      right := true
      true
    } else if e.code == "Space" || e.code == "Enter" {
      if !e.repeat {
        press()
      }
      true
    } else if e.code == "KeyP" || e.code == "Escape" {
      World.togglePause(world.contents)
      showOverlay()
      true
    } else {
      false
    }
    if handled {
      e->preventDefault
    }
  }
)
win->addEventListener("keyup", (e: keyboardEvent) => {
  if isLeft(e.code) {
    left := false
  }
  if isRight(e.code) {
    right := false
  }
})

// touch and mouse: hold the left or right half to steer; a tap on the overlay starts
let sideOf = (e: pointerEvent) => {
  let r = stage->getBoundingClientRect
  e.clientX -. r.left < r.width /. 2.0 ? -1.0 : 1.0
}
stage->addEventListener("pointerdown", (e: pointerEvent) =>
  if e.isPrimary {
    e->preventDefault
    focusWindow()
    if world.contents.phase != Running {
      press()
    } else {
      touchSide := sideOf(e)
      stage->setPointerCapture(e.pointerId)
    }
  }
)
stage->addEventListener("pointermove", (e: pointerEvent) =>
  if touchSide.contents != 0.0 {
    touchSide := sideOf(e)
  }
)
stage->addEventListener("pointerup", _ => touchSide := 0.0)
stage->addEventListener("pointercancel", _ => touchSide := 0.0)
stage->addEventListener("contextmenu", e => e->preventDefault)

win->addEventListener("blur", _ => pause())
doc->addEventListener("visibilitychange", _ =>
  if %raw(`document.hidden`) {
    pause()
  }
)

// settings from the hub (optional), same origin only
win->addEventListener("message", (e: messageEvent) =>
  if e.origin == %raw(`location.origin`) {
    switch e.data->Nullable.toOption {
    | Some(data) if data["type"]->Nullable.toOption == Some("play:settings") =>
      switch data["theme"]->Nullable.toOption {
      | Some("light") | Some("dark") => setTheme(data["theme"]->Nullable.toOption)
      | _ => ()
      }
      switch I18n.fromString(data["lang"]->Nullable.toOption) {
      | Some(l) => setLang(l)
      | None => ()
      }
    | _ => ()
    }
  }
)
win->addEventListener("storage", (e: storageEvent) =>
  if e.key->Nullable.toOption == Some("theme") {
    setTheme(e.newValue->Nullable.toOption)
  }
)

/* ---------- loop ---------- */

let size = ref("")
let last = ref(performanceNow())

let rec frame = now => {
  let dt = Math.min(0.05, (now -. last.contents) /. 1000.0)
  last := now
  let r = stage->getBoundingClientRect
  let key = Float.toString(r.width) ++ "x" ++ Float.toString(r.height)
  if key != size.contents && r.width > 0.0 && r.height > 0.0 {
    size := key
    Scene.resize(scene, r.width, r.height)
  }
  let s = steer()
  let w = world.contents
  World.update(w, dt, s)
  let t = I18n.text(lang.contents)
  w.events->Array.forEach(ev =>
    switch ev {
    | "pickup:shield" => live->setTextContent(t.sayShield)
    | "shield" => live->setTextContent(t.sayLost)
    | "over" =>
      endedAt := now
      overLine := Float.toInt(Math.random() *. 4.0)
      let score = World.score(w)
      newBest := score > best.contents
      if newBest.contents {
        best := score
        storageSet(bestKey, Int.toString(score))
      }
      showOverlay()
      live->setTextContent(el("title")->textContent ++ ". " ++ el("sub")->textContent)
    | _ => ()
    }
  )
  w.events = []
  Scene.render(scene, w, s, now /. 1000.0)
  hud(now)
  requestAnimationFrame(frame)
}

showOverlay()
requestAnimationFrame(frame)
