// Tests for the rules, compiled with the same toolchain (Emscripten) and run in Node: `npm test`.
#include <cmath>
#include <cstdio>
#include <functional>
#include <string>

#include "../src/game.hpp"

namespace {
int passed = 0, failed = 0;

void test(const char* name, const std::function<void()>& fn) {
  try {
    fn();
    passed++;
    std::printf("  ok   %s\n", name);
  } catch (const std::string& why) {
    failed++;
    std::printf("  FAIL %s\n       %s\n", name, why.c_str());
  }
}

void check(bool ok, const std::string& why) {
  if (!ok) throw why;
}

int kindOf(const char* name) {
  for (size_t i = 0; i < dh::KINDS.size(); i++) {
    if (std::string(dh::KINDS[i].name) == name) return static_cast<int>(i);
  }
  throw std::string("no kind ") + name;
}

// runs the game for `seconds` with no input
uint32_t run(dh::Game& g, float seconds) {
  uint32_t all = 0;
  for (float t = 0; t < seconds; t += 1.0f / 60) all |= g.update(1.0f / 60);
  return all;
}
}  // namespace

int main() {
  std::printf("dependency hell\n");

  test("a dropped package lands on node_modules and makes the tower taller", [] {
    dh::Game g(1);
    g.start();
    g.dropAt(0, kindOf("express"), false);
    uint32_t events = run(g, 3);
    check(events & dh::Landed, "should land");
    check(g.stacked() == 1, "one package on the tower");
    check(std::fabs(g.height() - 1.0f) < 0.05f, "express is 1.0 m tall, got " + std::to_string(g.height()));
  });

  test("a package that was just let go doesn't count yet, however still it hangs", [] {
    dh::Game g(9);
    g.start();
    g.dropAt(0, kindOf("react"), false);
    run(g, 0.1f);
    check(g.stacked() == 0, "not landed yet");
    check(g.height() == 0 && g.best() == 0, "no height from a package in the air");
  });

  test("packages stack, and rotating one stands it up", [] {
    dh::Game g(2);
    g.start();
    g.dropAt(0, kindOf("lodash"), false);  // 0.5 tall lying down
    run(g, 3);
    g.dropAt(0, kindOf("typescript"), true);  // a 1.2 square, rotated: still 1.2
    run(g, 3);
    check(g.stacked() == 2, "two on the tower");
    check(std::fabs(g.height() - 1.7f) < 0.08f, "0.5 + 1.2 tall, got " + std::to_string(g.height()));
  });

  test("the crane drops the current package and loads the next", [] {
    dh::Game g(3);
    g.start();
    int next = g.next();
    g.input(0, true, false, 1.0f / 60);
    check(g.packages().size() == 1, "one package in the air");
    check(g.current() == next, "the next one is now current");
    g.input(0, true, false, 1.0f / 60);
    check(g.packages().size() == 1, "has to reload first");
  });

  test("the crane stays within reach", [] {
    dh::Game g(4);
    g.start();
    for (int i = 0; i < 600; i++) g.input(1, false, false, 1.0f / 60);
    check(g.craneX() <= dh::Game::CRANE_RANGE + 1e-4f, "not past the right edge");
  });

  test("a package over the edge is a peer dependency conflict; three and it's over", [] {
    dh::Game g(5);
    g.start();
    for (int i = 0; i < dh::Game::MAX_FALLEN; i++) {
      g.dropAt(dh::Game::PLATFORM_HALF + 2.0f, kindOf("chalk"), false);  // next to the platform
      run(g, 3);
    }
    check(g.fallen() == dh::Game::MAX_FALLEN, "all fell");
    check(g.phase() == dh::Phase::Over, "game over");
  });

  test("unpublishing takes a package out of the tower, left-pad first, never the top one", [] {
    dh::Game g(6);
    g.start();
    // left-pad at the bottom, under two wide, stable packages
    g.dropAt(0, kindOf("left-pad"), false);
    run(g, 3);
    g.dropAt(0, kindOf("webpack"), false);
    run(g, 3);
    g.dropAt(0, kindOf("lodash"), false);
    run(g, 5);  // a package has to be still for a moment before it counts
    check(g.stacked() == 3, "three on the tower, got " + std::to_string(g.stacked()));
    g.unpublish();
    check(g.unpublished() == "left-pad", "left-pad goes first, got " + g.unpublished());
    check(g.packages().size() == 2, "one less");
  });

  test("nothing moves before the start, or while paused", [] {
    dh::Game g(7);
    g.dropAt(0, kindOf("react"), false);
    run(g, 2);
    check(g.stacked() == 0, "no physics before the start");
    g.start();
    g.pause();
    g.input(1, true, false, 1.0f / 60);
    check(g.packages().size() == 1 && g.craneX() == 0, "no input while paused");
  });

  std::printf("\n%d passed, %d failed\n", passed, failed);
  return failed ? 1 : 0;
}
