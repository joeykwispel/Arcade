// The few browser APIs the game needs, typed for ReScript.

type element
type rect = {width: float, height: float, left: float, top: float}
type context2d
type textMetrics = {width: float}

@val external document: {..} = "document"
@val external window: {..} = "window"
@val external performanceNow: unit => float = "performance.now"
@val external requestAnimationFrame: (float => unit) => unit = "requestAnimationFrame"

@val @scope("document") external getElementById: string => element = "getElementById"
@val @scope("document") external createElement: string => element = "createElement"
@set external setTextContent: (element, string) => unit = "textContent"
@get external textContent: element => string = "textContent"
@set external setHidden: (element, bool) => unit = "hidden"
@send external setAttribute: (element, string, string) => unit = "setAttribute"
@send external getBoundingClientRect: element => rect = "getBoundingClientRect"
@send external setPointerCapture: (element, int) => unit = "setPointerCapture"
@send external addEventListener: (element, string, 'event => unit) => unit = "addEventListener"
@set external setWidth: (element, int) => unit = "width"
@set external setHeight: (element, int) => unit = "height"

// canvas 2D, for the code texture and labels
@send external getContext2d: (element, @as("2d") _) => context2d = "getContext"
@set external fillStyle: (context2d, string) => unit = "fillStyle"
@set external font: (context2d, string) => unit = "font"
@set external textAlign: (context2d, string) => unit = "textAlign"
@set external textBaseline: (context2d, string) => unit = "textBaseline"
@send external fillRect: (context2d, float, float, float, float) => unit = "fillRect"
@send external fillText: (context2d, string, float, float) => unit = "fillText"
@send external measureText: (context2d, string) => textMetrics = "measureText"

// events
type keyboardEvent = {code: string, repeat: bool, ctrlKey: bool, metaKey: bool, altKey: bool}
type pointerEvent = {isPrimary: bool, clientX: float, pointerId: int}
type messageEvent = {origin: string, data: Nullable.t<{"type": Nullable.t<string>, "theme": Nullable.t<string>, "lang": Nullable.t<string>}>}
type storageEvent = {key: Nullable.t<string>, newValue: Nullable.t<string>}
@send external preventDefault: 'event => unit = "preventDefault"

// storage that doesn't throw in private mode
let storageGet: string => option<string> = key =>
  %raw(`k => { try { return localStorage.getItem(k) ?? undefined } catch { return undefined } }`)(key)
let storageSet: (string, string) => unit = (key, value) =>
  %raw(`(k, v) => { try { localStorage.setItem(k, v) } catch {} }`)(key, value)

/** The value of a CSS custom property on <html> */
let cssVar: string => string = name =>
  %raw(`n => getComputedStyle(document.documentElement).getPropertyValue(n).trim()`)(name)

@val @scope("window") external focusWindow: unit => unit = "focus"
@val @scope(("document", "documentElement", "classList")) external addHtmlClass: string => unit = "add"
