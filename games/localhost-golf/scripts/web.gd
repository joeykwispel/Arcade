## The browser around the game, through JavaScriptBridge (no eval: the page's CSP doesn't allow it).
## Language and theme from the arcade, the best score, and data attributes on <body> for the end-to-end tests.
## Outside a browser (the editor, the tests) everything here quietly does nothing.
class_name Web
extends RefCounted

const BEST_KEY := "play:localhost-golf:best"

## Kept alive for as long as the game runs: JavaScript holds on to it.
static var _on_message: JavaScriptObject


static func available() -> bool:
	return OS.has_feature("web")


static func _window() -> JavaScriptObject:
	return JavaScriptBridge.get_interface("window") if available() else null


## "en" or "nl": ?lang=, else the browser's language.
static func lang() -> String:
	var win := _window()
	if win == null:
		return "en"
	var search := str(win.location.search)
	for part in search.trim_prefix("?").split("&"):
		if part == "lang=nl" or part == "lang=en":
			return part.substr(5)
	return "nl" if str(win.navigator.language).begins_with("nl") else "en"


## Dark unless the arcade around the frame, its jo-theme cookie or localStorage says light.
static func dark() -> bool:
	var win := _window()
	if win == null:
		return true
	var theme := ""
	var frame = win.frameElement
	if frame != null:
		theme = str(frame.ownerDocument.documentElement.getAttribute("data-theme"))
	if theme != "light" and theme != "dark":
		var cookie := str(win.document.cookie)
		if cookie.contains("jo-theme=light"):
			theme = "light"
		elif cookie.contains("jo-theme=dark"):
			theme = "dark"
	if theme != "light" and theme != "dark":
		theme = str(win.localStorage.getItem("theme"))
	return theme != "light"


## Follows the arcade's {type: 'play:settings', lang, theme} messages.
static func listen(on_lang: Callable, on_dark: Callable) -> void:
	var win := _window()
	if win == null:
		return
	var origin := str(win.location.origin)
	_on_message = JavaScriptBridge.create_callback(func(args: Array) -> void:
		var e = args[0]
		if str(e.origin) != origin or e.data == null or str(e.data.type) != "play:settings":
			return
		var l := str(e.data.lang)
		if l == "en" or l == "nl":
			on_lang.call(l)
		var t := str(e.data.theme)
		if t == "light" or t == "dark":
			on_dark.call(t == "dark"))
	win.addEventListener("message", _on_message)


static func set_html_lang(l: String) -> void:
	var win := _window()
	if win != null:
		win.document.documentElement.setAttribute("lang", l)


## State for the end-to-end tests, as data attributes on <body>.
static func report(state: Dictionary) -> void:
	var win := _window()
	if win == null:
		return
	for k in state:
		win.document.body.setAttribute("data-" + str(k), str(state[k]))


## Best total (fewest strokes over all holes); 0 when there is none yet.
static func load_best() -> int:
	var win := _window()
	if win == null:
		return 0
	return int(str(win.localStorage.getItem(BEST_KEY)))


static func save_best(n: int) -> void:
	var win := _window()
	if win != null:
		win.localStorage.setItem(BEST_KEY, str(n))
