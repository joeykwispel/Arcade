#include "game.hpp"

#include <algorithm>
#include <cmath>

namespace dh {

// name, width, height (meters), density
const std::vector<PackageKind> KINDS = {
    {"react", 1.6f, 0.8f, 1.0f},     {"lodash", 2.0f, 0.5f, 1.0f},   {"express", 1.4f, 1.0f, 1.0f},
    {"moment", 1.8f, 1.2f, 3.0f},    {"left-pad", 0.9f, 0.3f, 0.6f}, {"is-odd", 0.6f, 0.6f, 0.8f},
    {"webpack", 2.4f, 0.7f, 1.4f},   {"typescript", 1.2f, 1.2f, 1.2f}, {"axios", 1.3f, 0.6f, 1.0f},
    {"chalk", 1.0f, 0.5f, 0.8f},
};

namespace {
constexpr float STEP = 1.0f / 60.0f;  // fixed physics step
constexpr int SUBSTEPS = 4;
constexpr float CRANE_SPEED = 6.0f;
constexpr float RELOAD = 0.8f;       // seconds between drops
constexpr float FALL_Y = -4.0f;      // below this, a package has fallen off
constexpr float SETTLED = 0.15f;     // speed under which a package counts as resting
constexpr float LANDED_AFTER = 0.4f; // seconds of rest before it counts; a package just let go is still too
}  // namespace

Game::Game(uint32_t seed) : rng_(seed ? seed : 0x9E3779B97F4A7C15ULL) {
  b2WorldDef def = b2DefaultWorldDef();
  def.gravity = {0.0f, -10.0f};
  world_ = b2CreateWorld(&def);

  // node_modules/: the platform everything has to stand on
  b2BodyDef ground = b2DefaultBodyDef();
  ground.position = {0.0f, -0.5f};
  b2BodyId groundId = b2CreateBody(world_, &ground);
  b2Polygon slab = b2MakeBox(PLATFORM_HALF, 0.5f);
  b2ShapeDef shape = b2DefaultShapeDef();
  shape.material.friction = 0.8f;
  b2CreatePolygonShape(groundId, &shape, &slab);

  current_ = pickKind();
  next_ = pickKind();
}

Game::~Game() { b2DestroyWorld(world_); }

float Game::random() {
  // xorshift64*
  rng_ ^= rng_ >> 12;
  rng_ ^= rng_ << 25;
  rng_ ^= rng_ >> 27;
  return static_cast<float>((rng_ * 0x2545F4914F6CDD1DULL) >> 40) / static_cast<float>(1ULL << 24);
}

int Game::pickKind() { return static_cast<int>(random() * KINDS.size()) % static_cast<int>(KINDS.size()); }

void Game::start() {
  if (phase_ == Phase::Ready) phase_ = Phase::Running;
}

void Game::pause() {
  if (phase_ == Phase::Running) {
    phase_ = Phase::Paused;
  } else if (phase_ == Phase::Paused) {
    phase_ = Phase::Running;
  }
}

void Game::dropAt(float x, int kind, bool rotated) {
  const PackageKind& k = KINDS[kind];
  float hw = (rotated ? k.h : k.w) / 2, hh = (rotated ? k.w : k.h) / 2;
  b2BodyDef def = b2DefaultBodyDef();
  def.type = b2_dynamicBody;
  def.position = {x, towerTop_ + CRANE_ABOVE - hh - 0.4f};
  b2BodyId body = b2CreateBody(world_, &def);
  b2Polygon box = b2MakeBox(hw, hh);
  b2ShapeDef shape = b2DefaultShapeDef();
  shape.density = k.density;
  shape.material.friction = 0.7f;
  b2CreatePolygonShape(body, &shape, &box);
  packages_.push_back({body, kind, rotated, false, 0});
}

void Game::input(float move, bool drop, bool rotate, float dt) {
  if (phase_ != Phase::Running) return;
  craneX_ = std::clamp(craneX_ + std::clamp(move, -1.0f, 1.0f) * CRANE_SPEED * std::min(dt, 0.1f), -CRANE_RANGE, CRANE_RANGE);
  if (rotate) rotated_ = !rotated_;
  if (drop && reload_ <= 0) {
    dropAt(craneX_, current_, rotated_);
    current_ = next_;
    next_ = pickKind();
    rotated_ = false;
    reload_ = RELOAD;
  }
}

int Game::stacked() const {
  return static_cast<int>(std::count_if(packages_.begin(), packages_.end(), [](const Package& p) { return p.counted; }));
}

// "left-pad was unpublished": a package in the tower (not the top one) vanishes. left-pad itself if it's there.
void Game::unpublish() {
  int pick = -1;
  float highest = -1e9f;
  int top = -1;
  for (size_t i = 0; i < packages_.size(); i++) {
    if (!packages_[i].counted) continue;
    float y = b2Body_GetPosition(packages_[i].body).y;
    if (y > highest) {
      highest = y;
      top = static_cast<int>(i);
    }
  }
  std::vector<int> candidates;
  for (size_t i = 0; i < packages_.size(); i++) {
    if (packages_[i].counted && static_cast<int>(i) != top) candidates.push_back(static_cast<int>(i));
  }
  if (candidates.empty()) return;
  for (int i : candidates) {
    if (std::string(KINDS[packages_[i].kind].name) == "left-pad") pick = i;
  }
  if (pick < 0) pick = candidates[static_cast<size_t>(random() * candidates.size()) % candidates.size()];
  unpublishedName_ = KINDS[packages_[pick].kind].name;
  b2DestroyBody(packages_[pick].body);
  packages_.erase(packages_.begin() + pick);
  events_ |= Unpublished;
}

// The tower's height: the top of the highest package that has landed and is still above the edge.
// A package counts as landed once it comes to rest on something.
void Game::measure() {
  float top = 0;
  // measured_: the time since the last measurement (set in update)
  for (Package& p : packages_) {
    b2Vec2 v = b2Body_GetLinearVelocity(p.body);
    b2AABB box = b2Body_ComputeAABB(p.body);
    bool onTower = box.lowerBound.y > -1.0f;
    p.still = std::hypot(v.x, v.y) < SETTLED ? p.still + measured_ : 0;
    if (!p.counted && onTower && p.still >= LANDED_AFTER) {
      p.counted = true;
      events_ |= Landed;
    }
    if (p.counted && onTower) top = std::max(top, box.upperBound.y);
  }
  towerTop_ = top;
  if (towerTop_ > best_ + 0.01f) {
    if (best_ > 0) events_ |= NewBest;
    best_ = towerTop_;
  }
}

uint32_t Game::update(float dt) {
  events_ = 0;
  if (phase_ != Phase::Running) return 0;
  accumulator_ = std::min(accumulator_ + dt, 0.25f);
  measured_ = 0;
  while (accumulator_ >= STEP) {
    measured_ += STEP;
    accumulator_ -= STEP;
    b2World_Step(world_, STEP, SUBSTEPS);
    reload_ -= STEP;

    // packages that went over the edge
    for (size_t i = 0; i < packages_.size();) {
      if (b2Body_GetPosition(packages_[i].body).y < FALL_Y) {
        b2DestroyBody(packages_[i].body);
        packages_.erase(packages_.begin() + static_cast<long>(i));
        fallen_++;
        events_ |= Fell;
        if (fallen_ >= MAX_FALLEN) {
          phase_ = Phase::Over;
          events_ |= GameOver;
          return events_;
        }
      } else {
        i++;
      }
    }

    // now and then someone unpublishes a package, once there's a tower worth breaking
    if (stacked() >= 6) {
      untilUnpublish_ -= STEP;
      if (untilUnpublish_ <= 0) {
        unpublish();
        untilUnpublish_ = 25 + random() * 15;
      }
    }
  }
  measure();
  return events_;
}

}  // namespace dh
