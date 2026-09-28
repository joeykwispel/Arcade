## The rules of Localhost Golf, without any drawing: the holes (web pages), the ball physics, and the scoring.
## Pure functions on plain data, so tests/run_tests.gd can play every hole headless.
class_name Rules
extends RefCounted

const W := 960.0
const H := 600.0
const BALL_R := 9.0
const HOLE_R := 15.0
## Faster than this and the ball rolls over the hole.
const SINK_SPEED := 520.0
const MAX_SHOT := 1100.0
const STOP_SPEED := 9.0
const MAX_STROKES := 10
const BORDER := 14.0

## Friction per second: the speed left after one second on the page, and in a <textarea> (sand).
const ROLL := 0.42
const SAND := 0.03
## Rolling resistance on top of that, in px/s², so a slow ball comes to a stop instead of creeping.
const ROLL_DECEL := 70.0
const BOUNCE := 0.72
## <button>s kick the ball back harder than they receive it.
const BUMPER := 1.25

## Each hole is a web page. Blocks: "wall" (a div), "bumper" (a button), "sand" (a textarea, slows you down),
## "iframe" (water: the ball falls in, one stroke penalty). A block with "move" slides back and forth.
const HOLES := [
	{
		"page": "index.html",
		"par": 2,
		"tee": Vector2(130, 470),
		"hole": Vector2(820, 180),
		"blocks": [
			{"kind": "wall", "rect": Rect2(14, 14, 932, 46), "label": "<nav>"},
			{"kind": "wall", "rect": Rect2(360, 250, 250, 70), "label": "<h1>Hello, world</h1>"},
		],
	},
	{
		"page": "about.html",
		"par": 3,
		"tee": Vector2(110, 500),
		"hole": Vector2(850, 500),
		"blocks": [
			{"kind": "wall", "rect": Rect2(300, 14, 44, 400), "label": "<p>"},
			{"kind": "wall", "rect": Rect2(610, 190, 44, 396), "label": "<p>"},
			{"kind": "sand", "rect": Rect2(380, 470, 200, 100), "label": "<textarea>"},
		],
	},
	{
		"page": "contact.html",
		"par": 3,
		"tee": Vector2(90, 300),
		"hole": Vector2(860, 110),
		"blocks": [
			{"kind": "wall", "rect": Rect2(240, 150, 440, 40), "label": "<input name=\"email\">"},
			{"kind": "wall", "rect": Rect2(300, 270, 440, 40), "label": "<input name=\"name\">"},
			{"kind": "sand", "rect": Rect2(240, 390, 440, 90), "label": "<textarea name=\"message\">"},
			{"kind": "bumper", "rect": Rect2(760, 470, 130, 46), "label": "<button>Send</button>"},
		],
	},
	{
		"page": "modal.html",
		"par": 3,
		"tee": Vector2(110, 300),
		"hole": Vector2(850, 300),
		"blocks": [
			{"kind": "wall", "rect": Rect2(390, 220, 180, 160), "label": "<dialog open>", "move": Vector2(0, 170), "period": 3.2},
			{"kind": "wall", "rect": Rect2(250, 14, 40, 150), "label": "<aside>"},
			{"kind": "wall", "rect": Rect2(670, 436, 40, 150), "label": "<aside>"},
			{"kind": "bumper", "rect": Rect2(460, 60, 40, 40), "label": "×"},
		],
	},
	{
		"page": "cookies.html",
		"par": 4,
		"tee": Vector2(100, 110),
		"hole": Vector2(860, 480),
		"blocks": [
			{"kind": "iframe", "rect": Rect2(380, 200, 200, 260), "label": "<iframe>"},
			{"kind": "wall", "rect": Rect2(14, 250, 260, 36), "label": "<header>"},
			{"kind": "wall", "rect": Rect2(620, 380, 326, 36), "label": "<section>"},
			{"kind": "wall", "rect": Rect2(200, 520, 300, 60), "label": "<div class=\"cookie-banner\">", "move": Vector2(260, 0), "period": 4.0},
			{"kind": "bumper", "rect": Rect2(720, 150, 110, 40), "label": "<button>Accept</button>"},
		],
	},
	{
		"page": "404.html",
		"par": 4,
		"tee": Vector2(90, 520),
		"hole": Vector2(480, 300),
		"blocks": [
			{"kind": "wall", "rect": Rect2(360, 190, 240, 30), "label": "<div>"},
			{"kind": "wall", "rect": Rect2(360, 380, 240, 30), "label": "<div>"},
			{"kind": "wall", "rect": Rect2(360, 220, 30, 160), "label": ""},
			{"kind": "wall", "rect": Rect2(570, 220, 30, 60), "label": ""},
			{"kind": "wall", "rect": Rect2(160, 100, 40, 330), "label": "<ul>"},
			{"kind": "wall", "rect": Rect2(720, 170, 40, 330), "label": "<ol>"},
			{"kind": "bumper", "rect": Rect2(640, 60, 44, 44), "label": "<a>"},
			{"kind": "bumper", "rect": Rect2(270, 470, 44, 44), "label": "<a>"},
			{"kind": "sand", "rect": Rect2(420, 470, 220, 70), "label": "<textarea>"},
			{"kind": "wall", "rect": Rect2(820, 260, 110, 40), "label": "<nav>", "move": Vector2(0, 180), "period": 3.0},
		],
	},
]


## The page's own edges: walls on all four sides.
static func borders() -> Array:
	return [
		{"kind": "edge", "rect": Rect2(0, 0, W, BORDER)},
		{"kind": "edge", "rect": Rect2(0, H - BORDER, W, BORDER)},
		{"kind": "edge", "rect": Rect2(0, 0, BORDER, H)},
		{"kind": "edge", "rect": Rect2(W - BORDER, 0, BORDER, H)},
	]


## Where a block is at time t (moving ones slide back and forth), and how fast it is going.
static func block_rect(b: Dictionary, t: float) -> Rect2:
	var r: Rect2 = b.rect
	if b.has("move"):
		var phase := sin(TAU * t / float(b.period))
		r.position += (b.move as Vector2) * phase
	return r


static func block_velocity(b: Dictionary, t: float) -> Vector2:
	if not b.has("move"):
		return Vector2.ZERO
	var period := float(b.period)
	return (b.move as Vector2) * cos(TAU * t / period) * TAU / period


## A ball in play: {"pos", "vel", "last"} (last: where the shot was taken from, for the iframe penalty).
static func new_ball(pos: Vector2) -> Dictionary:
	return {"pos": pos, "vel": Vector2.ZERO, "last": pos}


static func shoot(ball: Dictionary, direction: Vector2, power: float) -> void:
	ball.last = ball.pos
	ball.vel = direction.normalized() * clampf(power, 0.0, 1.0) * MAX_SHOT


static func stopped(ball: Dictionary) -> bool:
	return (ball.vel as Vector2).length() < STOP_SPEED


## Moves the ball by dt seconds. Returns what happened: "" (rolling), "bump" (hit something), "sunk", or "splash".
static func step(ball: Dictionary, hole: Dictionary, t: float, dt: float) -> String:
	var event := ""
	var pos: Vector2 = ball.pos
	var vel: Vector2 = ball.vel
	# small substeps, so a fast ball can't jump through a thin wall
	var n := maxi(1, ceili(vel.length() * dt / (BALL_R * 0.5)))
	var h := dt / n
	var blocks: Array = borders() + (hole.blocks as Array)
	for _i in n:
		pos += vel * h
		var in_sand := false
		for b in blocks:
			var r := block_rect(b, t)
			if b.kind == "sand" or b.kind == "iframe":
				if r.has_point(pos):
					if b.kind == "iframe":
						ball.pos = ball.last
						ball.vel = Vector2.ZERO
						return "splash"
					in_sand = true
				continue
			var closest := Vector2(clampf(pos.x, r.position.x, r.end.x), clampf(pos.y, r.position.y, r.end.y))
			var d := pos - closest
			var dist := d.length()
			if dist >= BALL_R:
				continue
			var normal: Vector2
			if dist > 0.0001:
				normal = d / dist
			else:
				# the centre is inside (a moving block ran into it): push out the shortest way
				var gaps := [pos.x - r.position.x, r.end.x - pos.x, pos.y - r.position.y, r.end.y - pos.y]
				var i: int = gaps.find(gaps.min())
				normal = [Vector2.LEFT, Vector2.RIGHT, Vector2.UP, Vector2.DOWN][i]
				dist = -float(gaps[i])
			pos += normal * (BALL_R - dist)
			var bv := block_velocity(b, t)
			var rel := vel - bv
			var into := rel.dot(normal)
			if into < 0.0:
				var e := BUMPER if b.kind == "bumper" else BOUNCE
				rel -= (1.0 + e) * into * normal
				vel = rel + bv
				if b.kind == "bumper":
					vel += normal * 120.0
				event = "bump"
		vel *= pow(SAND if in_sand else ROLL, h)
		var speed := vel.length()
		vel = Vector2.ZERO if speed <= ROLL_DECEL * h else vel * (1.0 - ROLL_DECEL * h / speed)
		# the hole: slow enough and it drops, too fast and it lips out
		var to_hole: Vector2 = (hole.hole as Vector2) - pos
		if to_hole.length() < HOLE_R:
			if vel.length() < SINK_SPEED:
				ball.pos = hole.hole
				ball.vel = Vector2.ZERO
				return "sunk"
			vel = vel.rotated(0.25 * signf(vel.cross(to_hole)))
		if vel.length() < STOP_SPEED:
			vel = Vector2.ZERO
	ball.pos = pos
	ball.vel = vel
	return event


## Golf words for a score on one hole.
static func name_of(strokes: int, par: int) -> String:
	if strokes == 1:
		return "ace"
	match strokes - par:
		-3:
			return "albatross"
		-2:
			return "eagle"
		-1:
			return "birdie"
		0:
			return "par"
		1:
			return "bogey"
		2:
			return "double"
	return "over" if strokes > par else "eagle"


static func total_par() -> int:
	var sum := 0
	for h in HOLES:
		sum += int(h.par)
	return sum


## "+3", "-1", "E" (even), like on a scorecard.
static func to_par(strokes: int, par: int) -> String:
	var d := strokes - par
	if d == 0:
		return "E"
	return ("+%d" if d > 0 else "%d") % d
