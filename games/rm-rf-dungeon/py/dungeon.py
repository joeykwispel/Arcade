"""rm -rf dungeon: a roguelike where the dungeon is a filesystem.

The rules only: no browser in here. The page (web/main.js) runs this file in Pyodide and calls `Game.run(line)` for
every command; the tests run it with plain CPython.

Output is a list of lines, each a list of (text, kind) pieces. The kind tells the terminal how to show a piece, and
which pieces are tappable: "dir" (cd into it), "monster" (rm it), "item" (cat it).
"""

import json
import random

FLOORS = 5
ROOM_NAMES = [
    "bin", "etc", "tmp", "var", "lib", "usr", "opt", "srv", "home", "dev", "mnt", "boot",
    "log", "cache", "src", "build", "dist", "node_modules", "backup", "cron.d",
]

# name: (hp, attack, what it does). hp and attack grow with the floor.
MONSTERS = {
    "zombie.proc": (6, 2, "plain"),
    "segfault.proc": (4, 4, "plain"),
    "memory_leak.proc": (8, 1, "leak"),
    "fork_bomb.proc": (5, 2, "fork"),
    "race_condition.proc": (6, 3, "race"),
    "cronjob.proc": (9, 2, "plain"),
}
BOSS = "root_daemon.proc"
ITEMS = ["coffee.txt", "coffee.txt", "patch.diff", "firewall.conf", "backup.tar"]

TEXT = {
    "en": {
        "welcome": "Welcome to the dungeon. Find the stairs, and on floor {floors}, root_daemon.proc.",
        "hint": "Type help, or tap a name. Tab completes.",
        "help": [
            ("ls", "look around"),
            ("cd <dir>", "go into a room (cd .. goes back)"),
            ("cat <file>", "use an item, or read about a process"),
            ("rm <file>", "attack a process"),
            ("rm -rf *", "hit every process here, at half strength"),
            ("sudo rm <file>", "a huge hit; costs one sudo"),
            ("whoami", "your stats"),
            ("tree", "the rooms you've seen on this floor"),
            ("reboot", "start over"),
        ],
        "not_found": "bash: {cmd}: command not found",
        "no_dir": "cd: {name}: No such file or directory",
        "no_file": "{cmd}: cannot access '{name}': No such file or directory",
        "is_dir": "{cmd}: {name}: Is a directory",
        "not_dir": "cd: {name}: Not a directory",
        "empty": "(empty)",
        "enter": "You enter {path}",
        "stairs": "You take the stairs down to floor {floor}. A fresh shell: hp {hp}/{hp}.",
        "top": "cd: you're already at the top of this floor",
        "fled": "{name} hits you as you leave: -{dmg} hp",
        "hit": "rm: {name}: -{dmg} hp",
        "sudo_hit": "sudo rm: {name}: -{dmg} hp",
        "removed": "removed '{name}'",
        "missed": "rm: {name}: race lost, it moved first",
        "denied": "rm: cannot remove '{name}': Permission denied (try sudo)",
        "no_sudo": "sudo: you are not in the sudoers file. This incident will be reported. (0 sudo left)",
        "forked": "{name} forks: {child} appears",
        "leaks": "{name} leaks: its attack is now {atk}",
        "attacks": "{name} attacks: -{dmg} hp",
        "blocked": "{name} attacks, but the firewall blocks it",
        "no_targets": "rm: nothing to remove here",
        "coffee": "You drink the coffee: +{hp} hp",
        "patch": "You apply the patch: attack +1 (now {atk})",
        "firewall": "You load the firewall rules: defence +1 (now {defence})",
        "backup": "You restore the backup: hp back to {hp}",
        "sudo_key": "You add yourself to sudoers: +1 sudo (now {sudo})",
        "about": "{name}: {hp} hp, attack {atk}. {what}",
        "what_plain": "A stuck process.",
        "what_leak": "Its attack grows every turn. Don't wait.",
        "what_fork": "Hit it and it may fork a copy.",
        "what_race": "Sometimes it moves before your rm lands.",
        "what_boss": "Runs as root. Only sudo rm touches it.",
        "stats": "hp {hp}/{max} · attack {atk} · defence {defence} · sudo {sudo} · floor {floor}/{floors} · removed {kills}",
        "dead": "Segmentation fault (core dumped). You died on floor {floor}.",
        "boss_dead": "root_daemon.proc is gone. You are root now. Finish it: rm -rf /",
        "nice_try": "rm: it is dangerous to operate recursively on '/' (root_daemon.proc is still running)",
        "won": "rm -rf / ... done. The dungeon is gone. You won in {turns} turns.",
        "over": "Game over. Type reboot to play again.",
        "score": "score {score}",
    },
    "nl": {
        "welcome": "Welkom in de kerker. Vind de trap, en op verdieping {floors}: root_daemon.proc.",
        "hint": "Typ help, of tik op een naam. Tab vult aan.",
        "help": [
            ("ls", "kijk rond"),
            ("cd <map>", "ga een kamer in (cd .. gaat terug)"),
            ("cat <bestand>", "gebruik een item, of lees over een proces"),
            ("rm <bestand>", "val een proces aan"),
            ("rm -rf *", "raak elk proces hier, met halve kracht"),
            ("sudo rm <bestand>", "een enorme klap; kost één sudo"),
            ("whoami", "je stats"),
            ("tree", "de kamers die je op deze verdieping zag"),
            ("reboot", "begin opnieuw"),
        ],
        "not_found": "bash: {cmd}: opdracht niet gevonden",
        "no_dir": "cd: {name}: Bestand of map bestaat niet",
        "no_file": "{cmd}: kan '{name}' niet openen: Bestand of map bestaat niet",
        "is_dir": "{cmd}: {name}: Is een map",
        "not_dir": "cd: {name}: Geen map",
        "empty": "(leeg)",
        "enter": "Je loopt {path} binnen",
        "stairs": "Je neemt de trap naar verdieping {floor}. Een verse shell: hp {hp}/{hp}.",
        "top": "cd: je bent al bovenaan deze verdieping",
        "fled": "{name} raakt je als je weggaat: -{dmg} hp",
        "hit": "rm: {name}: -{dmg} hp",
        "sudo_hit": "sudo rm: {name}: -{dmg} hp",
        "removed": "'{name}' verwijderd",
        "missed": "rm: {name}: race verloren, hij was eerst",
        "denied": "rm: kan '{name}' niet verwijderen: Toegang geweigerd (probeer sudo)",
        "no_sudo": "sudo: je staat niet in het sudoers-bestand. Dit incident wordt gemeld. (0 sudo over)",
        "forked": "{name} forkt: {child} verschijnt",
        "leaks": "{name} lekt: zijn aanval is nu {atk}",
        "attacks": "{name} valt aan: -{dmg} hp",
        "blocked": "{name} valt aan, maar de firewall houdt het tegen",
        "no_targets": "rm: niets te verwijderen hier",
        "coffee": "Je drinkt de koffie: +{hp} hp",
        "patch": "Je past de patch toe: aanval +1 (nu {atk})",
        "firewall": "Je laadt de firewallregels: verdediging +1 (nu {defence})",
        "backup": "Je zet de backup terug: hp weer {hp}",
        "sudo_key": "Je zet jezelf in sudoers: +1 sudo (nu {sudo})",
        "about": "{name}: {hp} hp, aanval {atk}. {what}",
        "what_plain": "Een vastgelopen proces.",
        "what_leak": "Zijn aanval groeit elke beurt. Wacht niet te lang.",
        "what_fork": "Raak hem en hij forkt misschien een kopie.",
        "what_race": "Soms is hij sneller dan je rm.",
        "what_boss": "Draait als root. Alleen sudo rm doet hem iets.",
        "stats": "hp {hp}/{max} · aanval {atk} · verdediging {defence} · sudo {sudo} · verdieping {floor}/{floors} · verwijderd {kills}",
        "dead": "Segmentation fault (core dumped). Je stierf op verdieping {floor}.",
        "boss_dead": "root_daemon.proc is weg. Je bent nu root. Maak het af: rm -rf /",
        "nice_try": "rm: recursief werken op '/' is gevaarlijk (root_daemon.proc draait nog)",
        "won": "rm -rf / ... klaar. De kerker is weg. Gewonnen in {turns} beurten.",
        "over": "Game over. Typ reboot om opnieuw te spelen.",
        "score": "score {score}",
    },
}


class Monster:
    def __init__(self, name, hp, atk, what):
        self.name, self.hp, self.atk, self.what = name, hp, atk, what


class Room:
    def __init__(self, name, parent=None):
        self.name = name
        self.parent = parent
        self.rooms = {}  # name -> Room
        self.monsters = {}  # name -> Monster
        self.items = []  # file names
        self.seen = False

    @property
    def path(self):
        return (self.parent.path if self.parent else "") + "/" + self.name


class Game:
    def __init__(self, seed=None, lang="en"):
        self.rng = random.Random(seed)
        self.lang = lang
        self.hp = self.max_hp = 20
        self.atk = 3
        self.defence = 0
        self.sudo = 0
        self.floor = 1
        self.kills = 0
        self.turns = 0
        self.boss_dead = False
        self.dead = False
        self.won = False
        self.root = self.here = self._make_floor(1)
        self.here.seen = True

    # ---------- the world ----------

    def _make_floor(self, floor):
        """A random tree of rooms. The deepest one holds the stairs, or on the last floor, the boss's room."""
        names = self.rng.sample(ROOM_NAMES, 3 + floor)
        root = Room(f"floor{floor}")
        rooms = [root]
        for name in names:
            parent = self.rng.choice(rooms)
            room = Room(name, parent)
            parent.rooms[name] = room
            rooms.append(room)

        def depth(r):
            return 0 if r.parent is None else 1 + depth(r.parent)

        deepest = max(rooms[1:], key=depth)
        last = floor == FLOORS
        end = Room("root" if last else "stairs", deepest)
        deepest.rooms[end.name] = end
        if last:
            end.monsters[BOSS] = Monster(BOSS, 45, 4, "boss")

        # processes in most rooms, stronger further down
        for room in rooms[1:]:
            # (the first floor is gentler: at most one per room)
            for _ in range(self.rng.choice([0, 1, 1] if floor == 1 else [0, 1, 1, 2])):
                name = self.rng.choice(list(MONSTERS))
                hp, atk, what = MONSTERS[name]
                name = self._free_name(room, name)
                room.monsters[name] = Monster(name, hp + 2 * (floor - 1), atk + (floor - 1) // 2, what)
        # loot: a sudo key on every floor before the last, and a couple of other things
        places = rooms[1:]
        if not last:
            self.rng.choice(places).items.append("sudo.key")
        for item in self.rng.sample(ITEMS, 2):
            self.rng.choice(places).items.append(item)
        return root

    @staticmethod
    def _free_name(room, name):
        """zombie.proc, then zombie(1).proc, zombie(2).proc, … so names in a room are unique."""
        if name not in room.monsters:
            return name
        stem, ext = name.rsplit(".", 1)
        n = 1
        while f"{stem}({n}).{ext}" in room.monsters:
            n += 1
        return f"{stem}({n}).{ext}"

    # ---------- output ----------

    def t(self, key, **kw):
        return TEXT[self.lang][key].format(floors=FLOORS, **kw)

    def _ls(self):
        r = self.here
        pieces = []
        for name in sorted(r.rooms):
            pieces += [(name + "/", "dir"), ("  ", "")]
        for name, m in r.monsters.items():
            pieces += [(name, "boss" if m.what == "boss" else "monster"), (f"({m.hp})", "dim"), ("  ", "")]
        for name in r.items:
            pieces += [(name, "item"), ("  ", "")]
        if not pieces:
            return [[(self.t("empty"), "dim")]]
        return [pieces[:-1]]

    def state(self):
        return {
            "hp": self.hp,
            "max": self.max_hp,
            "sudo": self.sudo,
            "floor": self.floor,
            "floors": FLOORS,
            "cwd": self.here.path,
            "kills": self.kills,
            "turns": self.turns,
            "score": self.score,
            "over": self.dead or self.won,
            "won": self.won,
        }

    @property
    def score(self):
        return self.kills * 10 + (self.floor - 1) * 50 + (500 - min(self.turns, 400) if self.won else 0)

    # ---------- commands ----------

    def start(self):
        return [[(self.t("welcome"), "ok")], [(self.t("hint"), "dim")], *self._ls()]

    def run(self, line):
        """Run one command line. Returns the output lines."""
        words = line.split()
        if not words:
            return []
        cmd, args = words[0], words[1:]
        if cmd == "reboot":
            self.__init__(lang=self.lang)
            return self.start()
        if self.dead or self.won:
            return [[(self.t("over"), "dim")]]
        if cmd == "help":
            return [[(c.ljust(18), "ok"), (d, "")] for c, d in TEXT[self.lang]["help"]]
        if cmd == "ls":
            return self._ls()
        if cmd == "pwd":
            return [[(self.here.path, "")]]
        if cmd in ("whoami", "stat"):
            return [[(self.t("stats", hp=self.hp, max=self.max_hp, atk=self.atk, defence=self.defence,
                             sudo=self.sudo, floor=self.floor, kills=self.kills), "")]]
        if cmd == "tree":
            return self._tree(self.root, "")
        if cmd == "cd":
            return self._cd(args[0] if args else "..")
        if cmd == "cat":
            if not args:
                return [[(self.t("no_file", cmd="cat", name=""), "err")]]
            return self._cat(args[0])
        if cmd == "rm":
            if args[:1] == ["-rf"]:
                return self._rm_rf(args[1:])
            names = [a for a in args if not a.startswith("-")]
            if not names:
                return [[(self.t("no_targets"), "err")]]
            return self._rm(names[0], sudo=False)
        if cmd == "sudo":
            if args[:1] == ["rm"] and len(args) > 1:
                names = [a for a in args[1:] if not a.startswith("-")]
                if args[1:2] == ["-rf"] and args[2:3] == ["/"]:
                    return self._rm_rf(["/"])
                if names:
                    return self._rm(names[0], sudo=True)
            return [[(self.t("not_found", cmd=" ".join(words)), "err")]]
        return [[(self.t("not_found", cmd=cmd), "err")]]

    def _tree(self, room, indent):
        mark = "  <" if room is self.here else ""
        # "path", not "dir": these aren't all reachable from here, so they aren't tappable
        lines = [[(indent, ""), (room.name + "/", "path" if room.seen else "dim"), (mark, "ok")]]
        if room.seen:
            for child in room.rooms.values():
                lines += self._tree(child, indent + "  ")
        return lines

    def _cd(self, name):
        name = name.rstrip("/")
        out = []
        if name == "..":
            if self.here.parent is None:
                return [[(self.t("top"), "err")]]
            target = self.here.parent
        elif name in self.here.rooms:
            target = self.here.rooms[name]
        elif name in self.here.monsters or name in self.here.items:
            return [[(self.t("not_dir", name=name), "err")]]
        else:
            return [[(self.t("no_dir", name=name), "err")]]
        # running past processes costs a hit from each
        for m in list(self.here.monsters.values()):
            dmg = self._damage_from(m)
            if dmg:
                self.hp -= dmg
                out.append([(self.t("fled", name=m.name, dmg=dmg), "err")])
        self.turns += 1
        if self._check_dead(out):
            return out
        if target.name == "stairs" and target.parent is self.here:
            self.floor += 1
            # a fresh shell on every floor: more memory, and all of it free
            self.max_hp += 4
            self.hp = self.max_hp
            self.root = self.here = self._make_floor(self.floor)
            self.here.seen = True
            out.append([(self.t("stairs", floor=self.floor, hp=self.max_hp), "ok")])
            return out + self._ls()
        self.here = target
        target.seen = True
        out.append([(self.t("enter", path=target.path), "dim")])
        return out + self._ls()

    def _cat(self, name):
        r = self.here
        if name in r.rooms:
            return [[(self.t("is_dir", cmd="cat", name=name), "err")]]
        if name in r.monsters:
            m = r.monsters[name]
            return [[(self.t("about", name=name, hp=m.hp, atk=m.atk, what=self.t("what_" + m.what)), "")]]
        if name not in r.items:
            return [[(self.t("no_file", cmd="cat", name=name), "err")]]
        r.items.remove(name)
        if name == "coffee.txt":
            gain = min(8, self.max_hp - self.hp)
            self.hp += gain
            out = [[(self.t("coffee", hp=gain), "ok")]]
        elif name == "patch.diff":
            self.atk += 1
            out = [[(self.t("patch", atk=self.atk), "ok")]]
        elif name == "firewall.conf":
            self.defence += 1
            out = [[(self.t("firewall", defence=self.defence), "ok")]]
        elif name == "backup.tar":
            self.hp = self.max_hp
            out = [[(self.t("backup", hp=self.hp), "ok")]]
        else:  # sudo.key
            self.sudo += 1
            out = [[(self.t("sudo_key", sudo=self.sudo), "ok")]]
        return out + self._monsters_turn()

    def _rm(self, name, sudo):
        r = self.here
        if name in r.rooms:
            return [[(self.t("is_dir", cmd="rm", name=name), "err")]]
        if name not in r.monsters:
            if name in r.items:
                # deleting loot is allowed, and a waste
                r.items.remove(name)
                return [[(self.t("removed", name=name), "dim")]]
            return [[(self.t("no_file", cmd="rm", name=name), "err")]]
        m = r.monsters[name]
        out = []
        if sudo:
            if self.sudo <= 0:
                return [[(self.t("no_sudo"), "err")]]
            self.sudo -= 1
            dmg = 15 + self.atk
            m.hp -= dmg
            out.append([(self.t("sudo_hit", name=name, dmg=dmg), "ok")])
        elif m.what == "boss":
            out.append([(self.t("denied", name=name), "err")])
        elif m.what == "race" and self.rng.random() < 0.35:
            out.append([(self.t("missed", name=name), "err")])
        else:
            dmg = self.atk + self.rng.randint(0, 2)
            m.hp -= dmg
            out.append([(self.t("hit", name=name, dmg=dmg), "")])
            if m.what == "fork" and m.hp > 0 and self._count("fork") < 4 and self.rng.random() < 0.5:
                child = self._free_name(r, "fork_bomb.proc")
                r.monsters[child] = Monster(child, max(2, m.hp), m.atk, "fork")
                out.append([(self.t("forked", name=name, child=child), "err")])
        out += self._remove_dead()
        return out + self._monsters_turn()

    def _rm_rf(self, args):
        if args[:1] == ["/"]:
            if not self.boss_dead:
                return [[(self.t("nice_try"), "err")]]
            self.won = True
            self.turns += 1
            return [[(self.t("won", turns=self.turns), "ok")], [(self.t("score", score=self.score), "ok")]]
        targets = [m for m in self.here.monsters.values() if m.what != "boss"]
        if not targets:
            return [[(self.t("no_targets"), "err")]]
        out = []
        for m in targets:
            dmg = (self.atk + 1) // 2 + self.rng.randint(0, 1)
            m.hp -= dmg
            out.append([(self.t("hit", name=m.name, dmg=dmg), "")])
        out += self._remove_dead()
        return out + self._monsters_turn()

    def _count(self, what):
        return sum(1 for m in self.here.monsters.values() if m.what == what)

    def _remove_dead(self):
        out = []
        for name, m in list(self.here.monsters.items()):
            if m.hp <= 0:
                del self.here.monsters[name]
                self.kills += 1
                # removing a process frees memory: a little hp back
                gain = min(2, self.max_hp - self.hp)
                self.hp += gain
                out.append([(self.t("removed", name=name), "ok"), (f"  +{gain} hp" if gain else "", "dim")])
                if m.what == "boss":
                    self.boss_dead = True
                    out.append([(self.t("boss_dead"), "boss")])
        return out

    def _damage_from(self, m):
        if self.rng.random() < 0.2:
            return 0  # timed out
        return max(0, m.atk - self.defence)

    def _monsters_turn(self):
        """After every action, each process in the room gets its turn."""
        self.turns += 1
        out = []
        for m in list(self.here.monsters.values()):
            if m.what == "leak":
                m.atk += 1
                out.append([(self.t("leaks", name=m.name, atk=m.atk), "dim")])
            dmg = self._damage_from(m)
            if dmg > 0:
                self.hp -= dmg
                out.append([(self.t("attacks", name=m.name, dmg=dmg), "err")])
            elif self.defence and m.atk <= self.defence:
                out.append([(self.t("blocked", name=m.name), "dim")])
        self._check_dead(out)
        return out

    def _check_dead(self, out):
        if self.hp > 0:
            return False
        self.hp = 0
        self.dead = True
        out.append([(self.t("dead", floor=self.floor), "boss")])
        out.append([(self.t("score", score=self.score), "dim")])
        return True

    # ---------- for the terminal ----------

    def complete(self, line):
        """Tab completion: the names in this room that fit the last word."""
        words = line.split(" ")
        last = words[-1]
        if len(words) == 1:
            options = ["cat", "cd", "help", "ls", "pwd", "reboot", "rm", "sudo", "tree", "whoami"]
        elif words[0] == "cd":
            options = [n + "/" for n in self.here.rooms] + [".."]
        else:
            options = list(self.here.monsters) + self.here.items
        matches = sorted(o for o in options if o.startswith(last))
        if len(matches) != 1:
            return line
        return " ".join(words[:-1] + [matches[0]]) + ("" if matches[0].endswith("/") else " ")


# ---------- the bridge for web/main.js (everything as JSON strings) ----------

_game = None


def new_game(seed, lang):
    global _game
    _game = Game(seed, lang)
    return json.dumps({"lines": _game.start(), "state": _game.state()})


def command(line):
    lines = _game.run(line)
    return json.dumps({"lines": lines, "state": _game.state()})


def set_lang(lang):
    _game.lang = lang


def complete(line):
    return _game.complete(line)
