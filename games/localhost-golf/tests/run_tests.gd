## Headless tests for the rules: `godot --headless --path . --script res://tests/run_tests.gd`.
## Exits with 1 when something fails.
extends SceneTree

var failures := 0


func check(ok: bool, what: String) -> void:
	if ok:
		print("  ok  ", what)
	else:
		failures += 1
		printerr("  FAIL ", what)


## Rolls a ball until it stops (or 8 seconds pass). Returns the last event that mattered.
func roll(ball: Dictionary, hole: Dictionary, t0: float = 0.0) -> String:
	var t := t0
	var last := ""
	for _i in 8 * 60:
		var e := Rules.step(ball, hole, t, 1.0 / 60.0)
		t += 1.0 / 60.0
		if e == "sunk" or e == "splash":
			return e
		if e != "":
			last = e
		if Rules.stopped(ball):
			break
	return last


## Walking distance to the hole around the blocks, on a 20 px grid (a straight line would lead into dead ends).
func distance_field(hole: Dictionary) -> Dictionary:
	var cell := 20.0
	var blocked := {}
	for b in Rules.borders() + (hole.blocks as Array):
		if b.kind == "sand":
			continue
		var r := Rules.block_rect(b, 0.0).grow(Rules.BALL_R)
		for x in range(int(r.position.x / cell), int(r.end.x / cell) + 1):
			for y in range(int(r.position.y / cell), int(r.end.y / cell) + 1):
				blocked[Vector2i(x, y)] = true
	var start := Vector2i((hole.hole as Vector2) / cell)
	var dist := {start: 0.0}
	var queue := [start]
	while queue:
		var p: Vector2i = queue.pop_front()
		for d in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
			var q: Vector2i = p + d
			if q.x < 0 or q.y < 0 or q.x > Rules.W / cell or q.y > Rules.H / cell or blocked.has(q) or dist.has(q):
				continue
			dist[q] = dist[p] + cell
			queue.append(q)
	return dist


func walk(field: Dictionary, pos: Vector2) -> float:
	return field.get(Vector2i(pos / 20.0), INF)


## A simple player: tries a fan of shots and takes the one that ends closest to the hole (walking distance).
func solve(hole: Dictionary) -> int:
	var field := distance_field(hole)
	var ball := Rules.new_ball(hole.tee)
	for stroke in range(1, Rules.MAX_STROKES + 1):
		var best_d := INF
		var best := {}
		for a in 48:
			for p in [0.2, 0.35, 0.5, 0.65, 0.8, 1.0]:
				var trial := Rules.new_ball(ball.pos)
				Rules.shoot(trial, Vector2.RIGHT.rotated(TAU * a / 48.0), p)
				var e := roll(trial, hole)
				if e == "sunk":
					return stroke
				if e == "splash":
					continue
				var d := walk(field, trial.pos)
				if d < best_d:
					best_d = d
					best = trial
		ball = best
	return Rules.MAX_STROKES + 1


func _init() -> void:
	print("Localhost Golf rules")

	# every hole: tee and hole on the page, not inside a block
	for h in Rules.HOLES:
		for p in [h.tee, h.hole]:
			var inside := false
			for b in h.blocks:
				if Rules.block_rect(b, 0.0).grow(Rules.BALL_R).has_point(p) and b.kind != "sand":
					inside = true
			check(Rect2(20, 20, Rules.W - 40, Rules.H - 40).has_point(p) and not inside, "%s: %s is free" % [h.page, p])

	# a ball bounces off a wall and loses some speed
	var hole: Dictionary = {"page": "t", "par": 1, "tee": Vector2(100, 300), "hole": Vector2(900, 60), "blocks": [
		{"kind": "wall", "rect": Rect2(300, 200, 40, 200)},
	]}
	var ball := Rules.new_ball(Vector2(200, 300))
	Rules.shoot(ball, Vector2.RIGHT, 0.5)
	for _i in 30:
		Rules.step(ball, hole, 0.0, 1.0 / 60.0)
	check((ball.vel as Vector2).x < 0.0, "bounces back off a wall")
	check((ball.pos as Vector2).x < 300.0 - Rules.BALL_R + 0.01, "never ends up inside the wall")

	# a <button> kicks back harder than a <div>
	var speeds := {}
	for kind in ["wall", "bumper"]:
		hole.blocks = [{"kind": kind, "rect": Rect2(300, 200, 40, 200)}]
		ball = Rules.new_ball(Vector2(250, 300))
		ball.vel = Vector2(400, 0)
		for _i in 20:
			Rules.step(ball, hole, 0.0, 1.0 / 120.0)
		speeds[kind] = (ball.vel as Vector2).length()
	check(speeds.bumper > speeds.wall, "a button bounces harder than a div")

	# sand slows the ball far more than the page
	var left := {}
	for kind in ["none", "sand"]:
		hole.blocks = [] if kind == "none" else [{"kind": "sand", "rect": Rect2(0, 0, 960, 600)}]
		ball = Rules.new_ball(Vector2(200, 300))
		ball.vel = Vector2(300, 0)
		Rules.step(ball, hole, 0.0, 0.5)
		left[kind] = (ball.vel as Vector2).length()
	check(left.sand < left.none * 0.3, "a textarea is sand")

	# an iframe swallows the ball and puts it back where the shot started
	hole.blocks = [{"kind": "iframe", "rect": Rect2(400, 250, 100, 100)}]
	ball = Rules.new_ball(Vector2(300, 300))
	Rules.shoot(ball, Vector2.RIGHT, 0.6)
	check(roll(ball, hole) == "splash" and ball.pos == Vector2(300, 300), "an iframe is water")

	# the hole: slow drops in, fast lips out
	hole.blocks = []
	hole.hole = Vector2(400, 300)
	ball = Rules.new_ball(Vector2(300, 300))
	ball.vel = Vector2(200, 0)
	check(roll(ball, hole) == "sunk", "a slow ball drops in")
	ball = Rules.new_ball(Vector2(300, 300))
	ball.vel = Vector2(1100, 0)
	var e := ""
	for _i in 12:
		e = Rules.step(ball, hole, 0.0, 1.0 / 60.0)
		if e == "sunk":
			break
	check(e != "sunk", "a fast ball rolls over")

	# scoring words
	check(Rules.name_of(1, 3) == "ace", "hole in one")
	check(Rules.name_of(2, 3) == "birdie" and Rules.name_of(3, 3) == "par" and Rules.name_of(5, 3) == "double", "birdie, par, double")
	check(Rules.to_par(20, 19) == "+1" and Rules.to_par(19, 19) == "E" and Rules.to_par(17, 19) == "-2", "to par")

	# every hole can be finished by a simple player, not far over par
	for h in Rules.HOLES:
		var strokes := solve(h)
		check(strokes <= int(h.par) + 3, "%s (par %d) solved in %d" % [h.page, h.par, strokes])

	print("%d failure(s)" % failures)
	quit(1 if failures else 0)
