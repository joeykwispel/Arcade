"""Tests for the dungeon rules, with plain CPython: `python -m unittest discover -s py`."""

import json
import unittest

import dungeon
from dungeon import BOSS, FLOORS, TEXT, Game


def rooms(room):
    yield room
    for child in room.rooms.values():
        yield from rooms(child)


def play(seed):
    """A simple bot: explores every room, drinks and reads all loot, removes every process, then takes the stairs.
    Saves its sudo for the boss. Returns the finished game."""
    g = Game(seed)
    g.start()
    while not (g.dead or g.won):
        here = g.here
        for item in list(here.items):
            if item != "coffee.txt" or g.hp < g.max_hp - 8:
                g.run(f"cat {item}")
        while here.monsters and not g.dead:
            name = next(iter(here.monsters))
            if g.hp < 8 and "coffee.txt" in here.items:
                g.run("cat coffee.txt")
            g.run(f"sudo rm {name}" if name == BOSS else f"rm {name}")
            if name == BOSS and g.sudo == 0 and BOSS in here.monsters:
                return g  # out of sudo: stuck
        if g.dead:
            break
        if g.boss_dead:
            g.run("rm -rf /")
            break
        unseen = [n for n, r in here.rooms.items() if not r.seen and n != "stairs"]
        if unseen:
            g.run(f"cd {unseen[0]}")
        elif "stairs" in here.rooms and all(r.seen or r.name == "stairs" for r in rooms(g.root)):
            g.run("cd stairs")
        elif here.parent is not None:
            g.run("cd ..")
        else:
            # everything seen: walk to the stairs
            target = next(r for r in rooms(g.root) if r.name in ("stairs", "root"))
            path = []
            r = target.parent
            while r is not g.root:
                path.append(r.name)
                r = r.parent
            for name in reversed(path):
                g.run(f"cd {name}")
            g.run(f"cd {target.name}")
    return g


class TestWorld(unittest.TestCase):
    def test_every_floor_has_a_way_down_and_the_last_one_a_boss(self):
        for seed in range(50):
            g = Game(seed)
            for floor in range(1, FLOORS + 1):
                root = g._make_floor(floor)
                names = [r.name for r in rooms(root)]
                if floor < FLOORS:
                    self.assertEqual(names.count("stairs"), 1)
                    self.assertTrue(any("sudo.key" in r.items for r in rooms(root)), "a sudo key on every floor")
                else:
                    boss_rooms = [r for r in rooms(root) if BOSS in r.monsters]
                    self.assertEqual(len(boss_rooms), 1)
                    self.assertEqual(boss_rooms[0].name, "root")

    def test_both_languages_say_the_same_things(self):
        self.assertEqual(set(TEXT["en"]), set(TEXT["nl"]))
        self.assertEqual(len(TEXT["en"]["help"]), len(TEXT["nl"]["help"]))


class TestCommands(unittest.TestCase):
    def setUp(self):
        self.g = Game(1)
        self.g.start()

    def text(self, lines):
        return "\n".join("".join(t for t, _ in line) for line in lines)

    def test_unknown_commands_and_files(self):
        self.assertIn("command not found", self.text(self.g.run("vim")))
        self.assertIn("No such file", self.text(self.g.run("cd nowhere")))
        self.assertIn("No such file", self.text(self.g.run("rm nothing.proc")))

    def test_cd_and_back(self):
        start = self.g.here
        child = next(iter(start.rooms))
        self.g.run(f"cd {child}")
        self.assertEqual(self.g.here.parent, start)
        # (processes may hit you on the way out; a fresh game has full hp to spare)
        self.g.run("cd ..")
        self.assertIs(self.g.here, start)
        self.assertIn("top", self.text(self.g.run("cd ..")))

    def test_rm_hurts_a_process_and_it_hits_back(self):
        g = self.g
        room = g.here
        room.monsters["zombie.proc"] = dungeon.Monster("zombie.proc", 100, 3, "plain")
        g.rng.random = lambda: 0.9  # no misses
        g.run("rm zombie.proc")
        self.assertLess(room.monsters["zombie.proc"].hp, 100)
        self.assertEqual(g.hp, 17)

    def test_the_boss_only_dies_to_sudo(self):
        g = self.g
        g.here.monsters[BOSS] = dungeon.Monster(BOSS, 45, 0, "boss")
        g.run(f"rm {BOSS}")
        self.assertEqual(g.here.monsters[BOSS].hp, 45)
        self.assertIn("sudoers", self.text(g.run(f"sudo rm {BOSS}")))
        g.sudo = 3
        for _ in range(3):
            g.run(f"sudo rm {BOSS}")
        self.assertNotIn(BOSS, g.here.monsters)
        self.assertTrue(g.boss_dead)
        self.assertFalse(g.won)
        g.run("rm -rf /")
        self.assertTrue(g.won)

    def test_rm_rf_slash_is_refused_while_the_boss_lives(self):
        self.assertIn("dangerous", self.text(self.g.run("rm -rf /")))
        self.assertFalse(self.g.won)

    def test_items(self):
        g = self.g
        g.here.items += ["coffee.txt", "patch.diff", "firewall.conf", "sudo.key"]
        g.here.monsters.clear()
        g.hp = 5
        g.run("cat coffee.txt")
        self.assertEqual(g.hp, 13)
        g.run("cat patch.diff")
        g.run("cat firewall.conf")
        g.run("cat sudo.key")
        self.assertEqual((g.atk, g.defence, g.sudo), (4, 1, 1))
        self.assertEqual(g.here.items, [])

    def test_dying_ends_the_game_and_reboot_starts_over(self):
        g = self.g
        g.here.monsters["segfault.proc"] = dungeon.Monster("segfault.proc", 999, 99, "plain")
        g.rng.random = lambda: 0.9
        out = self.text(g.run("rm segfault.proc"))
        self.assertIn("core dumped", out)
        self.assertTrue(g.dead)
        self.assertIn("reboot", self.text(g.run("ls")))
        g.run("reboot")
        self.assertFalse(g.dead)
        self.assertEqual(g.hp, 20)

    def test_tab_completion(self):
        g = self.g
        g.here.monsters.clear()
        g.here.monsters["zombie.proc"] = dungeon.Monster("zombie.proc", 5, 1, "plain")
        self.assertEqual(g.complete("rm zo"), "rm zombie.proc ")
        self.assertEqual(g.complete("wh"), "whoami ")
        child = next(iter(g.here.rooms))
        self.assertEqual(g.complete("cd " + child[:-0 or None]), f"cd {child}/")

    def test_the_bridge_speaks_json(self):
        data = json.loads(dungeon.new_game(3, "nl"))
        self.assertEqual(data["state"]["floor"], 1)
        self.assertIn("kerker", json.dumps(data["lines"], ensure_ascii=False))
        data = json.loads(dungeon.command("whoami"))
        self.assertIn("verdieping", data["lines"][0][0][0])


class TestBalance(unittest.TestCase):
    def test_a_careful_player_can_win_and_the_dungeon_still_bites(self):
        games = [play(seed) for seed in range(200)]
        wins = sum(g.won for g in games)
        self.assertGreater(wins, 40, "winnable")
        self.assertLess(wins, 190, "not a walk in the park")
        self.assertTrue(all(g.dead or g.won or g.sudo == 0 for g in games))


if __name__ == "__main__":
    unittest.main()
