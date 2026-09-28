// The boundary with the page: plain C functions (no embind), and a float buffer the page reads each frame.
// Everything that matters happens in game.cpp; web/main.js only draws what this hands it.
#include <emscripten/emscripten.h>

#include <memory>
#include <vector>

#include "game.hpp"

namespace {
std::unique_ptr<dh::Game> game;
// per package: kind, x, y, angle, half width, half height, landed (7 floats)
std::vector<float> frame;
}  // namespace

extern "C" {

EMSCRIPTEN_KEEPALIVE void dh_new(uint32_t seed) { game = std::make_unique<dh::Game>(seed); }
EMSCRIPTEN_KEEPALIVE void dh_start() { game->start(); }
EMSCRIPTEN_KEEPALIVE void dh_pause() { game->pause(); }
EMSCRIPTEN_KEEPALIVE void dh_input(float move, int drop, int rotate, float dt) { game->input(move, drop, rotate, dt); }
EMSCRIPTEN_KEEPALIVE uint32_t dh_update(float dt) { return game->update(dt); }

EMSCRIPTEN_KEEPALIVE int dh_phase() { return static_cast<int>(game->phase()); }
EMSCRIPTEN_KEEPALIVE float dh_crane_x() { return game->craneX(); }
EMSCRIPTEN_KEEPALIVE float dh_crane_y() { return game->craneY(); }
EMSCRIPTEN_KEEPALIVE int dh_current() { return game->current(); }
EMSCRIPTEN_KEEPALIVE int dh_current_rotated() { return game->currentRotated(); }
EMSCRIPTEN_KEEPALIVE int dh_next() { return game->next(); }
EMSCRIPTEN_KEEPALIVE int dh_ready() { return game->ready(); }
EMSCRIPTEN_KEEPALIVE float dh_height() { return game->height(); }
EMSCRIPTEN_KEEPALIVE float dh_best() { return game->best(); }
EMSCRIPTEN_KEEPALIVE int dh_fallen() { return game->fallen(); }
EMSCRIPTEN_KEEPALIVE int dh_max_fallen() { return dh::Game::MAX_FALLEN; }
EMSCRIPTEN_KEEPALIVE int dh_stacked() { return game->stacked(); }
EMSCRIPTEN_KEEPALIVE float dh_platform_half() { return dh::Game::PLATFORM_HALF; }
EMSCRIPTEN_KEEPALIVE const char* dh_unpublished() { return game->unpublished().c_str(); }

// the kinds of package, for labels and sizes
EMSCRIPTEN_KEEPALIVE int dh_kinds() { return static_cast<int>(dh::KINDS.size()); }
EMSCRIPTEN_KEEPALIVE const char* dh_kind_name(int i) { return dh::KINDS[i].name; }
EMSCRIPTEN_KEEPALIVE float dh_kind_w(int i) { return dh::KINDS[i].w; }
EMSCRIPTEN_KEEPALIVE float dh_kind_h(int i) { return dh::KINDS[i].h; }

// fills the frame buffer and returns how many packages are in it
EMSCRIPTEN_KEEPALIVE int dh_frame() {
  frame.clear();
  for (const dh::Package& p : game->packages()) {
    b2Vec2 pos = b2Body_GetPosition(p.body);
    float angle = b2Rot_GetAngle(b2Body_GetRotation(p.body));
    const dh::PackageKind& k = dh::KINDS[p.kind];
    float hw = (p.rotated ? k.h : k.w) / 2, hh = (p.rotated ? k.w : k.h) / 2;
    frame.insert(frame.end(), {static_cast<float>(p.kind), pos.x, pos.y, angle, hw, hh, p.counted ? 1.0f : 0.0f});
  }
  return static_cast<int>(game->packages().size());
}
EMSCRIPTEN_KEEPALIVE const float* dh_frame_ptr() { return frame.data(); }
}
