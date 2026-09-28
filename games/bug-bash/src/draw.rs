//! The draw list. Rust decides everything that goes on screen; web/main.js only replays these commands on a
//! 2D canvas, in world units (960 × 600), with the colors of the current theme.
//!
//! Each command is an opcode followed by a fixed number of f32 arguments (the page decodes the same layout).
//! Text is UTF-8 in a separate byte buffer; a text command points into it with an offset and a length.

/// Theme colors by meaning. The page maps each one to the CSS custom property `--c-<name>` from [`COLOR_NAMES`].
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
#[repr(u8)]
pub enum Color {
    Bg,
    Panel,
    Raised,
    Border,
    Text,
    Muted,
    Faint,
    Accent,
    Accent2,
    Keyword,
    Str,
    Num,
    Func,
    Path,
    Danger,
    Warn,
    Success,
    Info,
    Duck,
    Beak,
    Status,
    OnStatus,
    Shade,
}

/// The CSS name of every [`Color`], in declaration order. main.js reads this list, so the two never drift apart.
pub const COLOR_NAMES: &str =
    "bg,panel,raised,border,text,muted,faint,accent,accent2,keyword,str,num,func,path,danger,warn,success,info,duck,beak,status,on-status,shade";

/// JetBrains Mono advances 0.6 em per character, so text width is known without asking the browser.
pub const CHAR_W: f32 = 0.6;

pub fn text_w(s: &str, size: f32) -> f32 {
    s.chars().count() as f32 * size * CHAR_W
}

#[derive(Clone, Copy)]
pub enum Align {
    Left,
    Center,
    Right,
}

#[derive(Default)]
pub struct Canvas {
    pub cmds: Vec<f32>,
    pub text: Vec<u8>,
}

impl Canvas {
    pub fn clear(&mut self) {
        self.cmds.clear();
        self.text.clear();
    }

    fn push(&mut self, op: f32, args: &[f32]) {
        self.cmds.push(op);
        self.cmds.extend_from_slice(args);
    }

    /// 1: filled rectangle
    pub fn rect(&mut self, x: f32, y: f32, w: f32, h: f32, c: Color, a: f32) {
        self.push(1.0, &[x, y, w, h, c as u8 as f32, a]);
    }

    /// 2: filled rounded rectangle
    pub fn rrect(&mut self, x: f32, y: f32, w: f32, h: f32, r: f32, c: Color, a: f32) {
        self.push(2.0, &[x, y, w, h, r, c as u8 as f32, a]);
    }

    /// 3: outlined rounded rectangle
    #[allow(clippy::too_many_arguments)]
    pub fn frame(&mut self, x: f32, y: f32, w: f32, h: f32, r: f32, c: Color, a: f32, lw: f32) {
        self.push(3.0, &[x, y, w, h, r, c as u8 as f32, a, lw]);
    }

    /// 4: filled circle
    pub fn circle(&mut self, x: f32, y: f32, r: f32, c: Color, a: f32) {
        self.push(4.0, &[x, y, r, c as u8 as f32, a]);
    }

    /// 5: circle outline, dashed when `dash` > 0
    #[allow(clippy::too_many_arguments)]
    pub fn ring(&mut self, x: f32, y: f32, r: f32, c: Color, a: f32, lw: f32, dash: f32) {
        self.push(5.0, &[x, y, r, c as u8 as f32, a, lw, dash]);
    }

    /// 6: line with round caps
    #[allow(clippy::too_many_arguments)]
    pub fn line(&mut self, x1: f32, y1: f32, x2: f32, y2: f32, c: Color, a: f32, lw: f32) {
        self.push(6.0, &[x1, y1, x2, y2, c as u8 as f32, a, lw]);
    }

    /// 7: one line of text, vertically centered on `y`
    #[allow(clippy::too_many_arguments)]
    pub fn text(&mut self, s: &str, x: f32, y: f32, size: f32, c: Color, a: f32, align: Align, bold: bool) {
        let offset = self.text.len();
        self.text.extend_from_slice(s.as_bytes());
        let align = match align {
            Align::Left => 0.0,
            Align::Center => 1.0,
            Align::Right => 2.0,
        };
        let bold = if bold { 1.0 } else { 0.0 };
        self.push(7.0, &[x, y, size, c as u8 as f32, a, align, bold, offset as f32, s.len() as f32]);
    }

    /// 8: clip everything after this to a rectangle, until [`Canvas::unclip`]
    pub fn clip(&mut self, x: f32, y: f32, w: f32, h: f32) {
        self.push(8.0, &[x, y, w, h]);
    }

    /// 9: end the last clip
    pub fn unclip(&mut self) {
        self.push(9.0, &[]);
    }
}
