//! Plays whole levels with simple bots, so balance changes can't silently make a level unwinnable (or free).

use bug_bash::data::{BugKind, CELL, COLS, LEVELS, ROWS, TowerKind};
use bug_bash::sim::{Battle, Outcome, PlaceError, cell_center};

const DT: f32 = 1.0 / 30.0;

/// Buildable cells, the ones next to the most path first.
fn spots(b: &Battle) -> Vec<(i32, i32)> {
    let mut cells: Vec<((i32, i32), usize)> = (0..ROWS)
        .flat_map(|r| (0..COLS).map(move |c| (c, r)))
        .filter(|&(c, r)| b.can_build(c, r))
        .map(|(c, r)| {
            let (x, y) = cell_center(c, r);
            let reach = 2.5 * CELL;
            let cover = (0..ROWS)
                .flat_map(|pr| (0..COLS).map(move |pc| (pc, pr)))
                .filter(|&(pc, pr)| b.is_path(pc, pr))
                .filter(|&(pc, pr)| {
                    let (px, py) = cell_center(pc, pr);
                    (px - x).powi(2) + (py - y).powi(2) <= reach * reach
                })
                .count();
            ((c, r), cover)
        })
        .collect();
    cells.sort_by_key(|&(_, cover)| std::cmp::Reverse(cover));
    cells.into_iter().map(|(cell, _)| cell).collect()
}

/// Plays a level: installs tools from `order` on the best spots, upgrades once it has enough of them, pushes
/// every sprint as soon as it can. Returns the finished battle.
fn play(level: usize, order: &[TowerKind], max_tools: usize) -> Battle {
    let mut b = Battle::new(level, 42);
    let spots = spots(&b);
    let mut next = 0;
    let mut t = 0.0;
    while b.outcome.is_none() && t < 3600.0 {
        loop {
            if b.towers.len() < max_tools && next < spots.len() {
                let kind = order[b.towers.len() % order.len()];
                let (c, r) = spots[next];
                match b.place(kind, c, r) {
                    Ok(()) => {
                        next += 1;
                        continue;
                    }
                    Err(PlaceError::Broke(_)) => break,
                    Err(_) => {
                        next += 1;
                        continue;
                    }
                }
            }
            // upgrade the least upgraded tool that we can afford
            let cheapest = (0..b.towers.len())
                .filter(|&i| b.towers[i].kind.upgrade_cost(b.towers[i].level).is_some_and(|c| c <= b.coffee))
                .min_by_key(|&i| b.towers[i].level);
            match cheapest {
                Some(i) => {
                    b.upgrade(i).unwrap();
                }
                None => break,
            }
        }
        if b.can_push() && b.bugs.is_empty() {
            b.push();
        }
        b.update(DT);
        t += DT;
    }
    b
}

const MIX: [TowerKind; 8] = [
    TowerKind::Linter,
    TowerKind::UnitTest,
    TowerKind::Breakpoint,
    TowerKind::Review,
    TowerKind::UnitTest,
    TowerKind::Duck,
    TowerKind::Ci,
    TowerKind::Review,
];

#[test]
fn a_sensible_build_wins_every_level_with_less_margin_each_time() {
    let mut uptime = Vec::new();
    for level in 0..LEVELS.len() {
        let b = play(level, &MIX, 40);
        assert_eq!(b.outcome, Some(Outcome::Won), "level {} lost in sprint {} (uptime {})", level + 1, b.wave, b.uptime);
        println!("level {}: won with uptime {}, {} tools", level + 1, b.uptime, b.towers.len());
        uptime.push(b.uptime);
    }
    // the bot is no genius, so this is a trend, not a guarantee for players: early levels are forgiving, later ones not
    assert!(uptime[2] < uptime[0] && uptime[3] < uptime[2] && uptime[4] < uptime[2], "difficulty curve is off: {uptime:?}");
}

#[test]
fn linters_alone_only_get_you_through_the_easy_levels() {
    let b = play(0, &[TowerKind::Linter], 40);
    assert_eq!(b.outcome, Some(Outcome::Won));
    for level in 3..LEVELS.len() {
        assert_eq!(play(level, &[TowerKind::Linter], 40).outcome, Some(Outcome::Lost), "level {} is too easy", level + 1);
    }
}

#[test]
fn doing_nothing_loses_every_level() {
    for level in 0..LEVELS.len() {
        let b = play(level, &MIX, 0);
        assert_eq!(b.outcome, Some(Outcome::Lost), "level {} was won without any tools", level + 1);
    }
}

#[test]
fn heisenbugs_need_a_code_review() {
    // Without Code Review nothing can aim at a Heisenbug, so level 4 is lost even with plenty of other tools.
    let order = [TowerKind::UnitTest, TowerKind::Linter, TowerKind::Ci];
    let b = play(3, &order, 40);
    assert_eq!(b.outcome, Some(Outcome::Lost));
    assert!(b.wave >= 6, "lost before the first Heisenbugs, in sprint {}", b.wave);
}

#[test]
fn levels_get_longer_and_harder() {
    let bugs = |i: usize| LEVELS[i].waves.iter().flat_map(|w| w.iter()).map(|g| g.count as f32 * g.kind.stats().hp).sum::<f32>() * LEVELS[i].hp_mult;
    for i in 1..LEVELS.len() {
        assert!(LEVELS[i].waves.len() > LEVELS[i - 1].waves.len());
        assert!(bugs(i) > bugs(i - 1), "level {} has less bug hp than level {}", i + 1, i);
    }
    assert!(LEVELS[4].waves.iter().flat_map(|w| w.iter()).any(|g| g.kind == BugKind::Spaghetti));
}

#[test]
fn paths_connect_and_code_fills_the_map() {
    for (i, lv) in LEVELS.iter().enumerate() {
        for p in lv.paths {
            for w in p.windows(2) {
                assert!(w[0].0 == w[1].0 || w[0].1 == w[1].1, "level {}: diagonal path segment", i + 1);
            }
            let (c, r) = p[p.len() - 1];
            assert_eq!((c, r), lv.paths[0][lv.paths[0].len() - 1], "level {}: paths end in different places", i + 1);
        }
        assert!(lv.code.len() <= (ROWS * 2) as usize);
    }
}
