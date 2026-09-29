// The WebAssembly face of the game, built with TinyGo (`-target wasm-unknown`): plain exported functions, no JS glue.
// The page calls them and reads the state from two buffers in the module's memory.
package main

import (
	"unsafe"

	game "mergeconflict"
)

var g = game.New(1)

// State, as int32s (the offsets are in web/main.js too):
//
//	0 phase  1 score  2 lines  3 level  4 choice ms left  5 choice ms  6 ours kind  7 theirs kind  8 queued kind
//	9 side of the falling piece  10 cleared rows (bits)  11 fast-forwards
//	16..23 falling piece cells (x, y)  24..31 its ghost  32..39 the ours option  40..47 the theirs option
var state [48]int32

// The board, a byte per cell, row by row: 0 empty, 1 ours, 2 theirs.
var board [game.H * game.W]uint8

func cells(dst []int32, p game.Piece) {
	for i, c := range p.Cells() {
		dst[2*i], dst[2*i+1] = int32(c[0]), int32(c[1])
	}
}

//export start
func start(seed uint32) { g = game.New(seed) }

//export tick
func tick(ms int32) { g.Tick(int(ms)) }

//export input
func input(a int32) { g.Input(int(a)) }

//export choose
func choose(c int32) { g.Choose(int(c)) }

//export update
func update() {
	state[0], state[1], state[2], state[3] = int32(g.Phase), int32(g.Score), int32(g.Lines), int32(g.Level)
	state[4], state[5] = int32(g.ChoiceLeft), int32(g.ChoiceTime())
	state[6], state[7], state[8] = int32(g.OptOurs), int32(g.OptTheirs), int32(g.Queued)
	state[9], state[10], state[11] = int32(g.Cur.Side), int32(g.Cleared), int32(g.FastForwards)
	cells(state[16:24], g.Cur)
	cells(state[24:32], g.Ghost())
	cells(state[32:40], game.Piece{Kind: g.OptOurs})
	cells(state[40:48], game.Piece{Kind: g.OptTheirs})
	for y := 0; y < game.H; y++ {
		copy(board[y*game.W:], g.Board[y][:])
	}
}

//export state_ptr
func statePtr() uintptr { return uintptr(unsafe.Pointer(&state[0])) }

//export board_ptr
func boardPtr() uintptr { return uintptr(unsafe.Pointer(&board[0])) }

func main() {}
