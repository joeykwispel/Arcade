//! The battle: bugs walking the paths, tools shooting them, coffee and uptime.
//! Pure logic in map units (0..720 × 0..480) with no drawing, so tests (and a bot) can play whole levels.

use crate::data::{BugKind, CELL, COLS, LEVELS, ROWS, TowerKind};
use crate::draw::Color;

pub const MAP_W: f32 = COLS as f32 * CELL;
pub const MAP_H: f32 = ROWS as f32 * CELL;
pub const START_UPTIME: i32 = 100;
/// Seconds between two groups of one sprint
const GROUP_PAUSE: f32 = 1.5;
/// Share of the coffee spent on a tool that you get back when you sell it
const SELL_BACK: f32 = 0.7;

pub fn cell_center(col: i32, row: i32) -> (f32, f32) {
    ((col as f32 + 0.5) * CELL, (row as f32 + 0.5) * CELL)
}

pub fn in_bounds(col: i32, row: i32) -> bool {
    (0..COLS).contains(&col) && (0..ROWS).contains(&row)
}

fn dist2(a: (f32, f32), b: (f32, f32)) -> f32 {
    (a.0 - b.0).powi(2) + (a.1 - b.1).powi(2)
}

pub struct Tower {
    pub kind: TowerKind,
    pub col: i32,
    pub row: i32,
    /// 0, 1 or 2: shown as v1.0, v2.0, v3.0
    pub level: u8,
    /// all coffee spent on it, for the sell price
    pub invested: u32,
    /// seconds since it last fired, for the muzzle flash
    pub since_fire: f32,
    cooldown: f32,
}

impl Tower {
    pub fn pos(&self) -> (f32, f32) {
        cell_center(self.col, self.row)
    }

    pub fn range(&self) -> f32 {
        self.kind.range(self.level) * CELL
    }
}

pub struct Bug {
    pub id: u32,
    pub kind: BugKind,
    pub x: f32,
    pub y: f32,
    /// unit vector it is walking in
    pub dir: (f32, f32),
    pub hp: f32,
    pub max_hp: f32,
    /// distance walked; the bug furthest along is the one towers aim at
    pub traveled: f32,
    /// Heisenbugs can only be targeted while a Code Review sees them
    pub revealed: bool,
    pub age: f32,
    /// seconds left of the hit flash
    pub hit: f32,
    pub alive: bool,
    /// speed factor while a Breakpoint holds it
    pub slow: f32,
    base_hp: f32,
    path: usize,
    next: usize,
    slow_for: f32,
    phase: f32,
}

impl Bug {
    /// Memory leaks grow with their hit points; everything else keeps its size.
    pub fn radius(&self) -> f32 {
        self.kind.stats().radius * (self.max_hp / self.base_hp).sqrt().min(1.8)
    }

    pub fn targetable(&self) -> bool {
        self.alive && (self.kind != BugKind::Heisenbug || self.revealed)
    }

    /// A fixed random number per bug, for animations that should not all move in step.
    pub fn phase(&self) -> f32 {
        self.phase
    }
}

pub struct Shot {
    pub kind: TowerKind,
    pub x: f32,
    pub y: f32,
    pub tx: f32,
    pub ty: f32,
    target: u32,
    speed: f32,
    dmg: f32,
    splash: f32,
}

pub enum FxKind {
    /// expanding circle, from one radius to another
    Ring(f32, f32),
    /// line to a point (CI Pipeline)
    Zap(f32, f32),
    /// a squashed bug
    Pop,
    /// rising text
    Float(String),
}

pub struct Fx {
    pub kind: FxKind,
    pub x: f32,
    pub y: f32,
    pub color: Color,
    pub t: f32,
    pub dur: f32,
}

/// What happened this frame, for the terminal log and screen reader announcements.
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum Event {
    WaveStart(usize),
    /// sprint number and bonus coffee
    WaveDone(usize, u32),
    /// bonus coffee for pushing before the map was clear
    Early(u32),
    Squashed(BugKind, u32),
    Leaked(BugKind, i32),
    Boss,
    Won,
    Lost,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Outcome {
    Won,
    Lost,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum PlaceError {
    /// not an empty, buildable cell
    Blocked,
    /// needs this much coffee
    Broke(u32),
    /// already v3.0
    Maxed,
}

pub struct Battle {
    pub level: usize,
    pub coffee: u32,
    pub uptime: i32,
    /// sprints started so far
    pub wave: usize,
    pub towers: Vec<Tower>,
    pub bugs: Vec<Bug>,
    pub shots: Vec<Shot>,
    pub fx: Vec<Fx>,
    pub events: Vec<Event>,
    pub outcome: Option<Outcome>,
    pub squashed: u32,
    pub leaked: u32,
    /// every path as waypoints in map units
    pub paths: Vec<Vec<(f32, f32)>>,
    path_cells: Vec<bool>,
    /// bugs still to spawn this sprint: (time, kind, path), last one first
    queue: Vec<(f32, BugKind, usize)>,
    clock: f32,
    cleared: bool,
    spawned: usize,
    next_id: u32,
    rng: u64,
}

impl Battle {
    pub fn new(level: usize, seed: u64) -> Battle {
        let lv = &LEVELS[level];
        let paths = lv
            .paths
            .iter()
            .map(|p| {
                p.iter()
                    .map(|&(c, r)| {
                        let (x, y) = cell_center(c as i32, r as i32);
                        // points outside the grid sit on its edge, so bugs appear and leave right at the border
                        (x.clamp(0.0, MAP_W), y.clamp(0.0, MAP_H))
                    })
                    .collect()
            })
            .collect();

        let mut path_cells = vec![false; (COLS * ROWS) as usize];
        for p in lv.paths {
            for w in p.windows(2) {
                let (mut c, mut r) = (w[0].0 as i32, w[0].1 as i32);
                let (c1, r1) = (w[1].0 as i32, w[1].1 as i32);
                loop {
                    if in_bounds(c, r) {
                        path_cells[(r * COLS + c) as usize] = true;
                    }
                    if (c, r) == (c1, r1) {
                        break;
                    }
                    c += (c1 - c).signum();
                    r += (r1 - r).signum();
                }
            }
        }

        Battle {
            level,
            coffee: lv.coffee,
            uptime: START_UPTIME,
            wave: 0,
            towers: Vec::new(),
            bugs: Vec::new(),
            shots: Vec::new(),
            fx: Vec::new(),
            events: Vec::new(),
            outcome: None,
            squashed: 0,
            leaked: 0,
            paths,
            path_cells,
            queue: Vec::new(),
            clock: 0.0,
            cleared: true,
            spawned: 0,
            next_id: 0,
            rng: seed | 1,
        }
    }

    pub fn total_waves(&self) -> usize {
        LEVELS[self.level].waves.len()
    }

    /// Bugs on the map plus bugs still to come this sprint.
    pub fn remaining(&self) -> usize {
        self.queue.len() + self.bugs.len()
    }

    /// 3 stars from 90% uptime, 2 from 50%, else 1. 0 until the level is won.
    pub fn stars(&self) -> u8 {
        match (self.outcome, self.uptime) {
            (Some(Outcome::Won), u) if u >= 90 => 3,
            (Some(Outcome::Won), u) if u >= 50 => 2,
            (Some(Outcome::Won), _) => 1,
            _ => 0,
        }
    }

    pub fn is_path(&self, col: i32, row: i32) -> bool {
        in_bounds(col, row) && self.path_cells[(row * COLS + col) as usize]
    }

    pub fn tower_at(&self, col: i32, row: i32) -> Option<usize> {
        self.towers.iter().position(|t| t.col == col && t.row == row)
    }

    pub fn can_build(&self, col: i32, row: i32) -> bool {
        in_bounds(col, row) && !self.is_path(col, row) && self.tower_at(col, row).is_none()
    }

    /* ---------- player actions ---------- */

    pub fn place(&mut self, kind: TowerKind, col: i32, row: i32) -> Result<(), PlaceError> {
        if !self.can_build(col, row) {
            return Err(PlaceError::Blocked);
        }
        let cost = kind.cost();
        if self.coffee < cost {
            return Err(PlaceError::Broke(cost));
        }
        self.coffee -= cost;
        self.towers.push(Tower { kind, col, row, level: 0, invested: cost, since_fire: 9.0, cooldown: 0.0 });
        Ok(())
    }

    /// Returns the new level.
    pub fn upgrade(&mut self, i: usize) -> Result<u8, PlaceError> {
        let t = &mut self.towers[i];
        let cost = t.kind.upgrade_cost(t.level).ok_or(PlaceError::Maxed)?;
        if self.coffee < cost {
            return Err(PlaceError::Broke(cost));
        }
        self.coffee -= cost;
        t.level += 1;
        t.invested += cost;
        Ok(t.level)
    }

    pub fn sell_value(&self, i: usize) -> u32 {
        (self.towers[i].invested as f32 * SELL_BACK) as u32
    }

    /// Removes the tool and returns the coffee you got back.
    pub fn sell(&mut self, i: usize) -> u32 {
        let back = self.sell_value(i);
        self.towers.remove(i);
        self.coffee += back;
        back
    }

    /// The next sprint can start once the current one has finished spawning.
    pub fn can_push(&self) -> bool {
        self.outcome.is_none() && self.queue.is_empty() && self.wave < self.total_waves()
    }

    /// `git push`: starts the next sprint. Pushing while bugs are still around pays a bonus.
    pub fn push(&mut self) -> bool {
        if !self.can_push() {
            return false;
        }
        let early = !self.bugs.is_empty();
        self.wave += 1;
        let mut t = 0.0;
        let mut queue = Vec::new();
        for g in LEVELS[self.level].waves[self.wave - 1] {
            for _ in 0..g.count {
                let path = if g.kind == BugKind::Spaghetti { 0 } else { self.spawned % self.paths.len() };
                self.spawned += 1;
                queue.push((t, g.kind, path));
                t += g.gap;
            }
            t += GROUP_PAUSE;
        }
        queue.reverse();
        self.queue = queue;
        self.clock = 0.0;
        self.cleared = false;
        self.events.push(Event::WaveStart(self.wave));
        if early {
            let bonus = 5 + 2 * self.wave as u32;
            self.coffee += bonus;
            self.events.push(Event::Early(bonus));
        }
        true
    }

    /* ---------- simulation ---------- */

    pub fn update(&mut self, dt: f32) {
        for f in &mut self.fx {
            f.t += dt;
        }
        self.fx.retain(|f| f.t < f.dur);
        for t in &mut self.towers {
            t.since_fire += dt;
        }
        if self.outcome.is_some() {
            return;
        }

        self.clock += dt;
        while let Some(&(at, kind, path)) = self.queue.last() {
            if at > self.clock {
                break;
            }
            self.queue.pop();
            if kind == BugKind::Spaghetti {
                self.events.push(Event::Boss);
            }
            let (x, y) = self.paths[path][0];
            let (nx, ny) = self.paths[path][1];
            let d = dist2((x, y), (nx, ny)).sqrt().max(1e-3);
            self.spawn(kind, path, 1, x, y, ((nx - x) / d, (ny - y) / d), 0.0);
        }

        self.move_bugs(dt);
        if self.outcome.is_some() {
            return;
        }
        self.reveal();
        self.run_towers(dt);
        self.move_shots(dt);
        self.bugs.retain(|b| b.alive);

        if self.wave > 0 && !self.cleared && self.queue.is_empty() && self.bugs.is_empty() {
            self.cleared = true;
            if self.wave == self.total_waves() {
                self.outcome = Some(Outcome::Won);
                self.events.push(Event::Won);
            } else {
                let bonus = 15 + 5 * self.wave as u32;
                self.coffee += bonus;
                self.events.push(Event::WaveDone(self.wave, bonus));
            }
        }
    }

    fn rand(&mut self) -> f32 {
        // xorshift64*
        self.rng ^= self.rng >> 12;
        self.rng ^= self.rng << 25;
        self.rng ^= self.rng >> 27;
        (self.rng.wrapping_mul(0x2545_F491_4F6C_DD1D) >> 40) as f32 / (1u64 << 24) as f32
    }

    fn hp_mult(&self) -> f32 {
        LEVELS[self.level].hp_mult * (1.0 + 0.09 * (self.wave.max(1) - 1) as f32)
    }

    #[allow(clippy::too_many_arguments)]
    fn spawn(&mut self, kind: BugKind, path: usize, next: usize, x: f32, y: f32, dir: (f32, f32), traveled: f32) {
        let hp = kind.stats().hp * self.hp_mult();
        self.next_id += 1;
        let phase = self.rand() * std::f32::consts::TAU;
        self.bugs.push(Bug {
            id: self.next_id,
            kind,
            x,
            y,
            dir,
            hp,
            max_hp: hp,
            base_hp: hp,
            traveled,
            revealed: false,
            age: 0.0,
            hit: 0.0,
            alive: true,
            slow: 1.0,
            path,
            next,
            slow_for: 0.0,
            phase,
        });
    }

    fn move_bugs(&mut self, dt: f32) {
        let mut leaks = Vec::new();
        for (i, b) in self.bugs.iter_mut().enumerate() {
            if !b.alive {
                continue;
            }
            b.age += dt;
            b.hit = (b.hit - dt).max(0.0);
            if b.slow_for > 0.0 {
                b.slow_for -= dt;
                if b.slow_for <= 0.0 {
                    b.slow = 1.0;
                }
            }
            if b.kind == BugKind::MemoryLeak && b.max_hp < b.base_hp * 3.0 {
                let grow = 1.0 + 0.08 * dt;
                b.max_hp *= grow;
                b.hp *= grow;
            }
            let mut speed = b.kind.stats().speed * CELL * b.slow;
            if b.kind == BugKind::RaceCondition {
                speed *= 1.0 + 0.55 * (b.age * 5.0 + b.phase).sin();
            }
            let path = &self.paths[b.path];
            let mut step = speed * dt;
            while step > 0.0 {
                let (tx, ty) = path[b.next];
                let (dx, dy) = (tx - b.x, ty - b.y);
                let d = (dx * dx + dy * dy).sqrt();
                if d > 1e-4 {
                    b.dir = (dx / d, dy / d);
                }
                if d <= step {
                    b.x = tx;
                    b.y = ty;
                    b.traveled += d;
                    step -= d;
                    b.next += 1;
                    if b.next == path.len() {
                        b.alive = false;
                        leaks.push(i);
                        break;
                    }
                } else {
                    b.x += dx / d * step;
                    b.y += dy / d * step;
                    b.traveled += step;
                    step = 0.0;
                }
            }
        }
        for i in leaks {
            self.leak(i);
        }
    }

    fn leak(&mut self, i: usize) {
        let (kind, x, y) = (self.bugs[i].kind, self.bugs[i].x, self.bugs[i].y);
        let dmg = kind.stats().leak;
        self.uptime -= dmg;
        self.leaked += 1;
        self.events.push(Event::Leaked(kind, dmg));
        self.fx.push(Fx { kind: FxKind::Float(format!("-{dmg}%")), x: x - 18.0, y, color: Color::Danger, t: 0.0, dur: 1.2 });
        if self.uptime <= 0 && self.outcome.is_none() {
            self.uptime = 0;
            self.outcome = Some(Outcome::Lost);
            self.events.push(Event::Lost);
        }
    }

    fn reveal(&mut self) {
        let reviews: Vec<((f32, f32), f32)> =
            self.towers.iter().filter(|t| t.kind == TowerKind::Review).map(|t| (t.pos(), t.range())).collect();
        for b in &mut self.bugs {
            if b.kind == BugKind::Heisenbug {
                b.revealed = reviews.iter().any(|&(p, r)| dist2(p, (b.x, b.y)) <= r * r);
            }
        }
    }

    /// Damage multiplier from the best Rubber Duck in reach.
    fn buff(&self, i: usize) -> f32 {
        let p = self.towers[i].pos();
        self.towers
            .iter()
            .enumerate()
            .filter(|&(j, t)| j != i && t.kind == TowerKind::Duck && dist2(t.pos(), p) <= t.range() * t.range())
            .map(|(_, t)| t.kind.buff(t.level))
            .fold(1.0, f32::max)
    }

    /// The targetable bug in range that is furthest along its path.
    fn target(&self, p: (f32, f32), range: f32) -> Option<usize> {
        self.bugs
            .iter()
            .enumerate()
            .filter(|(_, b)| b.targetable() && dist2(p, (b.x, b.y)) <= range * range)
            .max_by(|(_, a), (_, b)| a.traveled.total_cmp(&b.traveled))
            .map(|(i, _)| i)
    }

    fn run_towers(&mut self, dt: f32) {
        for i in 0..self.towers.len() {
            let (kind, level, p, range) = {
                let t = &mut self.towers[i];
                t.cooldown -= dt;
                if t.kind == TowerKind::Duck || t.cooldown > 0.0 {
                    continue;
                }
                (t.kind, t.level, t.pos(), t.range())
            };
            let dmg = kind.damage(level) * self.buff(i);
            let fired = match kind {
                TowerKind::Linter | TowerKind::UnitTest | TowerKind::Review => match self.target(p, range) {
                    Some(j) => {
                        let b = &self.bugs[j];
                        let (speed, splash) = match kind {
                            TowerKind::Linter => (480.0, 0.0),
                            TowerKind::UnitTest => (380.0, 0.0),
                            _ => (260.0, kind.splash(level)),
                        };
                        let shot = Shot { kind, x: p.0, y: p.1, tx: b.x, ty: b.y, target: b.id, speed, dmg, splash };
                        self.shots.push(shot);
                        true
                    }
                    None => false,
                },
                TowerKind::Breakpoint => self.pulse(p, range, dmg, kind.slow(level)),
                TowerKind::Ci => self.chain(p, range, dmg, kind.chain(level)),
                TowerKind::Duck => false,
            };
            let t = &mut self.towers[i];
            if fired {
                t.cooldown = kind.interval(level);
                t.since_fire = 0.0;
            } else {
                // ready the moment something walks into range
                t.cooldown = 0.0;
            }
        }
    }

    /// Breakpoint: slows and hurts everything in range, hidden Heisenbugs included.
    fn pulse(&mut self, p: (f32, f32), range: f32, dmg: f32, slow: f32) -> bool {
        let hits: Vec<usize> =
            (0..self.bugs.len()).filter(|&j| self.bugs[j].alive && dist2(p, (self.bugs[j].x, self.bugs[j].y)) <= range * range).collect();
        if hits.is_empty() {
            return false;
        }
        for j in hits {
            let b = &mut self.bugs[j];
            b.slow = b.slow.min(slow);
            b.slow_for = 0.9;
            self.damage(j, dmg);
        }
        self.fx.push(Fx { kind: FxKind::Ring(8.0, range), x: p.0, y: p.1, color: Color::Danger, t: 0.0, dur: 0.45 });
        true
    }

    /// CI Pipeline: hits the first bug, then jumps to the nearest one it has not hit yet, a bit weaker each time.
    fn chain(&mut self, p: (f32, f32), range: f32, dmg: f32, jumps: usize) -> bool {
        let Some(mut j) = self.target(p, range) else { return false };
        let reach = 2.2 * CELL;
        let mut from = p;
        let mut hit = Vec::new();
        let mut d = dmg;
        for _ in 0..jumps {
            let to = (self.bugs[j].x, self.bugs[j].y);
            self.fx.push(Fx { kind: FxKind::Zap(to.0, to.1), x: from.0, y: from.1, color: Color::Accent, t: 0.0, dur: 0.25 });
            hit.push(j);
            self.damage(j, d);
            d *= 0.8;
            from = to;
            let next = self
                .bugs
                .iter()
                .enumerate()
                .filter(|(k, b)| b.targetable() && !hit.contains(k) && dist2(to, (b.x, b.y)) <= reach * reach)
                .min_by(|(_, a), (_, b)| dist2(to, (a.x, a.y)).total_cmp(&dist2(to, (b.x, b.y))))
                .map(|(k, _)| k);
            match next {
                Some(k) => j = k,
                None => break,
            }
        }
        true
    }

    fn move_shots(&mut self, dt: f32) {
        let mut shots = std::mem::take(&mut self.shots);
        shots.retain_mut(|s| {
            match self.bugs.iter().find(|b| b.id == s.target && b.alive) {
                Some(b) => (s.tx, s.ty) = (b.x, b.y),
                // a single-target shot fizzles when its bug is gone; a splash still lands where the bug was
                None if s.splash == 0.0 => return false,
                None => {}
            }
            let (dx, dy) = (s.tx - s.x, s.ty - s.y);
            let d = (dx * dx + dy * dy).sqrt();
            let step = s.speed * dt;
            if d > step {
                s.x += dx / d * step;
                s.y += dy / d * step;
                return true;
            }
            if s.splash > 0.0 {
                let r2 = s.splash * s.splash;
                let hits: Vec<usize> =
                    (0..self.bugs.len()).filter(|&j| self.bugs[j].alive && dist2((s.tx, s.ty), (self.bugs[j].x, self.bugs[j].y)) <= r2).collect();
                for j in hits {
                    self.damage(j, s.dmg);
                }
                self.fx.push(Fx { kind: FxKind::Ring(4.0, s.splash), x: s.tx, y: s.ty, color: Color::Accent2, t: 0.0, dur: 0.35 });
            } else if let Some(j) = self.bugs.iter().position(|b| b.id == s.target && b.alive) {
                self.damage(j, s.dmg);
            }
            false
        });
        shots.append(&mut self.shots);
        self.shots = shots;
    }

    fn damage(&mut self, j: usize, dmg: f32) {
        let b = &mut self.bugs[j];
        if !b.alive {
            return;
        }
        b.hp -= (dmg - b.kind.stats().armor).max(1.0);
        b.hit = 0.1;
        if b.hp <= 0.0 {
            self.kill(j);
        }
    }

    fn kill(&mut self, j: usize) {
        let b = &mut self.bugs[j];
        b.alive = false;
        let (kind, x, y, dir, path, next, traveled) = (b.kind, b.x, b.y, b.dir, b.path, b.next, b.traveled);
        let reward = kind.stats().reward;
        self.coffee += reward;
        self.squashed += 1;
        self.events.push(Event::Squashed(kind, reward));
        self.fx.push(Fx { kind: FxKind::Pop, x, y, color: kind.color(), t: 0.0, dur: 0.4 });
        self.fx.push(Fx { kind: FxKind::Float(format!("+{reward}")), x, y: y - 10.0, color: Color::Num, t: 0.0, dur: 0.9 });
        if kind == BugKind::Spaghetti {
            // untangled into smaller bugs, spread out behind it along the path
            for k in 0..11 {
                let child = if k % 2 == 0 { BugKind::NullPointer } else { BugKind::Typo };
                let back = k as f32 * 7.0;
                self.spawn(child, path, next, x - dir.0 * back, y - dir.1 * back, dir, traveled - back);
            }
        }
    }
}
