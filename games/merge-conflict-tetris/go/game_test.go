package game

import "testing"

func TestEveryShapeIsFourCellsInEveryRotation(t *testing.T) {
	for k := 0; k < 7; k++ {
		for r := 0; r < 4; r++ {
			seen := map[[2]int]bool{}
			for _, c := range (Piece{Kind: k, Rot: r}).Cells() {
				seen[c] = true
			}
			if len(seen) != 4 {
				t.Fatalf("kind %d rotation %d has %d distinct cells", k, r, len(seen))
			}
		}
	}
}

func TestAConflictOffersTwoDifferentPieces(t *testing.T) {
	for seed := uint32(1); seed < 500; seed++ {
		g := New(seed)
		if g.Phase != Choosing || g.OptOurs == g.OptTheirs {
			t.Fatalf("seed %d: phase %d, ours %d, theirs %d", seed, g.Phase, g.OptOurs, g.OptTheirs)
		}
	}
}

func TestChoosingASideDropsThatPiece(t *testing.T) {
	g := New(7)
	theirs := g.OptTheirs
	g.Choose(Incoming)
	if g.Phase != Falling || g.Cur.Kind != theirs || g.Cur.Side != Theirs {
		t.Fatalf("got %+v", g.Cur)
	}
	g.Input(HardDrop)
	if g.Phase != Choosing {
		t.Fatalf("after landing, a new conflict should be on screen, got phase %d", g.Phase)
	}
	cells := 0
	for y := 0; y < H; y++ {
		for x := 0; x < W; x++ {
			if g.Board[y][x] == Theirs {
				cells++
			}
		}
	}
	if cells != 4 {
		t.Fatalf("4 theirs cells expected on the board, got %d", cells)
	}
}

func TestBothDropsOursThenTheirs(t *testing.T) {
	g := New(9)
	ours, theirs := g.OptOurs, g.OptTheirs
	g.Choose(Both)
	if g.Cur.Kind != ours || g.Cur.Side != Ours || g.Queued != theirs {
		t.Fatalf("first ours, then theirs queued: %+v, queued %d", g.Cur, g.Queued)
	}
	g.Input(HardDrop)
	if g.Phase != Falling || g.Cur.Kind != theirs || g.Cur.Side != Theirs {
		t.Fatalf("theirs should fall next without a choice: phase %d, %+v", g.Phase, g.Cur)
	}
}

func TestTooSlowAndGitKeepsBoth(t *testing.T) {
	g := New(11)
	g.Tick(g.ChoiceTime() + 1)
	if g.Phase != Falling || g.Queued < 0 {
		t.Fatalf("expected both sides after the timeout, phase %d queued %d", g.Phase, g.Queued)
	}
}

func TestPiecesStayOnTheBoard(t *testing.T) {
	g := New(3)
	g.Choose(Current)
	for i := 0; i < 20; i++ {
		g.Input(Left)
	}
	for _, c := range g.Cur.Cells() {
		if c[0] < 0 {
			t.Fatal("moved off the left edge")
		}
	}
	for i := 0; i < 20; i++ {
		g.Input(Rotate)
		g.Input(Right)
	}
	for _, c := range g.Cur.Cells() {
		if c[0] >= W {
			t.Fatal("moved off the right edge")
		}
	}
}

func TestFullRowsClearAndOneSidedRowsFastForward(t *testing.T) {
	g := New(5)
	// bottom row: all ours except one gap; the row above mixed except one gap
	for x := 0; x < W-1; x++ {
		g.Board[H-1][x] = Ours
		g.Board[H-2][x] = uint8(1 + x%2)
	}
	// an I piece standing up fills both gaps (and two more rows' worth of column)
	g.Cur = Piece{Kind: 0, Rot: 1, X: W - 1 - 2, Y: 0, Side: Ours}
	g.Phase = Falling
	if !g.fits(g.Cur) {
		t.Fatal("test piece doesn't fit")
	}
	for _, c := range g.Cur.Cells() {
		if c[0] != W-1 {
			t.Fatalf("expected a vertical I in the last column, got %v", g.Cur.Cells())
		}
	}
	score := g.Score
	g.Input(HardDrop)
	if g.Lines != 2 {
		t.Fatalf("2 lines expected, got %d", g.Lines)
	}
	if g.FastForwards != 1 {
		t.Fatalf("the all-ours row is a fast-forward: got %d", g.FastForwards)
	}
	if g.Score-score < 300+100 {
		t.Fatalf("score for 2 lines + a fast-forward too low: %d", g.Score-score)
	}
	if g.Board[H-1][W-1] != Ours || g.Board[H-2][W-1] != Ours {
		t.Fatal("the rest of the I should have dropped into the bottom rows")
	}
}

func TestStackingToTheTopEndsTheGame(t *testing.T) {
	g := New(13)
	for i := 0; i < 200 && g.Phase != Over; i++ {
		g.Choose(Current)
		g.Input(HardDrop)
	}
	if g.Phase != Over {
		t.Fatal("dropping everything in the middle should end the game")
	}
}

func TestGravityGetsFaster(t *testing.T) {
	g := New(1)
	slow := g.FallTime()
	g.Level = 8
	if g.FallTime() >= slow || g.ChoiceTime() >= 4000 {
		t.Fatal("higher levels should be faster")
	}
}
