//! Bug Bash: a tower defense for developers, written in Rust and compiled to WebAssembly.
//!
//! This file is the whole boundary with the page: plain `extern "C"` functions, no wasm-bindgen, no crates.
//! The page (web/main.js) forwards input and each frame's time, then replays the draw list from memory.
//! Everything else (rules, levels, layout, text in both languages) happens in Rust.

pub mod data;
pub mod draw;
pub mod i18n;
pub mod sim;
pub mod ui;

use std::cell::RefCell;

thread_local! {
    static APP: RefCell<ui::App> = RefCell::new(ui::App::new(0, 1));
}

fn with<R>(f: impl FnOnce(&mut ui::App) -> R) -> R {
    APP.with(|app| f(&mut app.borrow_mut()))
}

/// Starts over on the level select. `lang`: 0 English, 1 Dutch. `seed` makes each visit a little different.
#[unsafe(no_mangle)]
pub extern "C" fn init(lang: u32, seed: u32) {
    with(|app| *app = ui::App::new(lang, seed));
}

#[unsafe(no_mangle)]
pub extern "C" fn set_lang(lang: u32) {
    with(|app| app.set_lang(lang));
}

/// Stars (0-3) saved from an earlier visit, one call per level.
#[unsafe(no_mangle)]
pub extern "C" fn load_stars(level: u32, stars: u32) {
    with(|app| app.load_stars(level as usize, stars as u8));
}

/// Advances the game by `dt` seconds and fills the draw list.
#[unsafe(no_mangle)]
pub extern "C" fn frame(dt: f32) {
    with(|app| app.frame(dt));
}

/// Pointer position in world units (960 × 600).
#[unsafe(no_mangle)]
pub extern "C" fn pointer_move(x: f32, y: f32) {
    with(|app| app.pointer_move(x, y));
}

#[unsafe(no_mangle)]
pub extern "C" fn pointer_down(x: f32, y: f32) {
    with(|app| app.pointer_down(x, y));
}

#[unsafe(no_mangle)]
pub extern "C" fn pointer_leave() {
    with(|app| app.pointer_leave());
}

/// A key press, as one of the small numbers in main.js's KEYS table.
#[unsafe(no_mangle)]
pub extern "C" fn key(code: u32) {
    with(|app| app.key(code));
}

/// The page lost focus.
#[unsafe(no_mangle)]
pub extern "C" fn blur() {
    with(|app| app.blur());
}

/* ---------- reading results back ---------- */

#[unsafe(no_mangle)]
pub extern "C" fn cmd_ptr() -> *const f32 {
    with(|app| app.canvas.cmds.as_ptr())
}

#[unsafe(no_mangle)]
pub extern "C" fn cmd_len() -> u32 {
    with(|app| app.canvas.cmds.len() as u32)
}

#[unsafe(no_mangle)]
pub extern "C" fn text_ptr() -> *const u8 {
    with(|app| app.canvas.text.as_ptr())
}

#[unsafe(no_mangle)]
pub extern "C" fn text_len() -> u32 {
    with(|app| app.canvas.text.len() as u32)
}

/// Comma-separated CSS color names, in the order of `draw::Color`.
#[unsafe(no_mangle)]
pub extern "C" fn color_names_ptr() -> *const u8 {
    draw::COLOR_NAMES.as_ptr()
}

#[unsafe(no_mangle)]
pub extern "C" fn color_names_len() -> u32 {
    draw::COLOR_NAMES.len() as u32
}

/// Something new for the screen reader, or length 0. The page reads it, then calls `announce_clear`.
#[unsafe(no_mangle)]
pub extern "C" fn announce_ptr() -> *const u8 {
    with(|app| app.announce.as_ptr())
}

#[unsafe(no_mangle)]
pub extern "C" fn announce_len() -> u32 {
    with(|app| app.announce.len() as u32)
}

#[unsafe(no_mangle)]
pub extern "C" fn announce_clear() {
    with(|app| app.announce.clear());
}

/// 1 when the stars changed and should be saved; reading it resets it.
#[unsafe(no_mangle)]
pub extern "C" fn take_save() -> u32 {
    with(|app| std::mem::take(&mut app.save_pending) as u32)
}

#[unsafe(no_mangle)]
pub extern "C" fn stars(level: u32) -> u32 {
    with(|app| app.stars.get(level as usize).copied().unwrap_or(0) as u32)
}

/// 0 level select, 1 playing, 2 paused, 3 won, 4 lost.
#[unsafe(no_mangle)]
pub extern "C" fn screen() -> u32 {
    with(|app| app.screen())
}

/// 1 when the pointer is over something clickable.
#[unsafe(no_mangle)]
pub extern "C" fn pointer_cursor() -> u32 {
    with(|app| app.pointer_cursor as u32)
}
