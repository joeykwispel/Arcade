// Package game holds the rules of Merge Conflict Tetris: a falling-block game where every new piece arrives as a
// merge conflict. You accept the current change (ours), the incoming change (theirs), or both.
//
// No imports on purpose: TinyGo compiles this to a small WebAssembly module (see wasm.go), and `go test` runs it
// natively (see game_test.go).
package game

const (
	W = 10
	H = 20

	// board cells
	Empty  = 0
	Ours   = 1
	Theirs = 2
)

// Phases.
const (
	Choosing = iota // a conflict is on screen: pick a piece
	Falling         // a piece is falling
	Over            // fatal: Exiting because of an unresolved conflict.
)

// Choices.
const (
	Current  = 1 // ours
	Incoming = 2 // theirs
	Both     = 3
)

// Inputs.
const (
	Left = iota + 1
	Right
	Rotate
	SoftDrop
	HardDrop
)

// The seven tetrominoes, as cells in a 4×4 box (x, y pairs), in their first rotation.
var shapes = [7][8]int8{
	{0, 1, 1, 1, 2, 1, 3, 1}, // I
	{1, 0, 2, 0, 1, 1, 2, 1}, // O
	{1, 0, 0, 1, 1, 1, 2, 1}, // T
	{1, 0, 2, 0, 0, 1, 1, 1}, // S
	{0, 0, 1, 0, 1, 1, 2, 1}, // Z
	{0, 0, 0, 1, 1, 1, 2, 1}, // J
	{2, 0, 0, 1, 1, 1, 2, 1}, // L
}

// Piece is a falling tetromino.
type Piece struct {
	Kind, Rot, X, Y, Side int
}

// Cells returns the board cells a piece covers.
func (p Piece) Cells() [4][2]int {
	var out [4][2]int
	for i := 0; i < 4; i++ {
		x, y := int(shapes[p.Kind][2*i]), int(shapes[p.Kind][2*i+1])
		// rotate inside the box: O doesn't, I turns in 4×4, the rest in 3×3
		size := 3
		if p.Kind == 0 {
			size = 4
		}
		if p.Kind != 1 {
			for r := 0; r < p.Rot%4; r++ {
				x, y = size-1-y, x
			}
		}
		out[i] = [2]int{p.X + x, p.Y + y}
	}
	return out
}

// Game is the whole state.
type Game struct {
	Board [H][W]uint8
	Phase int
	Cur   Piece
	// the two sides of the conflict on screen (kinds), and the piece still to come after "both"
	OptOurs, OptTheirs int
	Queued             int // -1: none
	ChoiceLeft         int // ms left to choose; then git takes both
	Score, Lines       int
	Level              int
	FastForwards       int
	fallLeft           int
	rng                uint32
	// rows cleared by the last lock, for the flash (bit per row)
	Cleared uint32
}

// New starts a game.
func New(seed uint32) *Game {
	if seed == 0 {
		seed = 0x9e3779b9
	}
	g := &Game{rng: seed, Level: 1, Queued: -1}
	g.conflict()
	return g
}

func (g *Game) rand(n int) int {
	// xorshift32
	g.rng ^= g.rng << 13
	g.rng ^= g.rng >> 17
	g.rng ^= g.rng << 5
	return int(g.rng % uint32(n))
}

// ChoiceTime is how long you get to pick a side: 4 s, down to 1.5 s.
func (g *Game) ChoiceTime() int {
	t := 4000 - (g.Level-1)*300
	if t < 1500 {
		return 1500
	}
	return t
}

// FallTime is the gravity: ms per row.
func (g *Game) FallTime() int {
	t := 800 - (g.Level-1)*70
	if t < 90 {
		return 90
	}
	return t
}

func (g *Game) conflict() {
	g.Phase = Choosing
	g.OptOurs = g.rand(7)
	g.OptTheirs = g.rand(7)
	if g.OptTheirs == g.OptOurs {
		g.OptTheirs = (g.OptTheirs + 1 + g.rand(6)) % 7
	}
	g.ChoiceLeft = g.ChoiceTime()
}

// Choose resolves the conflict on screen.
func (g *Game) Choose(c int) {
	if g.Phase != Choosing {
		return
	}
	switch c {
	case Current:
		g.spawn(g.OptOurs, Ours)
	case Incoming:
		g.spawn(g.OptTheirs, Theirs)
	case Both:
		g.Queued = g.OptTheirs
		g.spawn(g.OptOurs, Ours)
	}
}

func (g *Game) spawn(kind, side int) {
	g.Cur = Piece{Kind: kind, X: 3, Y: 0, Side: side}
	g.fallLeft = g.FallTime()
	if !g.fits(g.Cur) {
		g.Phase = Over
		return
	}
	g.Phase = Falling
}

func (g *Game) fits(p Piece) bool {
	for _, c := range p.Cells() {
		x, y := c[0], c[1]
		if x < 0 || x >= W || y >= H {
			return false
		}
		if y >= 0 && g.Board[y][x] != Empty {
			return false
		}
	}
	return true
}

// Input moves the falling piece.
func (g *Game) Input(a int) {
	if g.Phase != Falling {
		return
	}
	p := g.Cur
	switch a {
	case Left:
		p.X--
	case Right:
		p.X++
	case Rotate:
		p.Rot = (p.Rot + 1) % 4
		// wall kicks: try a little to the side
		for _, dx := range []int{0, -1, 1, -2, 2} {
			q := p
			q.X += dx
			if g.fits(q) {
				g.Cur = q
				return
			}
		}
		return
	case SoftDrop:
		p.Y++
		if !g.fits(p) {
			g.lock()
			return
		}
		g.Score++
		g.Cur = p
		g.fallLeft = g.FallTime()
		return
	case HardDrop:
		for {
			q := p
			q.Y++
			if !g.fits(q) {
				break
			}
			p = q
			g.Score += 2
		}
		g.Cur = p
		g.lock()
		return
	}
	if g.fits(p) {
		g.Cur = p
	}
}

// Ghost is where the piece would land.
func (g *Game) Ghost() Piece {
	p := g.Cur
	for {
		q := p
		q.Y++
		if !g.fits(q) {
			return p
		}
		p = q
	}
}

func (g *Game) lock() {
	for _, c := range g.Cur.Cells() {
		if c[1] < 0 {
			g.Phase = Over
			return
		}
		g.Board[c[1]][c[0]] = uint8(g.Cur.Side)
	}
	g.clearRows()
	if g.Queued >= 0 {
		k := g.Queued
		g.Queued = -1
		g.spawn(k, Theirs)
		return
	}
	g.conflict()
}

var linePoints = [5]int{0, 100, 300, 500, 800}

func (g *Game) clearRows() {
	g.Cleared = 0
	n := 0
	for y := H - 1; y >= 0; y-- {
		full, same := true, true
		for x := 0; x < W; x++ {
			if g.Board[y][x] == Empty {
				full = false
				break
			}
			if g.Board[y][x] != g.Board[y][0] {
				same = false
			}
		}
		if !full {
			continue
		}
		n++
		g.Cleared |= 1 << uint(y)
		if same {
			// a row that's all one side merges as a fast-forward: double points for it
			g.FastForwards++
			g.Score += 100 * g.Level
		}
	}
	if n == 0 {
		return
	}
	// drop the rows above each cleared one
	dst := H - 1
	for y := H - 1; y >= 0; y-- {
		if g.Cleared&(1<<uint(y)) != 0 {
			continue
		}
		g.Board[dst] = g.Board[y]
		dst--
	}
	for ; dst >= 0; dst-- {
		g.Board[dst] = [W]uint8{}
	}
	g.Score += linePoints[n] * g.Level
	g.Lines += n
	g.Level = 1 + g.Lines/10
}

// Tick lets ms milliseconds pass.
func (g *Game) Tick(ms int) {
	switch g.Phase {
	case Choosing:
		g.ChoiceLeft -= ms
		if g.ChoiceLeft <= 0 {
			// nobody chose: git keeps both sides
			g.Choose(Both)
		}
	case Falling:
		g.fallLeft -= ms
		for g.fallLeft <= 0 && g.Phase == Falling {
			g.fallLeft += g.FallTime()
			p := g.Cur
			p.Y++
			if g.fits(p) {
				g.Cur = p
			} else {
				g.lock()
			}
		}
	}
}
