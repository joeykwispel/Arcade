package standup

import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.sin
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

private const val DT = 1.0 / 30

/** Plays a whole day with a simple strategy and returns the game. `move` gives the input for each step. */
private fun day(seed: Long, pick: (Game) -> Int = { 0 }, move: (Game) -> Input = { Input() }): Game {
    val g = Game(seed)
    g.start()
    var steps = 0
    while (g.phase != Phase.OVER && g.phase != Phase.WON && steps++ < 20 * 60 * 30) {
        if (g.phase == Phase.LEVEL_UP) g.choose(pick(g))
        g.update(DT, move(g))
    }
    return g
}

/** Walks away from the crowd, and picks up commits when it's safe: the classic way to survive these games. */
private fun kite(g: Game): Input {
    val near = g.enemies.filter { hypot(it.x - g.x, it.y - g.y) < 140 }
    if (near.isNotEmpty()) {
        val cx = near.sumOf { it.x } / near.size
        val cy = near.sumOf { it.y } / near.size
        val away = atan2(g.y - cy, g.x - cx)
        return Input(cos(away + 0.6), sin(away + 0.6))
    }
    // nothing close: go and collect the nearest commit, like a player would
    val gem = g.pickups.minByOrNull { hypot(it.x - g.x, it.y - g.y) }
    if (gem != null && hypot(gem.x - g.x, gem.y - g.y) < 400) return Input(gem.x - g.x, gem.y - g.y)
    val a = g.time * 0.35
    return Input(cos(a), sin(a))
}

/** Prefers upgrading weapons it already has, then new weapons, then passives. */
private fun smartPick(g: Game): Int {
    val c = g.choices
    if (c.isEmpty()) return 0
    val best = c.withIndex().maxBy { (_, u) -> (if (u.weapon) 20 else 0) + g.lvl(u) * 3 + if (u == Upgrade.STANDING_DESK) 10 else 0 }
    return best.index
}

class GameTest {
    @Test
    fun clockRunsFromNineToFive() {
        assertEquals("09:00", Schedule.clock(0.0))
        assertEquals("12:00", Schedule.clock(Schedule.ALL_HANDS))
        assertEquals("17:00", Schedule.clock(Schedule.DAY + 30))
    }

    @Test
    fun nothingMovesBeforeStart() {
        val g = Game(3)
        g.update(1.0, Input(1.0, 0.0))
        assertEquals(0.0, g.time)
        assertEquals(0.0, g.x)
    }

    @Test
    fun levelUpOffersThreeDifferentUpgradesAndAppliesTheChoice() {
        val g = Game(5)
        g.start()
        g.xp = g.xpToNext()
        g.update(DT, Input())
        assertEquals(Phase.LEVEL_UP, g.phase)
        assertEquals(3, g.choices.toSet().size)
        val pick = g.choices[1]
        val before = g.lvl(pick)
        g.choose(1)
        assertEquals(before + 1, g.lvl(pick))
        assertEquals(Phase.PLAYING, g.phase)
    }

    @Test
    fun aTicketFallsApartIntoSubtasks() {
        val g = Game(7)
        g.start()
        g.spawnAround(EnemyKind.TICKET, 300.0, 0.0)
        val t = g.enemies.single()
        g.damage(t, 999.0)
        g.update(DT, Input())
        assertEquals(2, g.enemies.count { it.kind == EnemyKind.SUBTASK })
    }

    @Test
    fun theAllHandsMeetingStartsAtNoonAndTheReorgAtFour() {
        val g = Game(11)
        g.start()
        g.focus = 1e9 // this test is about the schedule, not about surviving it
        val bosses = { g.events.filterIsInstance<Event.Boss>().map { it.kind } }
        g.time = Schedule.ALL_HANDS - 0.5
        g.update(0.4, Input())
        assertEquals(emptyList(), bosses())
        g.update(0.2, Input())
        assertEquals(listOf(EnemyKind.ALL_HANDS), bosses())
        assertEquals(1, g.enemies.count { it.kind.boss })
        g.time = Schedule.REORG
        g.update(DT, Input())
        assertEquals(listOf(EnemyKind.ALL_HANDS, EnemyKind.REORG), bosses())
    }

    @Test
    fun standingStillGetsYouPulledIntoMeetings() {
        for (seed in 1L..3L) {
            val g = day(seed)
            assertEquals(Phase.OVER, g.phase, "seed $seed survived without moving")
            assertTrue(g.time < Schedule.ALL_HANDS, "seed $seed lasted until ${Schedule.clock(g.time)} standing still")
        }
    }

    @Test
    fun kitingWithGoodUpgradesMakesItToFive() {
        val results = (1L..6L).map { day(it, ::smartPick, ::kite) }
        for (g in results) println("kite: ${g.phase} at ${Schedule.clock(g.time)}, level ${g.level}, ${g.squashed} squashed")
        assertTrue(results.count { it.phase == Phase.WON } >= 3, "the kiting bot should win at least half the days")
        assertTrue(results.count { it.time >= Schedule.ALL_HANDS } >= 4, "the kiting bot should usually reach the all-hands")
        // and it stays a fight: nobody maxes out everything long before five
        assertTrue(results.all { it.level <= 40 }, "levels run away: ${results.map { it.level }}")
    }
}
