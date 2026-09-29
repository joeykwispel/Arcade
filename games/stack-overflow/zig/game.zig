//! Stack Overflow: the rules. Stack frames slide back and forth; drop each one on the frame below. What hangs over is
//! cut off, so the frames get narrower. Miss completely and it's a segfault. Reach the stack limit and it overflows,
//! which here is the goal.
//!
//! No allocator, no std beyond testing: it compiles to a small freestanding WebAssembly module (see wasm.zig), and
//! `zig test zig/game.zig` runs the tests below.

/// The width of the world, in units (the page scales it to the canvas).
pub const world: f32 = 400;
/// Frames on the stack when it overflows.
pub const max_depth = 64;
/// Dropped this close to the frame below counts as perfect: it snaps into place.
pub const perfect: f32 = 4;
/// Three perfect drops in a row: the frame grows back a little ("tail call optimization").
pub const grow: f32 = 12;
pub const start_width: f32 = 200;

pub const Phase = enum(u8) { ready, playing, segfault, overflow };

pub const Frame = struct { x: f32, w: f32 };

/// What the last drop was, for the page to show.
pub const Drop = enum(u8) { none, cut, perfect, tail_call, missed };

pub const Game = struct {
    phase: Phase = .ready,
    frames: [max_depth]Frame = undefined,
    depth: usize = 0,
    // the frame that is sliding
    x: f32 = 0,
    w: f32 = start_width,
    dir: f32 = 1,
    streak: u32 = 0,
    score: u32 = 0,
    last: Drop = .none,
    /// how much was cut off by the last drop
    cut: f32 = 0,

    pub fn start(self: *Game) void {
        self.* = .{};
        // main() is already on the stack
        self.frames[0] = .{ .x = (world - start_width) / 2, .w = start_width };
        self.depth = 1;
        self.phase = .playing;
        self.spawn();
    }

    /// Slide speed in units per second: faster the deeper you get.
    pub fn speed(self: *const Game) f32 {
        return 140 + @as(f32, @floatFromInt(self.depth)) * 7;
    }

    fn spawn(self: *Game) void {
        // come in from alternating sides
        if (self.depth % 2 == 0) {
            self.x = -self.w * 0.5;
            self.dir = 1;
        } else {
            self.x = world - self.w * 0.5;
            self.dir = -1;
        }
    }

    pub fn step(self: *Game, seconds: f32) void {
        if (self.phase != .playing) return;
        self.x += self.dir * self.speed() * seconds;
        const lo = -self.w * 0.6;
        const hi = world - self.w * 0.4;
        if (self.x < lo) {
            self.x = lo;
            self.dir = 1;
        } else if (self.x > hi) {
            self.x = hi;
            self.dir = -1;
        }
    }

    pub fn top(self: *const Game) Frame {
        return self.frames[self.depth - 1];
    }

    pub fn drop(self: *Game) void {
        if (self.phase != .playing) return;
        const below = self.top();
        const left = @max(self.x, below.x);
        const right = @min(self.x + self.w, below.x + below.w);
        if (right <= left) {
            self.last = .missed;
            self.phase = .segfault;
            return;
        }
        var frame: Frame = undefined;
        if (@abs(self.x - below.x) <= perfect) {
            self.streak += 1;
            frame = .{ .x = below.x, .w = self.w };
            self.last = .perfect;
            self.cut = 0;
            if (self.streak >= 3) {
                const w = @min(frame.w + grow, start_width);
                frame.x -= (w - frame.w) / 2;
                frame.w = w;
                self.last = .tail_call;
            }
            self.score += 2;
        } else {
            self.streak = 0;
            self.cut = self.w - (right - left);
            frame = .{ .x = left, .w = right - left };
            self.last = .cut;
            self.score += 1;
        }
        self.frames[self.depth] = frame;
        self.depth += 1;
        self.w = frame.w;
        if (self.depth >= max_depth) {
            self.phase = .overflow;
            return;
        }
        self.spawn();
    }
};

// ---------- tests ----------

const std = @import("std");
const expect = std.testing.expect;

test "a new game has main() on the stack and a frame sliding in" {
    var g: Game = .{};
    g.start();
    try expect(g.phase == .playing);
    try expect(g.depth == 1);
    try expect(g.w == start_width);
}

test "a perfect drop keeps the width and snaps into place" {
    var g: Game = .{};
    g.start();
    g.x = g.top().x + 2;
    g.drop();
    try expect(g.last == .perfect);
    try expect(g.depth == 2);
    try expect(g.top().x == g.frames[0].x and g.top().w == start_width);
}

test "an off-centre drop cuts off what hangs over" {
    var g: Game = .{};
    g.start();
    g.x = g.top().x + 50;
    g.drop();
    try expect(g.last == .cut);
    try expect(g.top().w == start_width - 50);
    try expect(g.cut == 50);
    try expect(g.w == start_width - 50);
}

test "missing the frame below entirely is a segfault" {
    var g: Game = .{};
    g.start();
    g.x = g.top().x + start_width + 10;
    g.drop();
    try expect(g.phase == .segfault);
    try expect(g.last == .missed);
}

test "three perfect drops in a row grow the frame back, never past the start width" {
    var g: Game = .{};
    g.start();
    g.x = g.top().x + 60;
    g.drop();
    const narrow = g.w;
    for (0..3) |_| {
        g.x = g.top().x;
        g.drop();
    }
    try expect(g.last == .tail_call);
    try expect(g.w > narrow);
    for (0..20) |_| {
        g.x = g.top().x;
        g.drop();
    }
    try expect(g.w <= start_width);
}

test "reaching the stack limit overflows" {
    var g: Game = .{};
    g.start();
    while (g.phase == .playing) {
        g.x = g.top().x;
        g.drop();
    }
    try expect(g.phase == .overflow);
    try expect(g.depth == max_depth);
}

test "the sliding frame stays near the page and speeds up with depth" {
    var g: Game = .{};
    g.start();
    const slow = g.speed();
    for (0..1000) |_| {
        g.step(0.016);
        try expect(g.x >= -g.w * 0.6 - 0.001 and g.x <= world - g.w * 0.4 + 0.001);
    }
    g.x = g.top().x;
    g.drop();
    try expect(g.speed() > slow);
}
