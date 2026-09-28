## Localhost Golf: mini golf through web pages. The rules and holes are in rules.gd; this draws them and takes input.
extends Node2D

enum Phase { TITLE, AIM, ROLL, SUNK, DONE }

const DRAG_FULL := 240.0  ## pixels of pull-back for a full-power shot
const AIM_SPEED := 2.2  ## radians per second with the arrow keys

var lang := "en"
var dark := true
var phase := Phase.TITLE
var hole_i := 0
var strokes := 0
var scores: Array[int] = []
var best := 0
var new_best := false
var ball := {}
var t := 0.0  ## time on this hole, for the moving blocks

var aim := 0.0  ## keyboard aim angle
var charging := false
var charge := 0.0
var dragging := false
var drag_from := Vector2.ZERO
var drag_to := Vector2.ZERO

var message := ""
var message_time := 0.0
var sunk_time := 0.0

var font := _font()


## JetBrains Mono without ligatures: </h1> should look like </h1>.
static func _font() -> Font:
	var f := FontVariation.new()
	f.base_font = preload("res://fonts/JetBrainsMono.ttf")
	f.opentype_features = {TextServerManager.get_primary_interface().name_to_tag("calt"): 0,
		TextServerManager.get_primary_interface().name_to_tag("liga"): 0}
	return f


func hole() -> Dictionary:
	return Rules.HOLES[hole_i]


func _ready() -> void:
	lang = Web.lang()
	dark = Web.dark()
	best = Web.load_best()
	Web.set_html_lang(lang)
	Web.listen(func(l: String) -> void:
		lang = l
		Web.set_html_lang(l)
		queue_redraw(), func(d: bool) -> void:
		dark = d
		queue_redraw())
	_start_hole(0)
	phase = Phase.TITLE
	_report()


func _report() -> void:
	Web.report({"phase": Phase.keys()[phase].to_lower(), "hole": hole_i + 1, "strokes": strokes, "total": _total()})


func _total() -> int:
	var sum := 0
	for s in scores:
		sum += s
	return sum


func _start_hole(i: int) -> void:
	hole_i = i
	strokes = 0
	t = 0.0
	ball = Rules.new_ball(hole().tee)
	# aim at the hole to begin with
	aim = ((hole().hole as Vector2) - (hole().tee as Vector2)).angle()
	phase = Phase.AIM
	_report()


func _new_round() -> void:
	scores.clear()
	new_best = false
	_start_hole(0)


func _shoot(direction: Vector2, power: float) -> void:
	if phase != Phase.AIM or power < 0.04:
		return
	strokes += 1
	Rules.shoot(ball, direction, power)
	phase = Phase.ROLL
	_report()


func _advance() -> void:
	match phase:
		Phase.TITLE:
			_start_hole(0)
		Phase.SUNK:
			if hole_i + 1 < Rules.HOLES.size():
				_start_hole(hole_i + 1)
			else:
				_finish()
		Phase.DONE:
			_new_round()


func _finish() -> void:
	phase = Phase.DONE
	var total := _total()
	if best == 0 or total < best:
		best = total
		new_best = true
		Web.save_best(best)
	_report()


func _sink() -> void:
	scores.append(strokes)
	phase = Phase.SUNK
	sunk_time = 0.0
	var word := Rules.name_of(strokes, int(hole().par))
	_say(Text.score_word(lang, word))
	_report()


func _say(text: String) -> void:
	message = text
	message_time = 2.4


func _process(delta: float) -> void:
	t += delta
	message_time = maxf(0.0, message_time - delta)
	if phase == Phase.AIM:
		if Input.is_action_pressed("ui_left"):
			aim -= AIM_SPEED * delta
		if Input.is_action_pressed("ui_right"):
			aim += AIM_SPEED * delta
		if charging:
			# power swings up and down while Space is held
			charge = fmod(charge + delta * 0.8, 2.0)
	elif phase == Phase.ROLL:
		# fixed small steps, whatever the frame rate
		var steps := ceili(delta / (1.0 / 120.0))
		for _i in steps:
			var e := Rules.step(ball, hole(), t, delta / steps)
			if e == "sunk":
				_sink()
				break
			if e == "splash":
				strokes += 1
				_say(Text.t(lang, "splash"))
				ball.vel = Vector2.ZERO
				break
		if phase == Phase.ROLL and Rules.stopped(ball):
			if strokes >= Rules.MAX_STROKES:
				_say(Text.t(lang, "limit"))
				scores.append(Rules.MAX_STROKES + 1)
				phase = Phase.SUNK
				sunk_time = 0.0
			else:
				phase = Phase.AIM
			_report()
	elif phase == Phase.SUNK:
		sunk_time += delta
	queue_redraw()


func _power() -> float:
	return charge if charge <= 1.0 else 2.0 - charge


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.keycode == KEY_SPACE and not event.echo:
		if phase == Phase.AIM:
			if event.pressed:
				charging = true
				charge = 0.0
			elif charging:
				charging = false
				_shoot(Vector2.RIGHT.rotated(aim), _power())
		elif event.pressed:
			_advance()
		get_viewport().set_input_as_handled()
	elif event is InputEventKey and event.pressed and event.keycode == KEY_ENTER:
		if phase != Phase.AIM and phase != Phase.ROLL:
			_advance()
	elif event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_LEFT:
		if phase == Phase.AIM:
			if event.pressed:
				dragging = true
				drag_from = event.position
				drag_to = event.position
			elif dragging:
				dragging = false
				var pull := drag_from - drag_to
				if pull.length() > 8.0:
					aim = pull.angle()
					_shoot(pull, pull.length() / DRAG_FULL)
		elif event.pressed and phase != Phase.ROLL:
			_advance()
	elif event is InputEventMouseMotion and dragging:
		drag_to = event.position
		var pull := drag_from - drag_to
		if pull.length() > 8.0:
			aim = pull.angle()


# ---------- drawing ----------

func c(name: String) -> Color:
	var dark_colors := {
		"page": Color("0d1220"), "grid": Color("141b2e"), "panel": Color("182033"), "border": Color("2c3a57"),
		"text": Color("e6e9f2"), "muted": Color("98a3b9"), "accent": Color("7dd3c0"), "accent2": Color("c3b1ff"),
		"danger": Color("f7768e"), "warn": Color("e0af68"), "ok": Color("9ece6a"), "hole": Color("05080f"),
		"ball": Color("ffffff"), "shade": Color(0, 0, 0, 0.6),
	}
	var light_colors := {
		"page": Color("ffffff"), "grid": Color("f1f3f8"), "panel": Color("e8ecf4"), "border": Color("c3cad9"),
		"text": Color("141b2d"), "muted": Color("4b566d"), "accent": Color("0f766e"), "accent2": Color("5b3fc4"),
		"danger": Color("b4233f"), "warn": Color("8a5300"), "ok": Color("2f6b1f"), "hole": Color("141b2d"),
		"ball": Color("ffffff"), "shade": Color(1, 1, 1, 0.75),
	}
	return (dark_colors if dark else light_colors)[name]


func text_at(pos: Vector2, s: String, size: int, color: Color, align := HORIZONTAL_ALIGNMENT_LEFT, width := -1.0) -> void:
	draw_string(font, pos, s, align, width, size, color)


func centered(y: float, s: String, size: int, color: Color) -> void:
	draw_string(font, Vector2(0, y), s, HORIZONTAL_ALIGNMENT_CENTER, Rules.W, size, color)


func _draw() -> void:
	var h := hole()
	# the bars around the page (when the frame isn't 16:10) take the page's colour too
	RenderingServer.set_default_clear_color(c("border"))
	draw_rect(Rect2(0, 0, Rules.W, Rules.H), c("page"))
	for x in range(0, int(Rules.W), 40):
		draw_line(Vector2(x, 0), Vector2(x, Rules.H), c("grid"))
	for y in range(0, int(Rules.H), 40):
		draw_line(Vector2(0, y), Vector2(Rules.W, y), c("grid"))
	draw_rect(Rect2(0, 0, Rules.W, Rules.H), c("border"), false, Rules.BORDER * 2)

	for b in h.blocks:
		_draw_block(b)

	# the hole, and the 404 page it leads to
	var hp: Vector2 = h.hole
	draw_circle(hp, Rules.HOLE_R + 4, c("border"))
	draw_circle(hp, Rules.HOLE_R, c("hole"))
	text_at(hp + Vector2(-40, Rules.HOLE_R + 20), "404", 15, c("danger"), HORIZONTAL_ALIGNMENT_CENTER, 80)
	draw_line(hp, hp + Vector2(0, -44), c("muted"), 2)
	draw_colored_polygon(PackedVector2Array([hp + Vector2(0, -44), hp + Vector2(22, -37), hp + Vector2(0, -30)]), c("danger"))

	# the tee
	draw_circle(h.tee, 5, c("border"))

	# the aim line
	if phase == Phase.AIM:
		var power := _power() if charging else (clampf((drag_from - drag_to).length() / DRAG_FULL, 0, 1) if dragging else 0.35)
		var dir := Vector2.RIGHT.rotated(aim)
		var length := 30.0 + power * 170.0
		var col := c("accent").lerp(c("danger"), power)
		var d := 0.0
		while d < length:
			draw_line(ball.pos + dir * d, ball.pos + dir * minf(d + 7.0, length), col, 3)
			d += 13.0
		if dragging or charging:
			text_at(ball.pos + dir * (length + 12) - Vector2(20, -5), "%d%%" % roundi(power * 100), 13, col, HORIZONTAL_ALIGNMENT_CENTER, 40)

	# the ball (it shrinks into the hole once sunk)
	if phase != Phase.SUNK or sunk_time < 0.4:
		var r := Rules.BALL_R * (1.0 - clampf(sunk_time / 0.4, 0, 1) if phase == Phase.SUNK else 1.0)
		draw_circle(ball.pos + Vector2(2, 3), r, Color(0, 0, 0, 0.25))
		draw_circle(ball.pos, r, c("ball"))
		draw_arc(ball.pos, r, 0, TAU, 20, Color(0, 0, 0, 0.35), 1.5)

	_draw_hud()
	if message_time > 0.0 and phase != Phase.TITLE:
		var a := clampf(message_time / 0.4, 0, 1)
		var col := c("text")
		col.a = a
		centered(Rules.H - 34, message, 22, col)

	match phase:
		Phase.TITLE:
			_draw_title()
		Phase.SUNK:
			if sunk_time > 0.8:
				_draw_card(false)
		Phase.DONE:
			_draw_card(true)


func _draw_block(b: Dictionary) -> void:
	var r := Rules.block_rect(b, t)
	var label := str(b.get("label", ""))
	match b.kind:
		"wall":
			draw_rect(r, c("panel"))
			draw_rect(r, c("border"), false, 2)
			text_at(r.position + Vector2(8, 20), label, 13, c("muted"), HORIZONTAL_ALIGNMENT_LEFT, r.size.x - 12)
		"bumper":
			draw_rect(r, c("accent"))
			text_at(r.position + Vector2(0, r.size.y / 2 + 5), label, 13, c("page"), HORIZONTAL_ALIGNMENT_CENTER, r.size.x)
		"sand":
			var sand := c("warn")
			sand.a = 0.18
			draw_rect(r, sand)
			draw_rect(r, c("warn"), false, 1.5)
			text_at(r.position + Vector2(8, 20), label, 13, c("warn"), HORIZONTAL_ALIGNMENT_LEFT, r.size.x - 12)
		"iframe":
			var water := c("accent2")
			water.a = 0.22
			draw_rect(r, water)
			draw_rect(r, c("accent2"), false, 2)
			for i in range(1, int(r.size.y / 26)):
				var y := r.position.y + i * 26
				var x := r.position.x + 10.0
				while x < r.end.x - 20:
					draw_arc(Vector2(x + 7, y + 3 * sin(t * 2 + x)), 7, PI * 1.1, PI * 1.9, 6, c("accent2"), 1.5)
					x += 22
			text_at(r.position + Vector2(8, 20), label, 13, c("accent2"), HORIZONTAL_ALIGNMENT_LEFT, r.size.x - 12)


func _draw_hud() -> void:
	var h := hole()
	var total := _total()
	var par_so_far := 0
	for i in scores.size():
		par_so_far += int(Rules.HOLES[i].par)
	var s := "%s %d/%d · %s · %s %d · %s %d · %s %s" % [
		Text.t(lang, "hole"), hole_i + 1, Rules.HOLES.size(), h.page, Text.t(lang, "par"), h.par,
		Text.t(lang, "strokes"), strokes, Text.t(lang, "total"), Rules.to_par(total, par_so_far) if scores.size() else "E",
	]
	var bg := c("page")
	bg.a = 0.85
	draw_rect(Rect2(Rules.W / 2 - 330, 0, 660, 26), bg)
	text_at(Vector2(0, 18), s, 14, c("text"), HORIZONTAL_ALIGNMENT_CENTER, Rules.W)


func _panel(rect: Rect2) -> void:
	draw_rect(Rect2(0, 0, Rules.W, Rules.H), c("shade"))
	draw_rect(rect, c("page"))
	draw_rect(rect, c("border"), false, 2)


func _draw_title() -> void:
	_panel(Rect2(180, 150, 600, 300))
	centered(215, "<div>", 30, c("accent"))
	centered(265, Text.t(lang, "title"), 40, c("text"))
	centered(310, Text.t(lang, "tagline"), 16, c("muted"))
	draw_multiline_string(font, Vector2(210, 345), Text.t(lang, "how"), HORIZONTAL_ALIGNMENT_CENTER, 540, 14, 3, c("muted"))
	centered(420, Text.t(lang, "start"), 16, c("accent"))


func _draw_card(done: bool) -> void:
	var holes := Rules.HOLES.size()
	_panel(Rect2(200, 110, 560, 380))
	var head := Text.t(lang, "done") if done else message
	centered(160, head, 26, c("text"))
	var y := 205.0
	for i in holes:
		var hh: Dictionary = Rules.HOLES[i]
		var played := i < scores.size()
		var col := c("text") if played else c("muted")
		text_at(Vector2(250, y), "%d  %s" % [i + 1, hh.page], 15, col)
		text_at(Vector2(560, y), "%s %d" % [Text.t(lang, "par"), hh.par], 15, c("muted"))
		if played:
			var sc := scores[i]
			var word_col := c("ok") if sc <= int(hh.par) else c("danger")
			text_at(Vector2(640, y), str(sc), 15, word_col, HORIZONTAL_ALIGNMENT_RIGHT, 70)
		y += 28
	var par_played := 0
	for i in scores.size():
		par_played += int(Rules.HOLES[i].par)
	text_at(Vector2(250, y + 10), "%s %d (%s)" % [Text.t(lang, "total"), _total(), Rules.to_par(_total(), par_played)], 17, c("text"))
	if done:
		var line := Text.t(lang, "new_best") if new_best else "%s %d" % [Text.t(lang, "best"), best]
		text_at(Vector2(250, y + 38), line, 15, c("accent") if new_best else c("muted"))
	centered(470, Text.t(lang, "again") if done else Text.t(lang, "next"), 15, c("accent"))
