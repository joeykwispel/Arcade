// Typed bindings to the parts of Three.js this game uses. ReScript calls them directly: no wrapper code at runtime.

type object3d
type vector
type geometry
type material
type texture
type renderer
type fog

// ---------- scene graph ----------

@module("three") @new external scene: unit => object3d = "Scene"
@module("three") @new external group: unit => object3d = "Group"
@module("three") @new external mesh: (geometry, material) => object3d = "Mesh"
@module("three") @new external sprite: material => object3d = "Sprite"
@module("three") @new
external perspectiveCamera: (~fov: float, ~aspect: float, ~near: float, ~far: float) => object3d =
  "PerspectiveCamera"
@module("three") @new external fog: (string, float, float) => fog = "Fog"

@send external add: (object3d, object3d) => unit = "add"
@send external remove: (object3d, object3d) => unit = "remove"
@send external clear: object3d => unit = "clear"
@get external children: object3d => array<object3d> = "children"
@get external position: object3d => vector = "position"
@get external rotation: object3d => vector = "rotation"
@get external scale: object3d => vector = "scale"
@get external material: object3d => material = "material"
@set external setVisible: (object3d, bool) => unit = "visible"
@set external setFog: (object3d, fog) => unit = "fog"
@send external lookAt: (object3d, float, float, float) => unit = "lookAt"

// cameras
@set external setAspect: (object3d, float) => unit = "aspect"
@set external setFov: (object3d, float) => unit = "fov"
@send external updateProjectionMatrix: object3d => unit = "updateProjectionMatrix"

// vectors and rotations share x/y/z
@get external x: vector => float = "x"
@get external y: vector => float = "y"
@get external z: vector => float = "z"
@set external setX: (vector, float) => unit = "x"
@set external setY: (vector, float) => unit = "y"
@set external setZ: (vector, float) => unit = "z"
@send external set3: (vector, float, float, float) => unit = "set"
@send external set2: (vector, float, float) => unit = "set"

// ---------- geometry ----------

@module("three") @new
external cylinder: (float, float, float, int, int, bool) => geometry = "CylinderGeometry"
@module("three") @new
external ring: (float, float, int, int, float, float) => geometry = "RingGeometry"
@module("three") @new external box: (float, float, float) => geometry = "BoxGeometry"
@module("three") @new external torus: (float, float, int, int) => geometry = "TorusGeometry"
@module("three") @new external plane: (float, float) => geometry = "PlaneGeometry"
@send external rotateX: (geometry, float) => unit = "rotateX"

// ---------- materials and textures ----------

/** Three.js side constants */
let backSide = 1
let doubleSide = 2

type materialOptions = {
  map?: texture,
  color?: string,
  transparent?: bool,
  opacity?: float,
  side?: int,
  depthWrite?: bool,
}

@module("three") @new external basicMaterial: materialOptions => material = "MeshBasicMaterial"
@module("three") @new external spriteMaterial: materialOptions => material = "SpriteMaterial"
@get external map: material => texture = "map"

@module("three") @new external canvasTexture: Browser.element => texture = "CanvasTexture"
@set external setColorSpace: (texture, string) => unit = "colorSpace"
@set external setWrapS: (texture, int) => unit = "wrapS"
@set external setWrapT: (texture, int) => unit = "wrapT"
@set external setAnisotropy: (texture, int) => unit = "anisotropy"
@get external repeat: texture => vector = "repeat"
@get external offset: texture => vector = "offset"
let repeatWrapping = 1000

@send external disposeMaterial: material => unit = "dispose"
@send external disposeTexture: texture => unit = "dispose"

// ---------- renderer ----------

type rendererOptions = {canvas: Browser.element, antialias: bool, powerPreference: string}
@module("three") @new external webGLRenderer: rendererOptions => renderer = "WebGLRenderer"
@send external setPixelRatio: (renderer, float) => unit = "setPixelRatio"
@send external setSize: (renderer, float, float, bool) => unit = "setSize"
@send external setClearColor: (renderer, string) => unit = "setClearColor"
@send external render: (renderer, object3d, object3d) => unit = "render"
