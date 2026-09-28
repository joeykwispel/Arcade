// The 3D side: a tunnel lined with scrolling code, the obstacles and pickups from World, and you (a blinking cursor)
// at the bottom. The tunnel turns around you, so you always stay at the bottom of the screen.
// Objects are pooled per kind and reused: nothing is created while a run is going.

open Three

let r = 5.0
let len = 130.0
let ringGap = 12.0
/** How far into the tunnel you ride, in front of the camera; things reach you here */
let playerZ = -3.5
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
  /** text on the colored obstacles */
  ink: string,
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

let keywords = %re("/^(function|const|let|while|if|throw|new|return|export|async|await|for|import|from|class|extends|catch)$/")

let texture = (canvas): texture => {
  let t = canvasTexture(canvas)
  t->setColorSpace("srgb")
  t
}

/** The code on the tunnel wall: one canvas, repeated and scrolled */
let codeTexture = c => {
  let canvas = Browser.createElement("canvas")
  canvas->Browser.setWidth(1024)
  canvas->Browser.setHeight(1024)
  let g = canvas->Browser.getContext2d
  g->Browser.fillStyle(c.bg)
  g->Browser.fillRect(0.0, 0.0, 1024.0, 1024.0)
  g->Browser.font(`500 26px ${mono}`)
  g->Browser.textBaseline("top")
  for i in 0 to 23 {
    let line = lines->Array.getUnsafe(mod(i, Array.length(lines)))
    let y = 16.0 +. Int.toFloat(i) *. 42.0
    g->Browser.fillStyle(c.comment)
    g->Browser.fillText(String.padStart(Int.toString(i + 1), 3, " "), 12.0, y)
    // a rough highlight: comments, strings, keywords, the rest
    let x = ref(80.0)
    line
    ->String.splitByRegExp(%re("/(\/\/.*$|'[^']*'|\s+)/"))
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
  }
  let t = texture(canvas)
  t->setWrapS(repeatWrapping)
  t->setWrapT(repeatWrapping)
  // negative: the tunnel is seen from the inside, which would mirror the text
  t->repeat->set2(-3.0, 5.0)
  t->setAnisotropy(4)
  t
}

/** A word drawn on a transparent canvas */
let label = (text, color, ~width=512, ~height=128, ~size=64) => {
  let canvas = Browser.createElement("canvas")
  canvas->Browser.setWidth(width)
  canvas->Browser.setHeight(height)
  let g = canvas->Browser.getContext2d
  g->Browser.font(`800 ${Int.toString(size)}px ${mono}`)
  g->Browser.textAlign("center")
  g->Browser.textBaseline("middle")
  g->Browser.fillStyle(color)
  g->Browser.fillText(text, Int.toFloat(width) /. 2.0, Int.toFloat(height) /. 2.0)
  texture(canvas)
}

/** A piece of the tunnel's inner rim, as a flat band facing you: `span` radians wide, centered at `center` */
let band = (span, center) =>
  ring(r -. 1.7, r -. 0.02, Math.Int.max(6, Float.toInt(span *. 12.0)), 1, center -. span /. 2.0, span)

let bottom = -.World.pi /. 2.0

type t = {
  renderer: renderer,
  scene: object3d,
  camera: object3d,
  tube: object3d,
  player: object3d,
  mutable tunnelMap: option<texture>,
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
let spriteOf = (s, tex, w, h) => {
  let sp = sprite(track(s, spriteMaterial({map: trackTexture(s, tex), transparent: true, depthWrite: false})))
  sp->scale->set3(w, h, 1.0)
  sp
}
let onFloor = o => {
  o->position->set3(0.0, -.r +. 0.7, 0.0)
  o
}

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

  s.scene->setFog(fog(c.bg, 18.0, 95.0))
  s.renderer->setClearColor(c.bg)

  let map = trackTexture(s, codeTexture(c))
  s.tunnelMap = Some(map)
  let geo = cylinder(r, r, len, 36, 1, true)
  geo->rotateX(World.pi /. 2.0)
  let tunnel = mesh(geo, basic(s, {map, side: backSide}))
  tunnel->position->setZ(-.len /. 2.0 +. 6.0)
  s.tube->add(tunnel)

  let ringMat = basic(s, {color: c.accent, transparent: true, opacity: 0.35})
  for _ in 1 to Float.toInt(len /. ringGap) {
    let rm = mesh(torus(r -. 0.03, 0.025, 4, 48), ringMat)
    s.rings->Array.push(rm)
    s.tube->add(rm)
  }

  // you: a blinking text cursor, with a glow and a shield ring
  let cursor = mesh(box(0.16, 0.55, 0.16), basic(s, {color: c.accent}))
  let glow = mesh(box(0.36, 0.8, 0.36), basic(s, {color: c.accent, transparent: true, opacity: 0.2}))
  let shield = mesh(torus(0.6, 0.04, 6, 32), basic(s, {color: c.info}))
  [cursor, glow, shield]->Array.forEach(m => {
    m->position->set3(0.0, -.r +. 0.5, 0.0)
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
  let camera = perspectiveCamera(~fov=70.0, ~aspect=1.0, ~near=0.1, ~far=200.0)
  camera->position->set3(0.0, -.r *. 0.4, 3.0)
  camera->lookAt(0.0, -.r *. 0.2, -30.0)
  let s = {
    renderer,
    scene: scene(),
    camera,
    tube: group(),
    player: group(),
    tunnelMap: None,
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

/** A new object for a kind of thing, built at angle 0 (the bottom), 0 ahead */
let build = (s, kind: World.kind) => {
  let c = s.colors
  let g = group()
  let wallPiece = (span, color, text, center) => {
    g->add(mesh(band(span, center), basic(s, {color, transparent: true, opacity: 0.82, side: doubleSide})))
    // one label in the middle, more along wide pieces so one is always in view
    let mid = r -. 0.85
    let tex = trackTexture(s, label(text, c.ink))
    let spots = span > World.pi ? [-.span /. 3.0, 0.0, span /. 3.0] : [0.0]
    spots->Array.forEach(off => {
      let t = sprite(track(s, spriteMaterial({map: tex, transparent: true, depthWrite: false})))
      t->scale->set3(2.4, 0.6, 1.0)
      t->position->set3(Math.cos(center +. off) *. mid, Math.sin(center +. off) *. mid, 0.05)
      g->add(t)
    })
  }
  switch kind {
  | Block =>
    let w = r *. World.spanBlock *. 0.95
    let b = mesh(box(w, 1.4, 1.1), basic(s, {color: c.danger}))
    b->position->setY(-.r +. 0.7)
    let tex = trackTexture(s, label("NullPointerException", c.ink, ~width=1024, ~height=160, ~size=70))
    let t = mesh(plane(w *. 0.95, w *. 0.24), basic(s, {map: tex, transparent: true}))
    t->position->set3(0.0, -.r +. 0.9, 0.56)
    g->add(b)
    g->add(t)
  // everything but the gap, which is at the bottom
  | Ring => wallPiece(2.0 *. World.pi -. World.spanRing, c.warn, "404", World.pi /. 2.0)
  | Half => wallPiece(World.spanHalf, c.accent2, "// TODO", bottom)
  | Spin =>
    wallPiece(World.spanSpin, c.info, "while(true)", bottom)
    wallPiece(World.spanSpin, c.info, "while(true)", World.pi /. 2.0)
  | Semi => g->add(onFloor(spriteOf(s, label(";", c.success, ~width=128, ~height=128, ~size=110), 0.9, 0.9)))
  | Shield => g->add(onFloor(spriteOf(s, label("{ }", c.info, ~width=256, ~height=128, ~size=100), 1.4, 0.7)))
  | Coffee => g->add(onFloor(spriteOf(s, label("☕", c.warn, ~width=128, ~height=128, ~size=96), 0.9, 0.9)))
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
  // narrow screens: a wider view, so the tunnel still fits
  s.camera->setFov(w /. h < 0.9 ? 88.0 : 70.0)
  s.camera->updateProjectionMatrix
}

let render = (s, w: World.t, steer, time) => {
  // the tunnel turns so that you are always at the bottom
  s.tube->rotation->setZ(-.w.angle)
  let roll = s.camera->rotation
  roll->setZ(roll->z +. (steer *. 0.06 -. roll->z) *. 0.15)
  switch s.tunnelMap {
  | Some(map) => map->offset->setY(w.distance /. len *. 5.0)
  | None => ()
  }
  s.rings->Array.forEachWithIndex((ring, i) => {
    let at = Int.toFloat(i) *. ringGap -. Float.mod(w.distance, ringGap)
    ring->position->setZ(-.Float.mod(at +. len, len) +. 6.0)
  })

  // things: reuse objects by id
  let seen = Set.make()
  w.things->Array.forEach(t =>
    if t.z >= -3.0 && t.z <= len -. 12.0 {
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
      if World.isPickup(t.kind) {
        switch o->children->Array.get(0) {
        | Some(child) => child->position->setY(-.r +. 0.7 +. Math.sin(time *. 5.0 +. Int.toFloat(t.id)) *. 0.08)
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

  // the cursor blinks while waiting, and the shield spins when you have one
  let blink = w.phase == Running || mod(Float.toInt(time *. 2.0), 2) == 0
  s.player->setVisible(blink || w.phase == Over)
  switch s.shield {
  | Some(sh) =>
    sh->setVisible(w.shield)
    sh->rotation->setY(time *. 3.0)
  | None => ()
  }
  switch s.cursor {
  | Some(cu) => cu->rotation->setY(w.safeFor > 0.0 ? time *. 20.0 : 0.0)
  | None => ()
  }
  s.renderer->Three.render(s.scene, s.camera)
}
