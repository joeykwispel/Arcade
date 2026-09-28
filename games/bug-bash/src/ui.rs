//! Screens, layout, input and drawing: the level select, the editor-shaped battle screen and its dialogs.
//! Immediate mode: every frame redraws everything and registers the clickable areas again.

use std::f32::consts::TAU;

use crate::data::{BugKind, CELL, COLS, LEVELS, ROWS, TowerKind};
use crate::draw::{Align, Canvas, Color as C, text_w};
use crate::i18n::{Lang, Text, fill, text};
use crate::sim::{Battle, Event, FxKind, Outcome, PlaceError, cell_center};

pub const W: f32 = 960.0;
pub const H: f32 = 600.0;
const TAB_H: f32 = 32.0;
const MAP_X: f32 = 40.0;
const MAP_Y: f32 = TAB_H;
const MAP_W: f32 = COLS as f32 * CELL;
const MAP_H: f32 = ROWS as f32 * CELL;
const SIDE_X: f32 = MAP_X + MAP_W;
const SIDE_W: f32 = W - SIDE_X;
const TERM_Y: f32 = MAP_Y + MAP_H;
const STATUS_Y: f32 = 580.0;
const LINE_H: f32 = 20.0;
const CODE_SIZE: f32 = 12.0;

#[derive(Clone, Copy, PartialEq, Debug)]
enum Action {
    Select(usize),
    Start(usize),
    Shop(TowerKind),
    Upgrade,
    Sell,
    Push,
    Pause,
    Resume,
    Restart,
    Menu,
    Next,
    Speed,
}

struct Hit {
    x: f32,
    y: f32,
    w: f32,
    h: f32,
    action: Action,
}

/// Keys, as small numbers from main.js (see KEYS there).
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
enum Key {
    Up,
    Down,
    Left,
    Right,
    Enter,
    Space,
    Escape,
    Digit(u8),
    Upgrade,
    Sell,
    Pause,
    Speed,
    Restart,
    Levels,
}

impl Key {
    fn from_code(code: u32) -> Option<Key> {
        Some(match code {
            1 => Key::Up,
            2 => Key::Down,
            3 => Key::Left,
            4 => Key::Right,
            5 => Key::Enter,
            6 => Key::Space,
            7 => Key::Escape,
            11..=19 => Key::Digit((code - 10) as u8),
            20 => Key::Upgrade,
            21 => Key::Sell,
            22 => Key::Pause,
            23 => Key::Speed,
            24 => Key::Restart,
            25 => Key::Levels,
            _ => return None,
        })
    }
}

/// One highlighted line of code: (column, text, color) runs.
type CodeLine = Vec<(usize, String, C)>;

pub struct App {
    pub canvas: Canvas,
    /// text for the screen reader's live region, taken by the page
    pub announce: String,
    pub stars: [u8; 5],
    /// the page should save `stars`
    pub save_pending: bool,
    /// the pointer is over something clickable
    pub pointer_cursor: bool,
    lang: Lang,
    sel: usize,
    battle: Option<Battle>,
    paused: bool,
    fast: bool,
    build: Option<TowerKind>,
    selected: Option<usize>,
    pointer: Option<(f32, f32)>,
    /// keyboard cursor on the grid; replaced by the pointer as soon as it moves
    cursor: Option<(i32, i32)>,
    log: Vec<(String, C)>,
    hits: Vec<Hit>,
    code: Vec<CodeLine>,
    time: f32,
    seed: u64,
}

impl App {
    pub fn new(lang: u32, seed: u32) -> App {
        App {
            canvas: Canvas::default(),
            announce: String::new(),
            stars: [0; 5],
            save_pending: false,
            pointer_cursor: false,
            lang: Lang::from_code(lang),
            sel: 0,
            battle: None,
            paused: false,
            fast: false,
            build: None,
            selected: None,
            pointer: None,
            cursor: None,
            log: Vec::new(),
            hits: Vec::new(),
            code: Vec::new(),
            time: 0.0,
            seed: seed as u64 ^ 0x9E37_79B9_7F4A_7C15,
        }
    }

    fn t(&self) -> &'static Text {
        text(self.lang)
    }

    pub fn set_lang(&mut self, lang: u32) {
        self.lang = Lang::from_code(lang);
    }

    /// Stars saved from an earlier visit. The first level that isn't done yet is selected.
    pub fn load_stars(&mut self, level: usize, stars: u8) {
        if level < self.stars.len() {
            self.stars[level] = stars.min(3);
            self.sel = (0..5).find(|&i| self.stars[i] == 0).unwrap_or(4);
        }
    }

    /// 0 level select, 1 playing, 2 paused, 3 won, 4 lost. Only for the page (data-screen) and its tests.
    pub fn screen(&self) -> u32 {
        match &self.battle {
            None => 0,
            Some(b) => match b.outcome {
                Some(Outcome::Won) => 3,
                Some(Outcome::Lost) => 4,
                None if self.paused => 2,
                None => 1,
            },
        }
    }

    fn unlocked(&self, i: usize) -> bool {
        i == 0 || self.stars[i - 1] > 0
    }

    fn modal(&self) -> bool {
        self.screen() >= 2
    }

    fn say(&mut self, s: String) {
        self.announce = s;
    }

    fn log(&mut self, s: String, c: C) {
        self.log.push((s, c));
        if self.log.len() > 40 {
            self.log.remove(0);
        }
    }

    /* ---------- game flow ---------- */

    fn start_level(&mut self, i: usize) {
        if i >= LEVELS.len() || !self.unlocked(i) {
            return;
        }
        self.seed = self.seed.wrapping_mul(6_364_136_223_846_793_005).wrapping_add(1_442_695_040_888_963_407);
        self.battle = Some(Battle::new(i, self.seed));
        self.code = LEVELS[i].code.iter().map(|l| highlight(l)).collect();
        self.sel = i;
        self.paused = false;
        self.build = None;
        self.selected = None;
        self.cursor = None;
        self.log.clear();
        let t = self.t();
        let lv = &LEVELS[i];
        self.log(format!("$ cargo run --release --level {}", i + 1), C::Muted);
        self.log(fill(t.log_ready, &[("file", lv.file.to_string())]), C::Success);
        self.say(fill(t.say_level, &[("file", lv.file.to_string()), ("n", lv.waves.len().to_string())]));
    }

    fn to_menu(&mut self) {
        self.battle = None;
        self.paused = false;
        let s = self.t().say_menu.to_string();
        self.say(s);
    }

    fn set_paused(&mut self, paused: bool) {
        if self.battle.as_ref().is_some_and(|b| b.outcome.is_none()) && self.paused != paused {
            self.paused = paused;
            if paused {
                let s = self.t().say_paused.to_string();
                self.say(s);
            }
        }
    }

    /// The page lost focus: pause, so nothing leaks while nobody is watching.
    pub fn blur(&mut self) {
        self.set_paused(true);
        self.pointer = None;
    }

    fn push(&mut self) {
        if let Some(b) = self.battle.as_mut() {
            b.push();
        }
    }

    fn upgrade(&mut self) {
        let (Some(b), Some(i)) = (self.battle.as_mut(), self.selected) else { return };
        let kind = b.towers[i].kind;
        let result = b.upgrade(i);
        let t = self.t();
        let tool = ("tool", kind.name().to_string());
        match result {
            Ok(level) => self.log(fill(t.log_upgraded, &[tool, ("n", (level + 1).to_string())]), C::Info),
            Err(PlaceError::Broke(n)) => self.log(fill(t.log_broke, &[("n", n.to_string())]), C::Warn),
            Err(_) => self.log(fill(t.log_maxed, &[tool]), C::Muted),
        }
    }

    fn sell(&mut self) {
        let (Some(b), Some(i)) = (self.battle.as_mut(), self.selected) else { return };
        let kind = b.towers[i].kind;
        let back = b.sell(i);
        self.selected = None;
        let t = self.t();
        self.log(fill(t.log_sold, &[("tool", kind.name().to_string()), ("n", back.to_string())]), C::Muted);
    }

    /// A click (or Enter) on a map cell: install the chosen tool, or select the one that is there.
    fn grid(&mut self, col: i32, row: i32) {
        let Some(b) = self.battle.as_mut() else { return };
        if let Some(i) = b.tower_at(col, row) {
            self.selected = Some(i);
            self.build = None;
            return;
        }
        let Some(kind) = self.build else {
            self.selected = None;
            return;
        };
        let result = b.place(kind, col, row);
        let t = self.t();
        match result {
            Ok(()) => self.log(fill(t.log_built, &[("tool", kind.name().to_string())]), C::Muted),
            Err(PlaceError::Broke(n)) => self.log(fill(t.log_broke, &[("n", n.to_string())]), C::Warn),
            Err(_) => self.log(t.log_blocked.to_string(), C::Warn),
        }
    }

    fn act(&mut self, a: Action) {
        let level = self.battle.as_ref().map(|b| b.level);
        match a {
            Action::Select(i) if self.sel == i => self.start_level(i),
            Action::Select(i) => self.sel = i,
            Action::Start(i) => self.start_level(i),
            Action::Shop(k) => {
                self.build = if self.build == Some(k) { None } else { Some(k) };
                self.selected = None;
            }
            Action::Upgrade => self.upgrade(),
            Action::Sell => self.sell(),
            Action::Push => self.push(),
            Action::Pause => self.set_paused(true),
            Action::Resume => self.set_paused(false),
            Action::Restart => {
                if let Some(l) = level {
                    self.start_level(l);
                }
            }
            Action::Menu => self.to_menu(),
            Action::Next => match level {
                Some(l) if l + 1 < LEVELS.len() => self.start_level(l + 1),
                _ => self.to_menu(),
            },
            Action::Speed => self.fast = !self.fast,
        }
    }

    /* ---------- input ---------- */

    pub fn pointer_move(&mut self, x: f32, y: f32) {
        self.pointer = Some((x, y));
        self.cursor = None;
    }

    pub fn pointer_leave(&mut self) {
        self.pointer = None;
    }

    pub fn pointer_down(&mut self, x: f32, y: f32) {
        self.pointer_move(x, y);
        if let Some(a) = self.hits.iter().rev().find(|h| x >= h.x && x < h.x + h.w && y >= h.y && y < h.y + h.h).map(|h| h.action) {
            self.act(a);
            return;
        }
        if self.battle.is_some() && !self.modal() {
            match cell_at(x, y) {
                Some((c, r)) => self.grid(c, r),
                // a click next to the map (terminal, empty sidebar) just drops the current choice
                None => {
                    self.build = None;
                    self.selected = None;
                }
            }
        }
    }

    pub fn key(&mut self, code: u32) {
        let Some(k) = Key::from_code(code) else { return };
        let Some(b) = &self.battle else {
            return self.menu_key(k);
        };
        let action = match (b.outcome, self.paused, k) {
            (Some(Outcome::Won), _, Key::Enter | Key::Space) => Action::Next,
            (Some(Outcome::Lost), _, Key::Enter | Key::Space) => Action::Restart,
            (Some(_), _, Key::Restart) => Action::Restart,
            (Some(_), _, Key::Escape | Key::Levels) => Action::Menu,
            (None, true, Key::Enter | Key::Space | Key::Escape | Key::Pause) => Action::Resume,
            (None, true, Key::Restart) => Action::Restart,
            (None, true, Key::Levels) => Action::Menu,
            (None, false, _) => return self.play_key(k),
            _ => return,
        };
        self.act(action);
    }

    fn menu_key(&mut self, k: Key) {
        match k {
            Key::Up | Key::Left => self.sel = self.sel.saturating_sub(1),
            Key::Down | Key::Right => self.sel = (self.sel + 1).min(LEVELS.len() - 1),
            Key::Digit(n) if (1..=5).contains(&n) => self.sel = n as usize - 1,
            Key::Enter | Key::Space => self.start_level(self.sel),
            _ => {}
        }
    }

    fn play_key(&mut self, k: Key) {
        match k {
            // unlike a click on the list, a number key always picks (pressing it twice doesn't put the tool away)
            Key::Digit(n) if (1..=6).contains(&n) => {
                self.build = Some(TowerKind::ALL[n as usize - 1]);
                self.selected = None;
            }
            Key::Up | Key::Down | Key::Left | Key::Right => {
                let (c, r) = self.cursor.or_else(|| self.pointer.and_then(|(x, y)| cell_at(x, y))).unwrap_or((COLS / 2, ROWS / 2));
                let (c, r) = match k {
                    Key::Up => (c, r - 1),
                    Key::Down => (c, r + 1),
                    Key::Left => (c - 1, r),
                    _ => (c + 1, r),
                };
                self.cursor = Some((c.clamp(0, COLS - 1), r.clamp(0, ROWS - 1)));
                self.pointer = None;
            }
            Key::Enter => match self.cursor {
                Some((c, r)) => self.grid(c, r),
                None => self.cursor = Some((COLS / 2, ROWS / 2)),
            },
            Key::Space => self.push(),
            Key::Upgrade => self.upgrade(),
            Key::Sell => self.sell(),
            Key::Escape if self.build.is_some() || self.selected.is_some() => {
                self.build = None;
                self.selected = None;
            }
            Key::Escape | Key::Pause => self.set_paused(true),
            Key::Speed => self.fast = !self.fast,
            _ => {}
        }
    }

    /* ---------- frame ---------- */

    pub fn frame(&mut self, dt: f32) {
        let dt = dt.clamp(0.0, 0.1);
        self.time += dt;
        if let Some(b) = self.battle.as_mut() {
            if !self.paused {
                let total = if self.fast { dt * 2.0 } else { dt };
                let steps = (total / 0.02).ceil().max(1.0);
                for _ in 0..steps as usize {
                    b.update(total / steps);
                }
            }
            self.drain_events();
        }
        self.render();
    }

    fn drain_events(&mut self) {
        let Some(b) = self.battle.as_mut() else { return };
        let events = std::mem::take(&mut b.events);
        let (level, total, stars) = (b.level, b.total_waves(), b.stars());
        let t = self.t();
        for e in events {
            match e {
                Event::WaveStart(n) => {
                    let vars = [("n", n.to_string()), ("total", total.to_string())];
                    self.log(fill(t.log_wave, &vars), C::Info);
                    self.say(fill(t.say_wave, &vars));
                }
                Event::WaveDone(n, bonus) => self.log(fill(t.log_done, &[("n", n.to_string()), ("b", bonus.to_string())]), C::Success),
                Event::Early(bonus) => self.log(fill(t.log_early, &[("b", bonus.to_string())]), C::Warn),
                Event::Squashed(kind, n) => {
                    self.log(fill(t.log_squash, &[("bug", kind.name().to_string()), ("n", n.to_string())]), C::Success)
                }
                Event::Leaked(kind, n) => self.log(fill(t.log_leak, &[("bug", kind.name().to_string()), ("n", n.to_string())]), C::Danger),
                Event::Boss => self.log(t.log_boss.to_string(), C::Danger),
                Event::Won => {
                    if stars > self.stars[level] {
                        self.stars[level] = stars;
                        self.save_pending = true;
                    }
                    self.build = None;
                    self.selected = None;
                    self.log(fill(t.log_won, &[("s", stars.to_string())]), C::Success);
                    self.say(fill(t.say_won, &[("s", stars.to_string())]));
                }
                Event::Lost => {
                    self.build = None;
                    self.selected = None;
                    self.log(t.log_lost.to_string(), C::Danger);
                    self.say(t.say_lost.to_string());
                }
            }
        }
    }

    /* ---------- drawing helpers ---------- */

    fn hovered(&self, x: f32, y: f32, w: f32, h: f32) -> bool {
        self.pointer.is_some_and(|(px, py)| px >= x && px < x + w && py >= y && py < y + h)
    }

    /// Registers a clickable area and returns whether the pointer is over it.
    fn button(&mut self, x: f32, y: f32, w: f32, h: f32, action: Action) -> bool {
        self.hits.push(Hit { x, y, w, h, action });
        let hov = self.hovered(x, y, w, h);
        if hov {
            self.pointer_cursor = true;
        }
        hov
    }

    /// A text button. Primary ones are filled with the accent color.
    fn text_button(&mut self, label: &str, x: f32, y: f32, h: f32, primary: bool, enabled: bool, action: Action) -> f32 {
        let w = text_w(label, 12.0) + 28.0;
        let hov = if enabled { self.button(x, y, w, h, action) } else { false };
        let cv = &mut self.canvas;
        let a = if enabled { 1.0 } else { 0.45 };
        if primary {
            cv.rrect(x, y, w, h, 6.0, C::Accent, a * if hov { 1.0 } else { 0.88 });
            cv.text(label, x + w / 2.0, y + h / 2.0, 12.0, C::OnStatus, a, Align::Center, true);
        } else {
            cv.rrect(x, y, w, h, 6.0, C::Raised, a);
            cv.frame(x, y, w, h, 6.0, if hov { C::Accent } else { C::Border }, a, 1.0);
            cv.text(label, x + w / 2.0, y + h / 2.0, 12.0, C::Text, a, Align::Center, true);
        }
        w
    }

    fn render(&mut self) {
        self.canvas.clear();
        self.hits.clear();
        self.pointer_cursor = false;
        match self.battle.take() {
            Some(b) => {
                self.draw_play(&b);
                self.battle = Some(b);
            }
            None => self.draw_menu(),
        }
    }

    fn tab_bar(&mut self, file: &str, close: bool) {
        let cv = &mut self.canvas;
        cv.rect(0.0, 0.0, W, TAB_H, C::Panel, 1.0);
        cv.line(0.0, TAB_H - 0.5, W, TAB_H - 0.5, C::Border, 1.0, 1.0);
        draw_bug(cv, BugKind::NullPointer, 20.0, 16.0, 5.5, (1.0, 0.0), self.time, 1.0);
        let w = text_w(file, 12.0) + if close { 64.0 } else { 44.0 };
        cv.rect(MAP_X, 0.0, w, TAB_H, C::Bg, 1.0);
        cv.rect(MAP_X, 0.0, w, 2.0, C::Accent, 1.0);
        let (badge, color) = file_badge(file);
        cv.text(badge, MAP_X + 14.0, TAB_H / 2.0, 9.0, color, 1.0, Align::Center, true);
        cv.text(file, MAP_X + 28.0, TAB_H / 2.0, 12.0, C::Text, 1.0, Align::Left, false);
        if close {
            // closing the file pauses first; the dialog has the way out
            let x = MAP_X + w - 26.0;
            let hov = self.button(x, 6.0, 20.0, 20.0, Action::Pause);
            let cv = &mut self.canvas;
            if hov {
                cv.rrect(x, 6.0, 20.0, 20.0, 4.0, C::Raised, 1.0);
            }
            cv.line(x + 6.0, 12.0, x + 14.0, 20.0, C::Muted, 1.0, 1.4);
            cv.line(x + 14.0, 12.0, x + 6.0, 20.0, C::Muted, 1.0, 1.4);
        }
    }

    fn status_bar(&mut self, b: Option<&Battle>) {
        let cv = &mut self.canvas;
        let y = STATUS_Y + 10.0;
        cv.rect(0.0, STATUS_Y, W, H - STATUS_Y, C::Status, 1.0);
        let mut left = String::from("git:main");
        if let Some(b) = b {
            left.push_str(&format!("   ✓ {}   ✗ {}", b.squashed, b.leaked));
        }
        cv.text(&left, 12.0, y, 11.0, C::OnStatus, 1.0, Align::Left, true);
        let mut right = String::new();
        if let Some((c, r)) = self.cursor.or_else(|| self.pointer.and_then(|(x, y)| cell_at(x, y))).filter(|_| b.is_some()) {
            right.push_str(&format!("Ln {}, Col {}    ", r * 2 + 1, c * 4 + 1));
        }
        right.push_str("Rust → wasm32    UTF-8");
        cv.text(&right, W - 12.0, y, 11.0, C::OnStatus, 1.0, Align::Right, false);
    }

    /* ---------- level select ---------- */

    fn draw_menu(&mut self) {
        let t = self.t();
        self.canvas.rect(0.0, 0.0, W, H, C::Bg, 1.0);
        self.tab_bar("README.md", false);

        // explorer
        let ex_w = 250.0;
        let cv = &mut self.canvas;
        cv.rect(0.0, TAB_H, ex_w, STATUS_Y - TAB_H, C::Panel, 1.0);
        cv.line(ex_w - 0.5, TAB_H, ex_w - 0.5, STATUS_Y, C::Border, 1.0, 1.0);
        cv.text("EXPLORER", 16.0, 50.0, 10.0, C::Muted, 1.0, Align::Left, true);
        cv.text("▾ levels/", 16.0, 74.0, 12.0, C::Text, 1.0, Align::Left, true);
        for (i, lv) in LEVELS.iter().enumerate() {
            let y = 88.0 + i as f32 * 46.0;
            let hov = self.button(0.0, y, ex_w, 44.0, Action::Select(i));
            let unlocked = self.unlocked(i);
            let stars = self.stars[i];
            let cv = &mut self.canvas;
            if i == self.sel {
                cv.rect(0.0, y, ex_w - 1.0, 44.0, C::Raised, 1.0);
                cv.rect(0.0, y, 3.0, 44.0, C::Accent, 1.0);
            } else if hov {
                cv.rect(0.0, y, ex_w - 1.0, 44.0, C::Raised, 0.6);
            }
            if unlocked {
                let (badge, color) = file_badge(lv.file);
                cv.text(badge, 40.0, y + 15.0, 9.0, color, 1.0, Align::Center, true);
            } else {
                lock(cv, 40.0, y + 16.0);
            }
            cv.text(lv.file, 60.0, y + 15.0, 12.0, if unlocked { C::Text } else { C::Faint }, 1.0, Align::Left, false);
            if unlocked {
                cv.text(&star_str(stars), 60.0, y + 31.0, 11.0, if stars > 0 { C::Warn } else { C::Faint }, 1.0, Align::Left, false);
            } else {
                cv.text(t.locked, 60.0, y + 31.0, 11.0, C::Faint, 1.0, Align::Left, false);
            }
        }
        if self.stars.iter().all(|&s| s > 0) {
            let lines = wrap(t.all_done, 32);
            for (k, l) in lines.iter().enumerate() {
                self.canvas.text(l, 16.0, 332.0 + k as f32 * 16.0, 11.0, C::Success, 1.0, Align::Left, false);
            }
        }

        // title
        let x0 = 290.0;
        let i = self.sel;
        let lv = &LEVELS[i];
        let unlocked = self.unlocked(i);
        let cv = &mut self.canvas;
        cv.text(t.subtitle, x0, 66.0, 13.0, C::Faint, 1.0, Align::Left, false);
        cv.text("Bug Bash", x0, 104.0, 44.0, C::Text, 1.0, Align::Left, true);
        if (self.time * 1.6).fract() < 0.55 {
            cv.rect(x0 + text_w("Bug Bash", 44.0) + 8.0, 86.0, 20.0, 38.0, C::Accent, 0.9);
        }
        draw_bug(cv, BugKind::NullPointer, 860.0, 100.0, 16.0, (-0.8, 0.6), self.time, 1.0);
        draw_bug(cv, BugKind::Typo, 905.0, 72.0, 8.0, (-0.9, 0.4), self.time + 1.0, 0.8);
        for (k, l) in wrap(t.tagline, 76).iter().enumerate() {
            cv.text(l, x0, 146.0 + k as f32 * 20.0, 14.0, C::Muted, 1.0, Align::Left, false);
        }

        // the selected level
        let (cx, cy, cw, ch) = (x0 - 10.0, 192.0, 650.0, 280.0);
        cv.rrect(cx, cy, cw, ch, 10.0, C::Raised, 0.5);
        cv.frame(cx, cy, cw, ch, 10.0, C::Border, 1.0, 1.0);
        cv.text("levels/", x0 + 8.0, cy + 28.0, 18.0, C::Faint, 1.0, Align::Left, true);
        cv.text(lv.file, x0 + 8.0 + text_w("levels/", 18.0), cy + 28.0, 18.0, C::Text, 1.0, Align::Left, true);
        let stars = self.stars[i];
        cv.text(&star_str(stars), cx + cw - 20.0, cy + 28.0, 18.0, if stars > 0 { C::Warn } else { C::Faint }, 1.0, Align::Right, false);
        for (k, l) in wrap(t.levels[i], 76).iter().enumerate() {
            cv.text(l, x0 + 8.0, cy + 60.0 + k as f32 * 19.0, 13.0, C::Muted, 1.0, Align::Left, false);
        }
        let sprints = fill(t.sprints, &[("n", lv.waves.len().to_string())]);
        cv.text(&sprints, x0 + 8.0, cy + 122.0, 12.0, C::Text, 1.0, Align::Left, true);
        let cx2 = x0 + 8.0 + text_w(&sprints, 12.0) + 24.0;
        coffee(cv, cx2, cy + 122.0, 12.0, 1.0);
        cv.text(&fill(t.coffee_start, &[("n", lv.coffee.to_string())]), cx2 + 16.0, cy + 122.0, 12.0, C::Text, 1.0, Align::Left, false);
        cv.text(&t.new_bugs.to_uppercase(), x0 + 8.0, cy + 150.0, 10.0, C::Faint, 1.0, Align::Left, true);
        for (k, bug) in lv.new_bugs.iter().enumerate() {
            let y = cy + 172.0 + k as f32 * 24.0;
            draw_bug(cv, *bug, x0 + 18.0, y, 7.0, (1.0, 0.0), self.time + k as f32, 1.0);
            cv.text(bug.name(), x0 + 36.0, y, 12.0, C::Text, 1.0, Align::Left, true);
            let nx = x0 + 36.0 + text_w(bug.name(), 12.0);
            cv.text(&format!(": {}", t.bugs[bug.index()]), nx, y, 12.0, C::Muted, 1.0, Align::Left, false);
        }
        let by = cy + ch - 50.0;
        if unlocked {
            let label = format!("$ cargo run --level {}", i + 1);
            let w = self.text_button(&label, x0 + 8.0, by, 34.0, true, true, Action::Start(i));
            self.canvas.text(t.start_hint, x0 + 24.0 + w, by + 17.0, 12.0, C::Faint, 1.0, Align::Left, false);
        } else {
            let prev = LEVELS[i - 1].file.to_string();
            lock(&mut self.canvas, x0 + 16.0, by + 17.0);
            self.canvas.text(&fill(t.locked_hint, &[("file", prev)]), x0 + 32.0, by + 17.0, 12.0, C::Warn, 1.0, Align::Left, false);
        }

        // how to play
        for (k, l) in t.how.iter().enumerate() {
            self.canvas.text(&format!("- {l}"), x0, 500.0 + k as f32 * 22.0, 12.0, C::Muted, 1.0, Align::Left, false);
        }
        self.status_bar(None);
    }

    /* ---------- battle ---------- */

    fn draw_play(&mut self, b: &Battle) {
        self.canvas.rect(0.0, 0.0, W, H, C::Bg, 1.0);
        self.draw_editor(b);
        self.canvas.clip(MAP_X, MAP_Y, MAP_W, MAP_H);
        self.draw_towers(b);
        self.draw_bugs(b);
        self.draw_shots(b);
        self.draw_fx(b);
        self.draw_ghost(b);
        self.canvas.unclip();
        self.draw_topbar(b);
        self.draw_sidebar(b);
        self.draw_terminal(b);
        self.status_bar(Some(b));
        if self.paused || b.outcome.is_some() {
            self.draw_dialog(b);
        }
    }

    /// The cell under the pointer or keyboard cursor. (While drawing, the battle is lent out: pass it in.)
    fn focus_cell(&self, b: &Battle) -> Option<(i32, i32)> {
        if self.paused || b.outcome.is_some() {
            return None;
        }
        self.cursor.or_else(|| self.pointer.and_then(|(x, y)| cell_at(x, y)))
    }

    fn draw_editor(&mut self, b: &Battle) {
        let focus = self.focus_cell(b);
        let time = self.time;
        let cv = &mut self.canvas;
        if let Some((_, r)) = focus {
            cv.rect(MAP_X, MAP_Y + r as f32 * CELL, MAP_W, CELL, C::Raised, 0.55);
        }
        for r in 0..ROWS {
            for c in 0..COLS {
                if b.is_path(c, r) {
                    cv.rect(MAP_X + c as f32 * CELL, MAP_Y + r as f32 * CELL, CELL, CELL, C::Path, 1.0);
                }
            }
        }
        // line numbers and code, two lines per cell
        for i in 0..(ROWS * 2) as usize {
            let y = MAP_Y + LINE_H / 2.0 + i as f32 * LINE_H;
            let current = focus.is_some_and(|(_, r)| r as usize == i / 2);
            cv.text(&(i + 1).to_string(), MAP_X - 8.0, y, 11.0, if current { C::Text } else { C::Faint }, 1.0, Align::Right, false);
            if let Some(line) = self.code.get(i) {
                for (col, s, color) in line {
                    let a = if *color == C::Faint { 0.8 } else { 0.5 };
                    cv.text(s, MAP_X + 8.0 + *col as f32 * CODE_SIZE * 0.6, y, CODE_SIZE, *color, a, Align::Left, false);
                }
            }
        }
        // data flowing along the paths
        for p in &b.paths {
            let len: f32 = p.windows(2).map(|w| seg_len(w[0], w[1])).sum();
            let mut d = (time * 26.0) % 26.0;
            while d < len {
                let (x, y) = along(p, d);
                cv.circle(MAP_X + x, MAP_Y + y, 1.8, C::Muted, 0.5);
                d += 26.0;
            }
        }
        // where bugs come from, and where they go
        let lv = &LEVELS[b.level];
        for p in lv.paths {
            let (c, r) = p[0];
            tag(cv, (c as i32).clamp(0, COLS - 1), (r as i32).clamp(0, ROWS - 1), "issues", C::Danger);
        }
        let (c, r) = lv.paths[0][lv.paths[0].len() - 1];
        tag(cv, (c as i32).clamp(0, COLS - 1), (r as i32).clamp(0, ROWS - 1), "prod", C::Success);
    }

    fn draw_towers(&mut self, b: &Battle) {
        let focus = self.focus_cell(b);
        let time = self.time;
        let selected = self.selected;
        let cv = &mut self.canvas;
        // reach of the selected tool, or the one under the pointer
        for (i, t) in b.towers.iter().enumerate() {
            let hover = focus == Some((t.col, t.row)) && self.build.is_none();
            if selected == Some(i) || hover {
                let (x, y) = to_screen(t.pos());
                cv.circle(x, y, t.range(), C::Accent, 0.07);
                cv.ring(x, y, t.range(), C::Accent, if selected == Some(i) { 0.9 } else { 0.5 }, 1.5, 5.0);
            }
        }
        for (i, t) in b.towers.iter().enumerate() {
            let (x, y) = to_screen(t.pos());
            let color = t.kind.color();
            cv.rrect(x - 16.0, y - 16.0, 32.0, 32.0, 6.0, C::Raised, 1.0);
            let flash = (1.0 - t.since_fire / 0.15).max(0.0);
            if flash > 0.0 {
                cv.rrect(x - 16.0, y - 16.0, 32.0, 32.0, 6.0, color, 0.3 * flash);
            }
            if selected == Some(i) {
                cv.frame(x - 16.0, y - 16.0, 32.0, 32.0, 6.0, C::Accent, 1.0, 2.0);
            } else {
                cv.frame(x - 16.0, y - 16.0, 32.0, 32.0, 6.0, color, 0.6 + 0.4 * flash, 1.25);
            }
            glyph(cv, t.kind, x, y - 2.0, 30.0, 1.0, time);
            for l in 0..=t.level {
                cv.circle(x - t.level as f32 * 3.0 + l as f32 * 6.0, y + 11.0, 1.6, color, 1.0);
            }
        }
    }

    fn draw_bugs(&mut self, b: &Battle) {
        let cv = &mut self.canvas;
        for bug in &b.bugs {
            let (mut x, mut y) = to_screen((bug.x, bug.y));
            let r = bug.radius();
            let (dx, dy) = bug.dir;
            let hidden = bug.kind == BugKind::Heisenbug && !bug.revealed;
            let a = if hidden { 0.12 + 0.1 * (bug.age * 9.0).sin().abs() } else { 1.0 };
            if bug.kind == BugKind::RaceCondition {
                let wob = (bug.age * 14.0 + bug.phase()).sin() * 3.0;
                x += -dy * wob;
                y += dx * wob;
                for k in 1..=2 {
                    let back = k as f32 * 7.0;
                    cv.circle(x - dx * back, y - dy * back, r * 0.9, bug.kind.color(), 0.3 / k as f32);
                }
            }
            if bug.slow < 1.0 {
                cv.ring(x, y, r + 5.0, C::Danger, 0.55, 1.2, 2.0);
            }
            draw_bug(cv, bug.kind, x, y, r, bug.dir, bug.age + bug.phase(), a);
            if bug.kind == BugKind::LegacyCode {
                cv.ring(x, y, r + 2.5, C::Muted, 0.9, 2.0, 0.0);
            }
            if bug.kind == BugKind::Heisenbug && bug.revealed {
                cv.ring(x, y, r + 4.0, C::Accent2, 0.8, 1.2, 3.0);
            }
            if bug.hit > 0.0 && !hidden {
                cv.circle(x, y, r, C::Text, 0.4 * bug.hit / 0.1);
            }
            if bug.hp < bug.max_hp && !hidden {
                let w = (r * 2.4).max(18.0);
                let pct = (bug.hp / bug.max_hp).clamp(0.0, 1.0);
                let color = if pct > 0.6 { C::Success } else if pct > 0.3 { C::Warn } else { C::Danger };
                cv.rect(x - w / 2.0, y - r - 9.0, w, 3.0, C::Shade, 0.5);
                cv.rect(x - w / 2.0, y - r - 9.0, w * pct, 3.0, color, 1.0);
            }
            if bug.kind == BugKind::Spaghetti {
                cv.text("SPAGHETTI", x, y - r - 18.0, 9.0, C::Danger, 1.0, Align::Center, true);
            }
        }
    }

    fn draw_shots(&mut self, b: &Battle) {
        let cv = &mut self.canvas;
        for s in &b.shots {
            let (x, y) = to_screen((s.x, s.y));
            match s.kind {
                TowerKind::UnitTest => {
                    let (dx, dy) = (s.tx - s.x, s.ty - s.y);
                    let d = (dx * dx + dy * dy).sqrt().max(1.0);
                    cv.line(x - dx / d * 9.0, y - dy / d * 9.0, x, y, C::Success, 1.0, 2.5);
                }
                TowerKind::Review => {
                    cv.circle(x, y, 4.0, C::Accent2, 1.0);
                    cv.ring(x, y, 7.0, C::Accent2, 0.5, 1.0, 0.0);
                }
                _ => cv.circle(x, y, 2.5, C::Info, 1.0),
            }
        }
    }

    fn draw_fx(&mut self, b: &Battle) {
        let cv = &mut self.canvas;
        for f in &b.fx {
            let p = f.t / f.dur;
            let (x, y) = to_screen((f.x, f.y));
            match &f.kind {
                FxKind::Ring(r0, r1) => cv.ring(x, y, r0 + (r1 - r0) * p, f.color, 0.7 * (1.0 - p), 2.0, 0.0),
                FxKind::Zap(x2, y2) => {
                    let (x2, y2) = to_screen((*x2, *y2));
                    cv.line(x, y, x2, y2, f.color, 1.0 - p, 2.5 * (1.0 - p) + 0.5);
                }
                FxKind::Pop => {
                    for k in 0..6 {
                        let ang = k as f32 / 6.0 * TAU + 0.3;
                        let (r0, r1) = (4.0 + 10.0 * p, 8.0 + 14.0 * p);
                        cv.line(x + ang.cos() * r0, y + ang.sin() * r0, x + ang.cos() * r1, y + ang.sin() * r1, f.color, 1.0 - p, 2.0);
                    }
                }
                FxKind::Float(s) => cv.text(s, x, y - 18.0 * p, 11.0, f.color, 1.0 - p * p, Align::Center, true),
            }
        }
    }

    /// The tool about to be installed, under the pointer or the keyboard cursor.
    fn draw_ghost(&mut self, b: &Battle) {
        let Some((c, r)) = self.focus_cell(b) else { return };
        let (x, y) = to_screen(cell_center(c, r));
        if let Some(kind) = self.build {
            if b.can_build(c, r) {
                self.pointer_cursor = self.cursor.is_none();
                let afford = b.coffee >= kind.cost();
                let color = if afford { C::Success } else { C::Warn };
                let range = kind.range(0) * CELL;
                let cv = &mut self.canvas;
                cv.circle(x, y, range, color, 0.06);
                cv.ring(x, y, range, color, 0.8, 1.5, 5.0);
                cv.rrect(x - 16.0, y - 16.0, 32.0, 32.0, 6.0, C::Raised, 0.7);
                glyph(cv, kind, x, y - 2.0, 30.0, 0.6, self.time);
            } else if b.tower_at(c, r).is_none() {
                self.canvas.rect(MAP_X + c as f32 * CELL, MAP_Y + r as f32 * CELL, CELL, CELL, C::Danger, 0.18);
            }
        } else if b.tower_at(c, r).is_some() {
            self.pointer_cursor = self.cursor.is_none();
        }
        if self.cursor.is_some() {
            self.canvas.frame(MAP_X + c as f32 * CELL + 1.0, MAP_Y + r as f32 * CELL + 1.0, CELL - 2.0, CELL - 2.0, 4.0, C::Accent, 1.0, 2.0);
        }
    }

    fn draw_topbar(&mut self, b: &Battle) {
        let t = self.t();
        self.tab_bar(LEVELS[b.level].file, true);

        // right to left: pause, speed, sprint, uptime, coffee
        let mut x = W - 8.0;
        x -= 28.0;
        let hov = self.button(x, 4.0, 28.0, 24.0, Action::Pause);
        let cv = &mut self.canvas;
        if hov {
            cv.rrect(x, 4.0, 28.0, 24.0, 5.0, C::Raised, 1.0);
        }
        cv.rect(x + 10.0, 10.0, 3.0, 12.0, C::Text, 1.0);
        cv.rect(x + 16.0, 10.0, 3.0, 12.0, C::Text, 1.0);
        x -= 36.0;
        let hov = self.button(x, 4.0, 32.0, 24.0, Action::Speed);
        let cv = &mut self.canvas;
        if hov || self.fast {
            cv.rrect(x, 4.0, 32.0, 24.0, 5.0, C::Raised, 1.0);
        }
        cv.text(if self.fast { "2x" } else { "1x" }, x + 16.0, 16.0, 11.0, if self.fast { C::Accent } else { C::Muted }, 1.0, Align::Center, true);
        x -= 14.0;
        let sprint = format!("{} {}/{}", t.sprint, b.wave, b.total_waves());
        cv.text(&sprint, x, 16.0, 12.0, C::Text, 1.0, Align::Right, true);
        x -= text_w(&sprint, 12.0) + 20.0;
        let pct = format!("{}%", b.uptime);
        let color = if b.uptime > 60 { C::Success } else if b.uptime > 30 { C::Warn } else { C::Danger };
        cv.text(&pct, x, 16.0, 12.0, color, 1.0, Align::Right, true);
        x -= text_w(&pct, 12.0) + 8.0 + 60.0;
        cv.rrect(x, 13.0, 60.0, 6.0, 3.0, C::Raised, 1.0);
        cv.rrect(x, 13.0, 60.0 * b.uptime as f32 / 100.0, 6.0, 3.0, color, 1.0);
        x -= 8.0;
        cv.text(t.uptime, x, 16.0, 11.0, C::Muted, 1.0, Align::Right, false);
        x -= text_w(t.uptime, 11.0) + 20.0;
        let coffee_s = b.coffee.to_string();
        cv.text(&coffee_s, x, 16.0, 13.0, C::Text, 1.0, Align::Right, true);
        x -= text_w(&coffee_s, 13.0) + 20.0;
        coffee(cv, x, 16.0, 14.0, 1.0);
    }

    fn draw_sidebar(&mut self, b: &Battle) {
        let t = self.t();
        let x0 = SIDE_X;
        let cv = &mut self.canvas;
        cv.rect(x0, TAB_H, SIDE_W, STATUS_Y - TAB_H, C::Panel, 1.0);
        cv.line(x0 + 0.5, TAB_H, x0 + 0.5, STATUS_Y, C::Border, 1.0, 1.0);
        cv.text(t.tools, x0 + 14.0, TAB_H + 14.0, 10.0, C::Muted, 1.0, Align::Left, true);

        let mut hover_shop = None;
        for (i, &kind) in TowerKind::ALL.iter().enumerate() {
            let y = TAB_H + 26.0 + i as f32 * 42.0;
            let hov = self.button(x0 + 4.0, y, SIDE_W - 8.0, 40.0, Action::Shop(kind));
            if hov {
                hover_shop = Some(kind);
            }
            let afford = b.coffee >= kind.cost();
            let active = self.build == Some(kind);
            let time = self.time;
            let cv = &mut self.canvas;
            if active {
                cv.rrect(x0 + 4.0, y, SIDE_W - 8.0, 40.0, 6.0, C::Raised, 1.0);
                cv.frame(x0 + 4.0, y, SIDE_W - 8.0, 40.0, 6.0, C::Accent, 1.0, 1.5);
            } else if hov {
                cv.rrect(x0 + 4.0, y, SIDE_W - 8.0, 40.0, 6.0, C::Raised, 0.7);
            }
            let a = if afford { 1.0 } else { 0.45 };
            cv.rrect(x0 + 12.0, y + 5.0, 30.0, 30.0, 6.0, C::Bg, a);
            cv.frame(x0 + 12.0, y + 5.0, 30.0, 30.0, 6.0, kind.color(), 0.6 * a, 1.0);
            glyph(cv, kind, x0 + 27.0, y + 19.0, 28.0, a, time);
            cv.text(kind.name(), x0 + 52.0, y + 13.0, 12.0, C::Text, a, Align::Left, true);
            coffee(cv, x0 + 52.0, y + 28.0, 10.0, a);
            cv.text(&kind.cost().to_string(), x0 + 66.0, y + 28.0, 11.0, if afford { C::Num } else { C::Danger }, 1.0, Align::Left, true);
            cv.text(&(i + 1).to_string(), x0 + SIDE_W - 16.0, y + 13.0, 10.0, C::Faint, 1.0, Align::Right, false);
        }

        // info panel
        let y0 = TAB_H + 290.0;
        let cv = &mut self.canvas;
        cv.line(x0 + 12.0, y0 - 8.0, x0 + SIDE_W - 12.0, y0 - 8.0, C::Border, 1.0, 1.0);
        let selected = self.selected.filter(|&i| i < b.towers.len());
        if let Some(i) = selected {
            let tw = &b.towers[i];
            let y = self.tool_info(tw.kind, tw.level, y0);
            let upgrade = tw.kind.upgrade_cost(tw.level);
            match upgrade {
                Some(cost) => {
                    let label = format!("{} v{}.0  {}", t.upgrade, tw.level + 2, cost);
                    let enabled = b.coffee >= cost;
                    self.text_button(&label, x0 + 12.0, y + 6.0, 26.0, true, enabled, Action::Upgrade);
                }
                None => self.canvas.text(t.maxed, x0 + 14.0, y + 19.0, 11.0, C::Success, 1.0, Align::Left, true),
            };
            let label = format!("{}  +{}", t.sell, b.sell_value(i));
            self.text_button(&label, x0 + 12.0, y + 38.0, 24.0, false, true, Action::Sell);
        } else if let Some(kind) = hover_shop.or(self.build) {
            self.tool_info(kind, 0, y0);
        } else {
            for (k, l) in wrap(t.idle_hint, 27).iter().enumerate() {
                self.canvas.text(l, x0 + 14.0, y0 + 6.0 + k as f32 * 15.0, 11.0, C::Muted, 1.0, Align::Left, false);
            }
        }

        // git push
        let (bx, by, bw, bh) = (x0 + 12.0, STATUS_Y - 60.0, SIDE_W - 24.0, 48.0);
        if b.outcome.is_some() {
            return;
        }
        if b.can_push() {
            let hov = self.button(bx, by, bw, bh, Action::Push);
            let early = !b.bugs.is_empty();
            let cv = &mut self.canvas;
            cv.rrect(bx, by, bw, bh, 8.0, C::Accent, if hov { 1.0 } else { 0.88 });
            cv.text("$ git push", bx + bw / 2.0, by + 17.0, 14.0, C::OnStatus, 1.0, Align::Center, true);
            let sub = if early {
                fill(t.push_early, &[("n", (5 + 2 * (b.wave + 1)).to_string())])
            } else {
                fill(t.push_start, &[("n", (b.wave + 1).to_string())])
            };
            cv.text(&sub, bx + bw / 2.0, by + 34.0, 10.0, C::OnStatus, 0.85, Align::Center, false);
        } else {
            let cv = &mut self.canvas;
            cv.rrect(bx, by, bw, bh, 8.0, C::Raised, 1.0);
            cv.text(t.running, bx + bw / 2.0, by + 17.0, 12.0, C::Muted, 1.0, Align::Center, true);
            let dots = ".".repeat((self.time * 3.0) as usize % 4);
            cv.text(&format!("{} bugs{dots}", b.remaining()), bx + bw / 2.0, by + 34.0, 10.0, C::Faint, 1.0, Align::Center, false);
        }
    }

    /// Name, description and numbers of a tool. Returns the y below it.
    fn tool_info(&mut self, kind: TowerKind, level: u8, y0: f32) -> f32 {
        let t = self.t();
        let x = SIDE_X + 14.0;
        let cv = &mut self.canvas;
        cv.text(kind.name(), x, y0 + 6.0, 13.0, C::Text, 1.0, Align::Left, true);
        cv.text(&format!("v{}.0", level + 1), SIDE_X + SIDE_W - 14.0, y0 + 6.0, 11.0, C::Muted, 1.0, Align::Right, false);
        let mut y = y0 + 26.0;
        for l in wrap(t.towers[kind as usize], 27) {
            cv.text(&l, x, y, 11.0, C::Muted, 1.0, Align::Left, false);
            y += 15.0;
        }
        y += 4.0;
        let mut stats: Vec<(String, String)> = Vec::new();
        if kind != TowerKind::Duck {
            stats.push((t.damage.into(), num(kind.damage(level))));
            stats.push((t.rate.into(), format!("{}/s", num(1.0 / kind.interval(level)))));
        }
        stats.push((t.range.into(), num(kind.range(level))));
        for (label, value) in &stats {
            cv.text(label, x, y, 11.0, C::Faint, 1.0, Align::Left, false);
            cv.text(value, SIDE_X + SIDE_W - 14.0, y, 11.0, C::Text, 1.0, Align::Right, true);
            y += 15.0;
        }
        let special = match kind {
            TowerKind::Breakpoint => Some(fill(t.slow, &[("n", num((1.0 - kind.slow(level)) * 100.0))])),
            TowerKind::Duck => Some(fill(t.buff, &[("n", num((kind.buff(level) - 1.0) * 100.0))])),
            TowerKind::Review => Some(t.splash.to_string()),
            TowerKind::Ci => Some(fill(t.chain, &[("n", kind.chain(level).to_string())])),
            _ => None,
        };
        if let Some(s) = special {
            cv.text(&s, x, y, 11.0, kind.color(), 1.0, Align::Left, true);
            y += 15.0;
        }
        y
    }

    fn draw_terminal(&mut self, b: &Battle) {
        let t = self.t();
        let cv = &mut self.canvas;
        cv.rect(0.0, TERM_Y, SIDE_X, STATUS_Y - TERM_Y, C::Panel, 1.0);
        cv.line(0.0, TERM_Y + 0.5, SIDE_X, TERM_Y + 0.5, C::Border, 1.0, 1.0);
        let hy = TERM_Y + 12.0;
        cv.text(t.problems, 16.0, hy, 10.0, C::Muted, 1.0, Align::Left, true);
        let px = 16.0 + text_w(t.problems, 10.0) + 6.0;
        let count = b.bugs.len().to_string();
        let cw = text_w(&count, 9.0) + 10.0;
        cv.rrect(px, hy - 6.0, cw, 12.0, 6.0, if b.bugs.is_empty() { C::Raised } else { C::Danger }, 1.0);
        cv.text(&count, px + cw / 2.0, hy, 9.0, if b.bugs.is_empty() { C::Muted } else { C::OnStatus }, 1.0, Align::Center, true);
        let tx = px + cw + 22.0;
        cv.text(t.terminal, tx, hy, 10.0, C::Text, 1.0, Align::Left, true);
        cv.line(tx, hy + 8.0, tx + text_w(t.terminal, 10.0), hy + 8.0, C::Accent, 1.0, 1.5);
        let start = self.log.len().saturating_sub(3);
        for (k, (line, color)) in self.log[start..].iter().enumerate() {
            cv.text(line, 16.0, TERM_Y + 29.0 + k as f32 * 15.0, 11.0, *color, 1.0, Align::Left, false);
        }
    }

    fn draw_dialog(&mut self, b: &Battle) {
        let t = self.t();
        // nothing under the dialog can be clicked
        self.hits.clear();
        self.pointer_cursor = false;
        let (w, h) = (460.0, 220.0);
        let x = MAP_X + MAP_W / 2.0 - w / 2.0;
        let y = MAP_Y + MAP_H / 2.0 - h / 2.0;
        let cx = x + w / 2.0;
        let cv = &mut self.canvas;
        cv.rect(0.0, TAB_H, W, STATUS_Y - TAB_H, C::Shade, 0.55);
        cv.rrect(x, y, w, h, 10.0, C::Panel, 1.0);
        cv.rrect(x, y, w, 26.0, 10.0, C::Raised, 1.0);
        cv.rect(x, y + 16.0, w, 10.0, C::Raised, 1.0);
        cv.frame(x, y, w, h, 10.0, C::Border, 1.0, 1.0);
        for (k, c) in [C::Danger, C::Warn, C::Success].into_iter().enumerate() {
            cv.circle(x + 16.0 + k as f32 * 14.0, y + 13.0, 4.0, c, 1.0);
        }
        cv.text(&format!("bash: {}", LEVELS[b.level].file), cx, y + 13.0, 11.0, C::Muted, 1.0, Align::Center, false);

        let last = b.level + 1 == LEVELS.len();
        let buttons: Vec<(&str, Action, bool)> = match b.outcome {
            Some(Outcome::Won) => {
                cv.text("$ git push origin main", cx, y + 48.0, 12.0, C::Faint, 1.0, Align::Center, false);
                cv.text(t.won, cx, y + 78.0, 20.0, C::Success, 1.0, Align::Center, true);
                cv.text(&star_str(b.stars()), cx, y + 112.0, 26.0, C::Warn, 1.0, Align::Center, false);
                let sub = if last {
                    t.won_last.to_string()
                } else {
                    fill(t.won_sub, &[("u", b.uptime.to_string()), ("n", b.squashed.to_string())])
                };
                cv.text(&sub, cx, y + 144.0, 12.0, C::Muted, 1.0, Align::Center, false);
                if last {
                    vec![(t.quit, Action::Menu, true), (t.retry, Action::Restart, false)]
                } else {
                    vec![(t.next, Action::Next, true), (t.retry, Action::Restart, false), (t.quit, Action::Menu, false)]
                }
            }
            Some(Outcome::Lost) => {
                cv.text("$ curl -I https://prod", cx, y + 48.0, 12.0, C::Faint, 1.0, Align::Center, false);
                cv.text("HTTP/1.1 503 Service Unavailable", cx, y + 68.0, 12.0, C::Danger, 1.0, Align::Center, false);
                cv.text(t.lost, cx, y + 100.0, 20.0, C::Danger, 1.0, Align::Center, true);
                let sub = fill(t.lost_sub, &[("n", b.leaked.to_string()), ("s", b.wave.to_string())]);
                for (k, l) in wrap(&sub, 58).iter().enumerate() {
                    cv.text(l, cx, y + 132.0 + k as f32 * 16.0, 12.0, C::Muted, 1.0, Align::Center, false);
                }
                vec![(t.retry, Action::Restart, true), (t.quit, Action::Menu, false)]
            }
            None => {
                cv.text("^Z", cx, y + 50.0, 12.0, C::Faint, 1.0, Align::Center, false);
                cv.text(t.paused, cx, y + 82.0, 20.0, C::Text, 1.0, Align::Center, true);
                let sub = format!("{} {}/{}  ·  {} {}%", t.sprint, b.wave, b.total_waves(), t.uptime, b.uptime);
                cv.text(&sub, cx, y + 112.0, 12.0, C::Muted, 1.0, Align::Center, false);
                cv.text(t.paused_keys, cx, y + 136.0, 11.0, C::Faint, 1.0, Align::Center, false);
                vec![(t.resume, Action::Resume, true), (t.restart, Action::Restart, false), (t.quit, Action::Menu, false)]
            }
        };
        let total: f32 = buttons.iter().map(|(l, _, _)| text_w(l, 12.0) + 28.0).sum::<f32>() + 10.0 * (buttons.len() - 1) as f32;
        let mut bx = cx - total / 2.0;
        for (label, action, primary) in buttons {
            bx += self.text_button(label, bx, y + h - 50.0, 32.0, primary, true, action) + 10.0;
        }
    }
}

/* ---------- free helpers ---------- */

fn to_screen((x, y): (f32, f32)) -> (f32, f32) {
    (MAP_X + x, MAP_Y + y)
}

fn cell_at(x: f32, y: f32) -> Option<(i32, i32)> {
    if x < MAP_X || y < MAP_Y || x >= MAP_X + MAP_W || y >= MAP_Y + MAP_H {
        return None;
    }
    Some((((x - MAP_X) / CELL) as i32, ((y - MAP_Y) / CELL) as i32))
}

fn seg_len(a: (f32, f32), b: (f32, f32)) -> f32 {
    ((b.0 - a.0).powi(2) + (b.1 - a.1).powi(2)).sqrt()
}

/// The point `d` units along a path.
fn along(p: &[(f32, f32)], mut d: f32) -> (f32, f32) {
    for w in p.windows(2) {
        let l = seg_len(w[0], w[1]);
        if d <= l {
            let k = d / l.max(1e-3);
            return (w[0].0 + (w[1].0 - w[0].0) * k, w[0].1 + (w[1].1 - w[0].1) * k);
        }
        d -= l;
    }
    p[p.len() - 1]
}

/// 1 decimal, or none for whole numbers.
fn num(v: f32) -> String {
    if (v - v.round()).abs() < 0.05 { format!("{}", v.round() as i32) } else { format!("{v:.1}") }
}

fn star_str(n: u8) -> String {
    "★".repeat(n as usize) + &"☆".repeat(3 - n as usize)
}

/// Greedy word wrap by character count (the font is monospaced).
fn wrap(s: &str, max: usize) -> Vec<String> {
    let mut lines = Vec::new();
    let mut line = String::new();
    for word in s.split_whitespace() {
        if !line.is_empty() && line.chars().count() + 1 + word.chars().count() > max {
            lines.push(std::mem::take(&mut line));
        }
        if !line.is_empty() {
            line.push(' ');
        }
        line.push_str(word);
    }
    if !line.is_empty() {
        lines.push(line);
    }
    lines
}

/// The little colored file type label editors put before a file name.
fn file_badge(file: &str) -> (&'static str, C) {
    match file.rsplit('.').next() {
        Some("js") => ("JS", C::Warn),
        Some("rs") => ("RS", C::Beak),
        Some("py") => ("PY", C::Info),
        Some("java") => ("J", C::Danger),
        Some("yml") => ("Y", C::Keyword),
        _ => ("i", C::Info),
    }
}

fn lock(cv: &mut Canvas, x: f32, y: f32) {
    cv.ring(x, y - 3.0, 3.5, C::Faint, 1.0, 1.5, 0.0);
    cv.rrect(x - 5.0, y - 2.0, 10.0, 8.0, 1.5, C::Faint, 1.0);
}

/// A coffee cup, `s` tall, vertically centered on `y`.
fn coffee(cv: &mut Canvas, x: f32, y: f32, s: f32, a: f32) {
    cv.rrect(x, y - s * 0.38, s * 0.7, s * 0.76, s * 0.14, C::Num, a);
    cv.ring(x + s * 0.74, y - s * 0.04, s * 0.2, C::Num, a, s * 0.1, 0.0);
    cv.rect(x + s * 0.08, y - s * 0.3, s * 0.54, s * 0.12, C::Bg, 0.35 * a);
}

/// A small label on the map, in the cell where bugs enter or leave.
fn tag(cv: &mut Canvas, col: i32, row: i32, label: &str, color: C) {
    let (x, y) = to_screen(cell_center(col, row));
    let w = text_w(label, 10.0) + 10.0;
    cv.rrect(x - w / 2.0, y - 8.0, w, 16.0, 4.0, C::Bg, 0.9);
    cv.frame(x - w / 2.0, y - 8.0, w, 16.0, 4.0, color, 0.9, 1.0);
    cv.text(label, x, y, 10.0, color, 1.0, Align::Center, true);
}

/// The icon of a tool, about `s` wide, centered on (x, y).
fn glyph(cv: &mut Canvas, kind: TowerKind, x: f32, y: f32, s: f32, a: f32, time: f32) {
    match kind {
        TowerKind::Linter => {
            cv.text("{}", x, y - s * 0.06, s * 0.42, C::Info, a, Align::Center, true);
            let (y0, w) = (y + s * 0.2, s * 0.14);
            for k in 0..4 {
                let x0 = x - s * 0.28 + k as f32 * w;
                let up = if k % 2 == 0 { -1.0 } else { 1.0 };
                cv.line(x0, y0 + up * 1.5, x0 + w, y0 - up * 1.5, C::Warn, a, 1.3);
            }
        }
        TowerKind::UnitTest => {
            let lw = s * 0.09;
            cv.line(x - s * 0.22, y, x - s * 0.06, y + s * 0.16, C::Success, a, lw);
            cv.line(x - s * 0.06, y + s * 0.16, x + s * 0.24, y - s * 0.18, C::Success, a, lw);
        }
        TowerKind::Breakpoint => {
            cv.circle(x, y, s * 0.22, C::Danger, a);
            cv.circle(x - s * 0.07, y - s * 0.07, s * 0.06, C::Text, 0.35 * a);
        }
        TowerKind::Review => {
            cv.text("PR", x, y, s * 0.4, C::Accent2, a, Align::Center, true);
        }
        TowerKind::Duck => {
            let bob = (time * 3.0).sin() * s * 0.03;
            duck(cv, x, y + bob, s * 0.5, a);
        }
        TowerKind::Ci => {
            cv.text("CI", x, y, s * 0.4, C::Accent, a, Align::Center, true);
            cv.line(x - s * 0.26, y + s * 0.22, x + s * 0.26, y + s * 0.22, C::Accent, 0.6 * a, 1.2);
        }
    }
}

fn duck(cv: &mut Canvas, x: f32, y: f32, s: f32, a: f32) {
    cv.circle(x - s * 0.1, y + s * 0.14, s * 0.4, C::Duck, a);
    cv.circle(x + s * 0.22, y - s * 0.26, s * 0.25, C::Duck, a);
    cv.rrect(x + s * 0.4, y - s * 0.28, s * 0.26, s * 0.12, s * 0.05, C::Beak, a);
    cv.circle(x + s * 0.28, y - s * 0.32, s * 0.055, C::Bg, a);
}

/// A bug: body, head, six wiggling legs and antennae, walking in `dir`.
#[allow(clippy::too_many_arguments)]
fn draw_bug(cv: &mut Canvas, kind: BugKind, x: f32, y: f32, r: f32, dir: (f32, f32), age: f32, a: f32) {
    let col = kind.color();
    let (dx, dy) = dir;
    let (px, py) = (-dy, dx);
    let lw = (r * 0.16).max(1.2);
    if kind == BugKind::Spaghetti {
        // the noodles
        for k in 0..8 {
            let ang = k as f32 / 8.0 * TAU + age * 0.6;
            let mut prev = (x + ang.cos() * r * 0.5, y + ang.sin() * r * 0.5);
            for s in 1..=4 {
                let d = r * (0.5 + s as f32 * 0.3);
                let wig = (age * 4.0 + s as f32 + k as f32).sin() * 0.35;
                let p = (x + (ang + wig).cos() * d, y + (ang + wig).sin() * d);
                cv.line(prev.0, prev.1, p.0, p.1, C::Duck, a * 0.9, 2.5);
                prev = p;
            }
        }
    }
    for side in [-1.0, 1.0] {
        for k in 0..3 {
            let along = (k as f32 - 1.0) * r * 0.55;
            let wig = (age * 16.0 + k as f32 * 2.1 + side).sin() * r * 0.22;
            let (bx, by) = (x + dx * along, y + dy * along);
            let (ex, ey) = (bx + px * side * r * 1.45 + dx * wig, by + py * side * r * 1.45 + dy * wig);
            cv.line(bx, by, ex, ey, col, a * 0.9, lw);
        }
    }
    cv.circle(x - dx * r * 0.15, y - dy * r * 0.15, r, col, a);
    cv.line(x - dx * r * 0.9, y - dy * r * 0.9, x + dx * r * 0.4, y + dy * r * 0.4, C::Shade, a * 0.25, lw);
    let (hx, hy) = (x + dx * r * 0.95, y + dy * r * 0.95);
    cv.circle(hx, hy, r * 0.52, col, a);
    for side in [-1.0, 1.0] {
        cv.circle(hx + dx * r * 0.2 + px * side * r * 0.22, hy + dy * r * 0.2 + py * side * r * 0.22, r * 0.13, C::Bg, a);
        let (ax, ay) = (hx + dx * r * 0.35 + px * side * r * 0.2, hy + dy * r * 0.35 + py * side * r * 0.2);
        cv.line(ax, ay, ax + dx * r * 0.6 + px * side * r * 0.45, ay + dy * r * 0.6 + py * side * r * 0.45, col, a, 1.0);
    }
    if kind == BugKind::Spaghetti {
        for k in 0..3 {
            let ang = k as f32 * 2.1 + age;
            cv.circle(x + ang.cos() * r * 0.45, y + ang.sin() * r * 0.45, r * 0.2, C::Danger, a);
        }
    }
}

/* ---------- syntax highlighting ---------- */

const KEYWORDS: &[&str] = &[
    "import", "from", "export", "function", "const", "let", "return", "if", "else", "for", "while", "loop", "fn", "impl", "struct", "use",
    "mut", "self", "def", "global", "class", "public", "private", "static", "final", "new", "try", "catch", "throws", "package",
    "extends", "true", "false", "null", "None", "True", "False", "this", "in", "int", "boolean", "pub", "match",
];

/// Colors one line of code the way an editor would, roughly: comments, strings, numbers, keywords, calls, types.
pub fn highlight(line: &str) -> CodeLine {
    let chars: Vec<char> = line.chars().collect();
    let n = chars.len();
    let mut colors = vec![C::Text; n];
    let mut i = 0;
    while i < n {
        let c = chars[i];
        let comment = (c == '/' && chars.get(i + 1) == Some(&'/')) || (c == '#' && (i == 0 || chars[i - 1] == ' '));
        if comment {
            colors[i..].fill(C::Faint);
            break;
        }
        if c == '"' || c == '\'' || c == '`' {
            let end = (i + 1..n).find(|&k| chars[k] == c).unwrap_or(n - 1);
            colors[i..=end].fill(C::Str);
            i = end + 1;
        } else if c.is_ascii_digit() {
            let s = i;
            while i < n && (chars[i].is_ascii_alphanumeric() || chars[i] == '_' || chars[i] == '.') {
                i += 1;
            }
            colors[s..i].fill(C::Num);
        } else if c.is_alphabetic() || c == '_' || c == '@' {
            let s = i;
            i += 1;
            while i < n && (chars[i].is_alphanumeric() || chars[i] == '_') {
                i += 1;
            }
            let word: String = chars[s..i].iter().collect();
            let color = if KEYWORDS.contains(&word.as_str()) || c == '@' {
                C::Keyword
            } else if chars.get(i) == Some(&'(') {
                C::Func
            } else if c.is_uppercase() {
                C::Accent
            } else if chars.get(i) == Some(&':') && chars.get(i + 1) != Some(&':') {
                C::Func
            } else {
                C::Text
            };
            colors[s..i].fill(color);
        } else {
            colors[i] = C::Muted;
            i += 1;
        }
    }
    // spaces take the color of what comes before them, so a run of one color is one piece of text
    for k in 1..n {
        if chars[k] == ' ' {
            colors[k] = colors[k - 1];
        }
    }
    let mut spans = Vec::new();
    let mut start = 0;
    for k in 1..=n {
        if k == n || colors[k] != colors[start] {
            let piece: String = chars[start..k].iter().collect();
            let lead = piece.len() - piece.trim_start().len();
            let trimmed = piece.trim();
            if !trimmed.is_empty() {
                spans.push((start + lead, trimmed.to_string(), colors[start]));
            }
            start = k;
        }
    }
    spans
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn highlights_comments_strings_and_keywords() {
        let spans = highlight("  return 'Hello, ' + nme; // typo");
        assert_eq!(spans[0], (2, "return".to_string(), C::Keyword));
        assert!(spans.iter().any(|s| s.1 == "'Hello, '" && s.2 == C::Str));
        assert_eq!(spans.last().unwrap().2, C::Faint);
        assert!(highlight("").is_empty());
    }

    #[test]
    fn wraps_on_words() {
        assert_eq!(wrap("aa bb cc", 5), vec!["aa bb", "cc"]);
        assert_eq!(wrap("", 5), Vec::<String>::new());
    }

    #[test]
    fn levels_unlock_in_order_and_keyboard_starts_one() {
        let mut app = App::new(0, 1);
        app.key(2); // down
        app.key(5); // enter: level 2 is still locked
        assert_eq!(app.screen(), 0);
        app.key(1); // up
        app.key(5);
        assert_eq!(app.screen(), 1);
        app.key(7); // escape pauses
        assert_eq!(app.screen(), 2);
        app.key(25); // L: back to the levels
        assert_eq!(app.screen(), 0);
    }

    #[test]
    fn every_screen_draws_without_panicking() {
        let mut app = App::new(1, 7);
        app.frame(0.016);
        assert!(!app.canvas.cmds.is_empty());
        app.key(5);
        app.pointer_move(300.0, 300.0);
        app.key(11); // Linter
        app.frame(0.016);
        app.pointer_down(MAP_X + 3.5 * CELL, MAP_Y + 0.5 * CELL);
        app.key(6); // git push
        for _ in 0..600 {
            app.frame(0.05);
        }
        app.key(22); // P
        app.frame(0.016);
        assert_eq!(app.screen(), 2);
    }
}
