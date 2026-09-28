//! The game's content: the tools you build, the bugs you fight and the five levels. Numbers and text, no logic.

use crate::draw::Color;

/// The map is a grid of cells; every cell is two lines of code tall.
pub const COLS: i32 = 18;
pub const ROWS: i32 = 12;
pub const CELL: f32 = 40.0;

/* ---------- towers ---------- */

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum TowerKind {
    Linter,
    UnitTest,
    Breakpoint,
    Review,
    Duck,
    Ci,
}

impl TowerKind {
    pub const ALL: [TowerKind; 6] = [
        TowerKind::Linter,
        TowerKind::UnitTest,
        TowerKind::Breakpoint,
        TowerKind::Review,
        TowerKind::Duck,
        TowerKind::Ci,
    ];

    fn i(self) -> usize {
        self as usize
    }

    pub fn name(self) -> &'static str {
        ["Linter", "Unit Test", "Breakpoint", "Code Review", "Rubber Duck", "CI Pipeline"][self.i()]
    }

    pub fn cost(self) -> u32 {
        [50, 90, 70, 120, 100, 160][self.i()]
    }

    /// Reach in cells. Every upgrade adds a bit.
    pub fn range(self, level: u8) -> f32 {
        [2.5, 3.5, 2.0, 2.6, 2.0, 3.0][self.i()] + 0.4 * level as f32
    }

    /// Damage per hit, before the Rubber Duck buff and bug armor.
    pub fn damage(self, level: u8) -> f32 {
        [4.0, 24.0, 2.0, 10.0, 0.0, 12.0][self.i()] * [1.0, 1.6, 2.4][level as usize]
    }

    /// Seconds between two shots.
    pub fn interval(self, level: u8) -> f32 {
        [0.35, 1.2, 0.6, 1.1, 0.0, 1.4][self.i()] * [1.0, 0.85, 0.72][level as usize]
    }

    /// Coffee for the next version, or None at v3.0.
    pub fn upgrade_cost(self, level: u8) -> Option<u32> {
        let factor = match level {
            0 => 0.8,
            1 => 1.3,
            _ => return None,
        };
        Some(((self.cost() as f32 * factor / 5.0).round() * 5.0) as u32)
    }

    /// Breakpoint: speed factor of a bug inside the pulse.
    pub fn slow(self, level: u8) -> f32 {
        [0.55, 0.45, 0.35][level as usize]
    }

    /// Rubber Duck: damage multiplier for the tools around it.
    pub fn buff(self, level: u8) -> f32 {
        1.25 + 0.1 * level as f32
    }

    /// CI Pipeline: how many bugs one run jumps through.
    pub fn chain(self, level: u8) -> usize {
        3 + level as usize
    }

    /// Code Review: radius of the splash, in map units.
    pub fn splash(self, level: u8) -> f32 {
        (0.9 + 0.15 * level as f32) * CELL
    }

    pub fn color(self) -> Color {
        [Color::Info, Color::Success, Color::Danger, Color::Accent2, Color::Duck, Color::Accent][self.i()]
    }
}

/* ---------- bugs ---------- */

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum BugKind {
    Typo,
    NullPointer,
    MemoryLeak,
    RaceCondition,
    Heisenbug,
    LegacyCode,
    Spaghetti,
}

pub struct BugStats {
    pub hp: f32,
    /// cells per second
    pub speed: f32,
    /// coffee for squashing it
    pub reward: u32,
    /// uptime lost when it reaches production
    pub leak: i32,
    pub radius: f32,
    /// flat damage reduction per hit (a hit always does at least 1)
    pub armor: f32,
}

impl BugKind {
    pub const ALL: [BugKind; 7] = [
        BugKind::Typo,
        BugKind::NullPointer,
        BugKind::MemoryLeak,
        BugKind::RaceCondition,
        BugKind::Heisenbug,
        BugKind::LegacyCode,
        BugKind::Spaghetti,
    ];

    pub fn index(self) -> usize {
        self as usize
    }

    pub fn name(self) -> &'static str {
        ["Typo", "NullPointer", "Memory Leak", "Race Condition", "Heisenbug", "Legacy Code", "Spaghetti Code"][self.index()]
    }

    pub fn stats(self) -> BugStats {
        let (hp, speed, reward, leak, radius, armor) = match self {
            BugKind::Typo => (12.0, 1.9, 3, 2, 6.0, 0.0),
            BugKind::NullPointer => (30.0, 1.2, 5, 4, 8.0, 0.0),
            BugKind::MemoryLeak => (45.0, 0.9, 9, 6, 8.0, 0.0),
            BugKind::RaceCondition => (22.0, 2.6, 7, 5, 7.0, 0.0),
            BugKind::Heisenbug => (45.0, 1.3, 10, 6, 8.0, 0.0),
            BugKind::LegacyCode => (220.0, 0.6, 20, 12, 12.0, 3.0),
            BugKind::Spaghetti => (2400.0, 0.42, 150, 60, 17.0, 2.0),
        };
        BugStats { hp, speed, reward, leak, radius, armor }
    }

    pub fn color(self) -> Color {
        [Color::Warn, Color::Danger, Color::Keyword, Color::Info, Color::Accent, Color::Num, Color::Duck][self.index()]
    }
}

/* ---------- levels ---------- */

/// `count` bugs of one kind, `gap` seconds apart.
pub struct Group {
    pub kind: BugKind,
    pub count: u16,
    pub gap: f32,
}

const fn g(kind: BugKind, count: u16, gap: f32) -> Group {
    Group { kind, count, gap }
}

use BugKind::{Heisenbug as H, LegacyCode as L, MemoryLeak as M, NullPointer as N, RaceCondition as R, Spaghetti as S, Typo as T};

pub struct Level {
    pub file: &'static str,
    /// coffee at the start
    pub coffee: u32,
    /// multiplies the hit points of every bug in this level
    pub hp_mult: f32,
    /// Waypoints in cells. A point just outside the grid is where bugs enter or leave. Bugs alternate between paths.
    pub paths: &'static [&'static [(i8, i8)]],
    /// One entry per sprint
    pub waves: &'static [&'static [Group]],
    /// The bugs this level introduces, shown on the level select
    pub new_bugs: &'static [BugKind],
    /// The code the map is drawn on, one line per half cell
    pub code: &'static [&'static str],
}

pub static LEVELS: [Level; 5] = [
    Level {
        file: "hello-world.js",
        coffee: 150,
        hp_mult: 1.0,
        paths: &[&[(-1, 2), (5, 2), (5, 8), (12, 8), (12, 4), (18, 4)]],
        waves: &[
            &[g(T, 8, 0.9)],
            &[g(T, 6, 0.8), g(N, 4, 1.2)],
            &[g(N, 10, 1.0)],
            &[g(T, 14, 0.5), g(N, 6, 1.0)],
            &[g(N, 12, 0.8), g(T, 12, 0.4)],
        ],
        new_bugs: &[T, N],
        code: &[
            "// hello-world.js: your very first project. What could possibly go wrong?",
            "import { greet } from './greet.js';",
            "",
            "const DEFAULT_NAME = 'world';",
            "",
            "function main(args) {",
            "  const name = args[0] ?? DEFAULT_NAME;",
            "  const message = greet(name);",
            "  console.log(message);",
            "  return 0;",
            "}",
            "",
            "// TODO: write tests (later)",
            "// FIXME: sometimes prints \"Hello, undefined\"",
            "export function greet(name) {",
            "  if (name = '') {",
            "    return 'Hello, nobody';",
            "  }",
            "  return 'Hello, ' + nme + '!';",
            "}",
            "",
            "main(process.argv.slice(2));",
            "",
            "// works on my machine",
        ],
    },
    Level {
        file: "side-project.rs",
        coffee: 180,
        hp_mult: 1.3,
        paths: &[&[(-1, 1), (3, 1), (3, 9), (8, 9), (8, 3), (13, 3), (13, 10), (18, 10)]],
        waves: &[
            &[g(T, 10, 0.7)],
            &[g(N, 10, 0.9)],
            &[g(M, 3, 2.5), g(T, 8, 0.5)],
            &[g(N, 12, 0.7), g(M, 3, 2.0)],
            &[g(T, 20, 0.35), g(M, 4, 1.8)],
            &[g(N, 16, 0.6), g(M, 5, 1.5)],
            &[g(M, 8, 1.2), g(N, 14, 0.5), g(T, 16, 0.3)],
        ],
        new_bugs: &[M],
        code: &[
            "// side-project.rs: just a weekend thing. Week 37.",
            "use std::collections::HashMap;",
            "",
            "struct Cache {",
            "    items: HashMap<String, Vec<u8>>,",
            "    hits: u64,",
            "}",
            "",
            "impl Cache {",
            "    fn get(&mut self, key: &str) -> Option<&Vec<u8>> {",
            "        self.hits += 1;",
            "        self.items.get(key)",
            "    }",
            "",
            "    fn put(&mut self, key: String, value: Vec<u8>) {",
            "        // never evicts anything. it is fine. it is a side project.",
            "        self.items.insert(key, value);",
            "    }",
            "}",
            "",
            "fn main() {",
            "    let mut cache = Cache { items: HashMap::new(), hits: 0 };",
            "    loop { cache.put(uuid(), vec![0; 1024]); }",
            "}",
        ],
    },
    Level {
        file: "startup-mvp.py",
        coffee: 220,
        hp_mult: 1.4,
        paths: &[
            &[(-1, 2), (6, 2), (6, 6), (11, 6), (11, 2), (15, 2), (15, 9), (18, 9)],
            &[(-1, 10), (6, 10), (6, 6), (11, 6), (11, 2), (15, 2), (15, 9), (18, 9)],
        ],
        waves: &[
            &[g(N, 10, 0.8)],
            &[g(T, 16, 0.4)],
            &[g(M, 5, 1.6), g(N, 8, 0.7)],
            &[g(R, 8, 0.9)],
            &[g(N, 16, 0.5), g(R, 8, 0.8)],
            &[g(M, 8, 1.2), g(T, 20, 0.3)],
            &[g(R, 14, 0.6), g(M, 5, 1.4)],
            &[g(N, 24, 0.4), g(R, 12, 0.5)],
            &[g(M, 10, 1.0), g(R, 16, 0.45), g(N, 20, 0.35)],
        ],
        new_bugs: &[R],
        code: &[
            "# startup-mvp.py: ship it today, fix it after the Series A",
            "import threading",
            "from db import connect",
            "",
            "balance = 0",
            "lock = None  # TODO: add a lock before launch",
            "",
            "def deposit(amount):",
            "    global balance",
            "    current = balance",
            "    time.sleep(0.01)  # \"simulate\" the network",
            "    balance = current + amount",
            "",
            "def handle(request):",
            "    user = request.json.get(\"user\")",
            "    if user[\"plan\"] == \"free\":",
            "        return upsell(user)",
            "    threading.Thread(target=deposit, args=(request.amount,)).start()",
            "    return {\"ok\": True, \"balance\": balance}",
            "",
            "# <<<<<<< HEAD",
            "MAX_USERS = 100",
            "# =======",
            "MAX_USERS = 10_000_000  # >>>>>>> feature/hypergrowth",
        ],
    },
    Level {
        file: "EnterpriseMonolith.java",
        coffee: 280,
        hp_mult: 1.35,
        paths: &[&[(-1, 1), (15, 1), (15, 4), (2, 4), (2, 7), (15, 7), (15, 10), (18, 10)]],
        waves: &[
            &[g(N, 12, 0.7)],
            &[g(T, 20, 0.35), g(N, 6, 0.8)],
            &[g(L, 2, 4.0), g(N, 8, 0.6)],
            &[g(M, 8, 1.2), g(R, 6, 0.8)],
            &[g(L, 4, 3.0), g(T, 20, 0.3)],
            &[g(H, 6, 1.2), g(N, 10, 0.6)],
            &[g(R, 16, 0.5), g(H, 6, 1.0)],
            &[g(L, 6, 2.5), g(M, 8, 1.0)],
            &[g(H, 12, 0.8), g(R, 12, 0.5)],
            &[g(N, 30, 0.3), g(L, 6, 2.0)],
            &[g(M, 12, 0.8), g(H, 12, 0.7), g(R, 16, 0.4)],
            &[g(L, 10, 1.6), g(H, 14, 0.6), g(R, 20, 0.35)],
        ],
        new_bugs: &[L, H],
        code: &[
            "// EnterpriseMonolith.java: 1.2 million lines, 3 people understand it (2 retired)",
            "package com.enterprise.core.legacy.v2.final.final2;",
            "",
            "public class AbstractSingletonProxyFactoryBean extends BaseFactoryImpl {",
            "    private static final int MAGIC = 42; // do not change. nobody knows why.",
            "",
            "    @Deprecated(since = \"2009\")",
            "    public Object process(Object input) throws Exception {",
            "        try {",
            "            Object result = this.getManager().getHandler().handle(input);",
            "            if (result == null) {",
            "                return process(input); // retry forever",
            "            }",
            "            return result;",
            "        } catch (Exception e) {",
            "            // TODO: handle exception (added in 2011)",
            "        }",
            "        return null;",
            "    }",
            "",
            "    public boolean isWorking() {",
            "        return System.currentTimeMillis() % 2 == 0; // mostly",
            "    }",
            "}",
        ],
    },
    Level {
        file: "friday-deploy.yml",
        coffee: 320,
        hp_mult: 1.8,
        paths: &[
            &[(-1, 1), (8, 1), (8, 5), (13, 5), (13, 1), (16, 1), (16, 10), (18, 10)],
            &[(3, 12), (3, 9), (8, 9), (8, 5), (13, 5), (13, 1), (16, 1), (16, 10), (18, 10)],
        ],
        waves: &[
            &[g(N, 14, 0.6)],
            &[g(T, 24, 0.3), g(R, 6, 0.8)],
            &[g(M, 8, 1.0), g(N, 10, 0.5)],
            &[g(L, 4, 2.5), g(R, 10, 0.6)],
            &[g(H, 10, 0.9), g(T, 20, 0.3)],
            &[g(M, 12, 0.8), g(L, 4, 2.0)],
            &[g(R, 24, 0.4), g(H, 8, 0.8)],
            &[g(L, 8, 1.8), g(N, 24, 0.35)],
            &[g(H, 16, 0.6), g(M, 10, 0.8)],
            &[g(R, 30, 0.3), g(L, 6, 1.6)],
            &[g(M, 16, 0.6), g(H, 16, 0.5)],
            &[g(L, 12, 1.4), g(R, 24, 0.35)],
            &[g(H, 20, 0.5), g(M, 14, 0.6), g(T, 40, 0.2)],
            &[g(L, 16, 1.1), g(R, 30, 0.3), g(H, 20, 0.45)],
            &[g(N, 20, 0.4), g(S, 1, 0.0), g(L, 8, 1.5), g(R, 20, 0.4)],
        ],
        new_bugs: &[S],
        code: &[
            "# friday-deploy.yml: Friday, 16:55. Everyone else went home.",
            "name: deploy-to-production",
            "on:",
            "  push:",
            "    branches: [main]",
            "",
            "jobs:",
            "  deploy:",
            "    runs-on: ubuntu-latest",
            "    steps:",
            "      - uses: actions/checkout@v4",
            "      - run: npm test || true   # tests are more of a suggestion",
            "      - run: ./migrate.sh --force --no-backup",
            "      - run: kubectl apply -f spaghetti/ --all-namespaces",
            "      - name: Notify the team",
            "        run: echo \"deployed. going home. phone off.\"",
            "        env:",
            "          ON_CALL: nobody",
            "          ROLLBACK_PLAN: \"pray\"",
            "",
            "# Monday: 47 unread messages",
            "",
            "",
            "",
        ],
    },
];
