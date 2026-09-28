// Dependency Hell: the rules, in C++ on top of Box2D (the physics). No browser code, so tests can run it anywhere.
//
// A crane drops npm packages onto node_modules/. Stack them as high as you can. Now and then a package in the tower
// gets unpublished and simply vanishes. Three packages over the edge ("peer dependency conflicts") and you're done.
#pragma once

#include <box2d/box2d.h>

#include <cstdint>
#include <string>
#include <vector>

namespace dh {

struct PackageKind {
  const char* name;
  float w, h;      // meters
  float density;   // how heavy it is for its size
};

extern const std::vector<PackageKind> KINDS;

enum class Phase : int { Ready = 0, Running = 1, Paused = 2, Over = 3 };

struct Package {
  b2BodyId body;
  int kind;
  bool rotated;
  bool counted;   // has landed on the tower at least once
  float still;    // seconds it has been (nearly) motionless
};

// What happened this step, for the page (messages, the screen reader).
enum Event : uint32_t { Landed = 1, Fell = 2, Unpublished = 4, NewBest = 8, GameOver = 16 };

class Game {
 public:
  explicit Game(uint32_t seed);
  ~Game();
  Game(const Game&) = delete;
  Game& operator=(const Game&) = delete;

  void start();
  void pause();
  // input for this frame: -1..1 to move the crane for dt seconds; drop and rotate are presses
  void input(float move, bool drop, bool rotate, float dt);
  // advances the world by dt seconds; returns the events that happened (a bitmask)
  uint32_t update(float dt);

  // ---------- state for drawing and the HUD ----------
  Phase phase() const { return phase_; }
  float craneX() const { return craneX_; }
  float craneY() const { return towerTop_ + CRANE_ABOVE; }
  int current() const { return current_; }
  int next() const { return next_; }
  bool currentRotated() const { return rotated_; }
  bool ready() const { return reload_ <= 0; }
  float height() const { return towerTop_; }
  float best() const { return best_; }
  int fallen() const { return fallen_; }
  int stacked() const;
  const std::vector<Package>& packages() const { return packages_; }
  const std::string& unpublished() const { return unpublishedName_; }

  // the platform's top surface is at y = 0, from -PLATFORM_HALF to +PLATFORM_HALF
  static constexpr float PLATFORM_HALF = 3.2f;
  static constexpr float CRANE_ABOVE = 6.0f;
  static constexpr float CRANE_RANGE = 5.2f;
  static constexpr int MAX_FALLEN = 3;

  // tests use these to set things up
  b2WorldId world() const { return world_; }
  void dropAt(float x, int kind, bool rotated);
  void unpublish();

 private:
  float random();
  int pickKind();
  void measure();

  b2WorldId world_;
  std::vector<Package> packages_;
  Phase phase_ = Phase::Ready;
  uint64_t rng_;
  float craneX_ = 0;
  int current_ = 0;
  int next_ = 0;
  bool rotated_ = false;
  float reload_ = 0;
  float towerTop_ = 0;
  float best_ = 0;
  int fallen_ = 0;
  float untilUnpublish_ = 30;
  float accumulator_ = 0;
  float measured_ = 0;
  uint32_t events_ = 0;
  std::string unpublishedName_;
};

}  // namespace dh
