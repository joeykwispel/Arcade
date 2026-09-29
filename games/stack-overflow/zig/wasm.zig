//! The WebAssembly face of the game: plain exported functions, no imports. The page calls them and reads the stack
//! from the module's memory: `frames_ptr()` points at max_depth (x, w) pairs of f32.
const game = @import("game.zig");

var g: game.Game = .{};

export fn start() void {
    g.start();
}

export fn step(ms: f32) void {
    g.step(ms / 1000);
}

export fn drop() void {
    g.drop();
}

export fn phase() u32 {
    return @intFromEnum(g.phase);
}

export fn depth() u32 {
    return @intCast(g.depth);
}

export fn score() u32 {
    return g.score;
}

export fn streak() u32 {
    return g.streak;
}

export fn last_drop() u32 {
    return @intFromEnum(g.last);
}

export fn cut() f32 {
    return g.cut;
}

export fn slider_x() f32 {
    return g.x;
}

export fn slider_w() f32 {
    return g.w;
}

export fn world_width() f32 {
    return game.world;
}

export fn max_depth() u32 {
    return game.max_depth;
}

export fn frames_ptr() [*]const game.Frame {
    return &g.frames;
}
