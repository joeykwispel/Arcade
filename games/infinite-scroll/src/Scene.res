// The 3D side: a tunnel lined with code, the obstacles and pickups from World, and you (a blinking cursor).
//
// Made to be easy on the stomach: the camera never moves, turns or tilts. You travel around the rim of the tunnel
// (like the arcade game Tempest) instead of the world spinning around you. The walls are dim, and with
// "reduce motion" on they stand still.
//
// Obstacles are real code: an editor panel with the line that threw, and arcs of text that follow the circle.
// Objects are pooled per kind and reused: nothing is created while a run is going.

open Three

let r = 5.0
let len = 130.0
let ringGap = 16.0
/** How far into the tunnel you ride; things reach you here */
let playerZ = -5.0
let mono = "'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace"

type colors = {
  bg: string,
  code: string,
  keyword: string,
  str: string,
  comment: string,
  accent: string,
  accent2: string,
  danger: string,
  warn: string,
  info: string,
  success: string,
  /** text on colored surfaces */
  ink: string,
  /** the background of the code panels */
  panel: string,
  /** multiplies the wall's colors: dims it in the dark theme */
  wallTint: string,
}

let lines = [
  "function scroll(forever) {",
  "  while (true) {",
  "    const line = next(buffer);",
  "    if (!line) throw new Error('EOF');",
  "    render(line); // TODO: optimize",
  "  }",
  "}",
  "export async function deploy(env) {",
  "  await git.push('--force');",
  "  return null; // ¯\\_(ツ)_/¯",
  "}",
  "const bugs = new Set(); // it grows",
  "for (let i = 0; i <= arr.length; i++) {",
  "  total += arr[i]; // off by one?",
  "}",
  "import { everything } from './utils';",
  "class InfiniteScroll extends Component {",
  "  onBottom() { this.load(++this.page); }",
  "}",
  "// 404: comment not found",
  "let retries = Infinity;",
  "catch (e) { console.log(e); }",
  "await sleep(1000); // 'works'",
  "return new Promise(() => {}); // never",
]

let keywords = %re("/^(function|const|let|while|if|throw|new|return|export|async|await|for|import|from|class|extends|catch|true)$/")

let reduceMotion: bool = %raw(`matchMedia("(prefers-reduced-motion: reduce)").matches`)

let canvasOf = (width, height) => {
  let canvas = Browser.createElement("canvas")
  canvas->Browser.setWidth(width)
  canvas->Browser.setHeight(height)
  (canvas, canvas->Browser.getContext2d)
}

let texture = (canvas): texture => {
  let t = canvasTexture(canvas)
  t->setColorSpace("srgb")
  t
}

/** Draws one line of code with a rough highlight (comments, strings, keywords, the rest); returns where it ended */
let drawCode = (g, c, line, x, y) => {
  let x = ref(x)
  line
  ->String.splitByRegExp(%re("/(\/\/.*$|'[^']*'|\s+|[(){};.])/"))
  ->Array.forEach(part =>
    switch part {
    | Some(part) if part != "" =>
      g->Browser.fillStyle(
        if String.startsWith(part, "//") {
          c.comment
        } else if String.startsWith(part, "'") {
          c.str
        } else if RegExp.test(keywords, part) {
          c.keyword
        } else {
          c.code
        },
      )
      g->Browser.fillText(part, x.contents, y)
      x := x.contents +. (g->Browser.measureText(part)).width
    | _ => ()
    }
  )
  x.contents
}

/** The code on the tunnel wall: one canvas, repeated */
let wallTexture = c => {
  let (canvas, g) = canvasOf(1024, 1024)
  g->Browser.fillStyle(c.bg)
  g->Browser.fillRect(0.0, 0.0, 1024.0, 1024.0)
  g->Browser.font(`500 26px ${mono}`)
  g->Browser.textBaseline("top")
  for i in 0 to 23 {
    let y = 16.0 +. Int.toFloat(i) *. 42.0
    g->Browser.fillStyle(c.comment)
    g->Browser.fillText(String.padStart(Int.toString(i + 1), 3, " "), 12.0, y)
    drawCode(g, c, lines->Array.getUnsafe(mod(i, Array.length(lines))), 80.0, y)->ignore
  }
  let t = texture(canvas)
  t->setWrapS(repeatWrapping)
  t->setWrapT(repeatWrapping)
  // negative: the tunnel is seen from the inside, which would mirror the text.
  // Many small repeats: small text streams past more calmly than big text.
  t->repeat->set2(-6.0, 9.0)
  t->setAnisotropy(4)
  t
}

/** One tile of an arc: a strip of editor with a colored edge and a piece of code, repeated around the circle */
let arcTexture = (c, text, edge, ~color) => {
  let (canvas, g) = canvasOf(1024, 128)
  g->Browser.fillStyle(c.panel)
  g->Browser.fillRect(0.0, 0.0, 1024.0, 128.0)
  g->Browser.fillStyle(edge)
  g->Browser.fillRect(0.0, 0.0, 1024.0, 10.0)
  g->Browser.fillRect(0.0, 118.0, 1024.0, 10.0)
  g->Browser.font(`700 46px ${mono}`)
  g->Browser.textBaseline("middle")
  switch color {
  | Some(color) =>
    g->Browser.fillStyle(color)
    g->Browser.fillText(text, 40.0, 66.0)
  | None => drawCode(g, c, text, 40.0, 66.0)->ignore
  }
  let t = texture(canvas)
  t->setWrapS(repeatWrapping)
  t->setAnisotropy(4)
  t
}

/** The NullPointerException: a little editor panel with the line that threw, squiggle and all */
let crashCard = c => {
  let (canvas, g) = canvasOf(512, 256)
  g->Browser.fillStyle(c.panel)
  g->Browser.fillRect(0.0, 0.0, 512.0, 256.0)
  g->Browser.fillStyle(c.danger)
  g->Browser.fillRect(0.0, 0.0, 512.0, 8.0)
  g->Browser.fillRect(0.0, 248.0, 512.0, 8.0)
  g->Browser.fillRect(0.0, 0.0, 8.0, 256.0)
  g->Browser.fillRect(504.0, 0.0, 8.0, 256.0)
  g->Browser.textBaseline("middle")
  g->Browser.font(`600 30px ${mono}`)
  g->Browser.fillStyle(c.comment)
  g->Browser.fillText("42", 26.0, 70.0)
  let before = drawCode(g, c, "user.", 84.0, 70.0)
  let after = drawCode(g, c, "name", before, 70.0)
  drawCode(g, c, ".length", after, 70.0)->ignore
  // the red squiggle under `name`
  g->Browser.fillStyle(c.danger)
  let x = ref(before)
  while x.contents < after {
    g->Browser.fillRect(x.contents, 92.0 +. (mod(Float.toInt(x.contents), 16) < 8 ? 0.0 : 4.0), 8.0, 3.0)
    x := x.contents +. 8.0
  }
  g->Browser.font(`800 34px ${mono}`)
  g->Browser.fillText("NullPointer", 26.0, 150.0)
  g->Browser.fillText("Exception", 26.0, 196.0)
  texture(canvas)
}

/** A word drawn on a transparent canvas, for the pickups */
let token = (text, color, ~width=128, ~size=100) => {
  let (canvas, g) = canvasOf(width, 128)
  g->Browser.font(`800 ${Int.toString(size)}px ${mono}`)
  g->Browser.textAlign("center")
  g->Browser.textBaseline("middle")
  g->Browser.fillStyle(color)
  g->Browser.fillText(text, Int.toFloat(width) /. 2.0, 68.0)
  texture(canvas)
}

/**
 * An arc of the tunnel's inner rim, facing you: `span` radians wide around `center` (standard angle: 0 is to the
 * right, π/2 is up). Its texture coordinates run along the arc, so a strip of text reads around the circle without
 * stretching: one tile every `tile` units.
 */
let arc = (~span, ~center, ~inner, ~outer, ~tile) => {
  let n = Math.Int.max(6, Float.toInt(span *. 16.0))
  let repeats = Math.max(1.0, Math.round(span *. (inner +. outer) /. 2.0 /. tile))
  let pos = []
  let uv = []
  let idx = []
  for i in 0 to n {
    let k = Int.toFloat(i) /. Int.toFloat(n)
    let a = center -. span /. 2.0 +. span *. k
    pos->Array.pushMany([Math.cos(a) *. inner, Math.sin(a) *. inner, 0.0, Math.cos(a) *. outer, Math.sin(a) *. outer, 0.0])
    // u runs against the angle so the text reads left to right at the top of the circle
    uv->Array.pushMany([repeats *. (1.0 -. k), 0.0, repeats *. (1.0 -. k), 1.0])
    if i < n {
      let v = i * 2
      idx->Array.pushMany([v, v + 1, v + 2, v + 1, v + 3, v + 2])
    }
  }
  let g = bufferGeometry()
  g->setAttribute("position", bufferAttribute(Float32Array.fromArray(pos), 3))
  g->setAttribute("uv", bufferAttribute(Float32Array.fromArray(uv), 2))
  g->setIndex(idx)
  g
}

let top = World.pi /. 2.0
let bottom = -.World.pi /. 2.0

type t = {
  renderer: renderer,
  scene: object3d,
  camera: object3d,
  tube: object3d,
  player: object3d,
  mutable wallMap: option<texture>,
  mutable rings: array<object3d>,
  mutable shield: option<object3d>,
  mutable cursor: option<object3d>,
  pools: Map.t<World.kind, array<object3d>>,
  live: Map.t<int, (World.kind, object3d)>,
  mutable materials: array<material>,
  mutable textures: array<texture>,
  mutable colors: colors,
}

let track = (s, m) => {
  s.materials->Array.push(m)
  m
}
let trackTexture = (s, t) => {
  s.textures->Array.push(t)
  t
}
let basic = (s, opts) => track(s, basicMaterial(opts))

/** (Re)builds everything that has a color, for the first frame and when the theme changes */
let setColors = (s, c) => {
  s.colors = c
  s.materials->Array.forEach(disposeMaterial)
  s.textures->Array.forEach(disposeTexture)
  s.materials = []
  s.textures = []
  s.tube->clear
  s.player->clear
  s.pools->Map.clear
  s.live->Map.clear
  s.rings = []

  s.scene->setFog(fog(c.bg, 20.0, 90.0))
  s.renderer->setClearColor(c.bg)

  let map = trackTexture(s, wallTexture(c))
  s.wallMap = Some(map)
  let geo = cylinder(r, r, len, 36, 1, true)
  geo->rotateX(World.pi /. 2.0)
  let tunnel = mesh(geo, basic(s, {map, color: c.wallTint, side: backSide}))
  tunnel->position->setZ(-.len /. 2.0 +. 6.0)
  s.tube->add(tunnel)

  // faint rings for a sense of depth; left out when motion should be reduced
  if !reduceMotion {
    let ringMat = basic(s, {color: c.accent, transparent: true, opacity: 0.18})
    for _ in 1 to Float.toInt(len /. ringGap) {
      let rm = mesh(torus(r -. 0.03, 0.02, 4, 48), ringMat)
      s.rings->Array.push(rm)
      s.tube->add(rm)
    }
  }

  // you: a blinking text cursor at the bottom of the rim, with a glow and a shield ring; turned to your angle
  let cursor = mesh(box(0.18, 0.62, 0.18), basic(s, {color: c.accent}))
  let glow = mesh(box(0.42, 0.9, 0.42), basic(s, {color: c.accent, transparent: true, opacity: 0.2}))
  let shield = mesh(torus(0.62, 0.05, 6, 32), basic(s, {color: c.info}))
  [cursor, glow, shield]->Array.forEach(m => {
    m->position->set3(0.0, -.r +. 0.55, 0.0)
    s.player->add(m)
  })
  s.cursor = Some(cursor)
  s.shield = Some(shield)
}

let make = (canvas, colors) => {
  let small: bool = %raw(`Math.min(innerWidth, innerHeight) < 600`)
  let dpr: float = %raw(`devicePixelRatio || 1`)
  let renderer = webGLRenderer({canvas, antialias: !small, powerPreference: "high-performance"})
  renderer->setPixelRatio(Math.min(dpr, small ? 1.5 : 2.0))
  // a steady camera straight down the middle of the tunnel: it never moves
  let camera = perspectiveCamera(~fov=60.0, ~aspect=1.0, ~near=0.1, ~far=200.0)
  camera->position->set3(0.0, 0.0, 5.0)
  camera->lookAt(0.0, 0.0, -30.0)
  let s = {
    renderer,
    scene: scene(),
    camera,
    tube: group(),
    player: group(),
    wallMap: None,
    rings: [],
    shield: None,
    cursor: None,
    pools: Map.make(),
    live: Map.make(),
    materials: [],
    textures: [],
    colors,
  }
  s.player->position->setZ(playerZ)
  s.scene->add(s.tube)
  s.scene->add(s.player)
  setColors(s, colors)
  s
}

/** A new object for a kind of thing, built at angle 0 (the bottom) */
let build = (s, kind: World.kind) => {
  let c = s.colors
  let g = group()
  let wall = (~span, ~center, tex) =>
    g->add(
      mesh(
        arc(~span, ~center, ~inner=r -. 1.6, ~outer=r -. 0.02, ~tile=6.0),
        basic(s, {map: trackTexture(s, tex), side: doubleSide}),
      ),
    )
  let pickup = (tex, w, h) => {
    let sp = sprite(track(s, spriteMaterial({map: trackTexture(s, tex), transparent: true, depthWrite: false})))
    sp->scale->set3(w, h, 1.0)
    sp->position->set3(0.0, -.r +. 0.7, 0.0)
    g->add(sp)
  }
  switch kind {
  | Block =>
    // an editor panel on the rim; it turns to stay upright (see render)
    // small enough, and far enough off the rim, that its corners never reach into the wall as it turns
    let card = mesh(plane(2.4, 1.2), basic(s, {map: trackTexture(s, crashCard(c)), side: doubleSide}))
    card->position->setY(-.r +. 1.4)
    g->add(card)
  // everything but the gap, which is at the bottom
  | Ring =>
    wall(
      ~span=2.0 *. World.pi -. World.spanRing,
      ~center=top,
      arcTexture(c, "fetch('/api') // 404 Not Found", c.warn, ~color=None),
    )
  | Half => wall(~span=World.spanHalf, ~center=bottom, arcTexture(c, "// TODO: fix this later", c.accent2, ~color=Some(c.comment)))
  | Spin =>
    let tex = arcTexture(c, "while (true) {", c.info, ~color=None)
    wall(~span=World.spanSpin, ~center=bottom, tex)
    wall(~span=World.spanSpin, ~center=top, tex)
  | Semi => pickup(token(";", c.success), 0.9, 0.9)
  | Shield => pickup(token("{ }", c.info, ~width=256), 1.4, 0.7)
  | Coffee => pickup(token("☕", c.warn), 0.9, 0.9)
  }
  g
}

let take = (s, kind) => {
  let pool = switch s.pools->Map.get(kind) {
  | Some(p) => p
  | None =>
    let p = []
    s.pools->Map.set(kind, p)
    p
  }
  let o = switch pool->Array.pop {
  | Some(o) => o
  | None => build(s, kind)
  }
  s.tube->add(o)
  o
}

let resize = (s, w, h) => {
  s.renderer->setSize(w, h, false)
  s.camera->setAspect(w /. h)
  // narrow screens: a wider view, so the whole rim stays in sight
  s.camera->setFov(w /. h < 0.9 ? 76.0 : 60.0)
  s.camera->updateProjectionMatrix
}

let render = (s, w: World.t, _steer, time) => {
  // you move around the rim; the tunnel and the camera stay put
  s.player->rotation->setZ(w.angle)
  if !reduceMotion {
    switch s.wallMap {
    | Some(map) => map->offset->setY(w.distance /. len *. 9.0)
    | None => ()
    }
    s.rings->Array.forEachWithIndex((ring, i) => {
      let at = Int.toFloat(i) *. ringGap -. Float.mod(w.distance, ringGap)
      ring->position->setZ(-.Float.mod(at +. len, len) +. 6.0)
    })
  }

  // things: reuse objects by id
  let seen = Set.make()
  w.things->Array.forEach(t =>
    if t.z >= -4.0 && t.z <= len -. 14.0 {
      seen->Set.add(t.id)
      let o = switch s.live->Map.get(t.id) {
      | Some((_, o)) => o
      | None =>
        let o = take(s, t.kind)
        s.live->Map.set(t.id, (t.kind, o))
        o
      }
      o->position->setZ(playerZ -. t.z)
      o->rotation->setZ(t.angle)
      // the error panel stays upright wherever it is on the rim, so it's always readable
      if t.kind == Block {
        switch o->children->Array.get(0) {
        | Some(card) => card->rotation->setZ(-.t.angle)
        | None => ()
        }
      }
    }
  )
  s.live->Map.forEachWithKey(((kind, o), id) =>
    if !(seen->Set.has(id)) {
      s.tube->remove(o)
      switch s.pools->Map.get(kind) {
      | Some(pool) => pool->Array.push(o)
      | None => ()
      }
      s.live->Map.delete(id)->ignore
    }
  )

  // the cursor blinks while waiting; the shield shows when you have one
  let blink = w.phase == Running || mod(Float.toInt(time *. 2.0), 2) == 0
  s.player->setVisible(blink || w.phase == Over)
  switch s.shield {
  | Some(sh) => sh->setVisible(w.shield)
  | None => ()
  }
  switch s.cursor {
  | Some(cu) => cu->setVisible(w.safeFor <= 0.0 || mod(Float.toInt(time *. 10.0), 2) == 0)
  | None => ()
  }
  s.renderer->Three.render(s.scene, s.camera)
}
