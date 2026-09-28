package standup

import kotlin.math.PI
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin
import kotlin.math.sqrt

/** Deterministic random numbers (xorshift), so tests can replay a day. */
class Rng(seed: Long) {
    private var s = if (seed == 0L) 0x2545F4914F6CDD1DL else seed

    fun next(): Double {
        s = s xor (s shl 13)
        s = s xor (s ushr 7)
        s = s xor (s shl 17)
        return ((s ushr 11).toDouble() / (1L shl 53).toDouble())
    }

    fun range(a: Double, b: Double) = a + (b - a) * next()
    fun int(n: Int) = (next() * n).toInt().coerceAtMost(n - 1)
    fun <T> pick(list: List<T>) = list[int(list.size)]
}

enum class Phase { READY, PLAYING, LEVEL_UP, PAUSED, OVER, WON }

class Enemy(
    val kind: EnemyKind,
    var x: Double,
    var y: Double,
    var hp: Double,
) {
    val maxHp = hp
    var radius = kind.radius
    var age = 0.0
    var hit = 0.0
    var alive = true
    /** per-weapon cooldown so ducks and auras don't hit every frame */
    var touchedAt = -9.0
    var spawnTimer = 0.0
    var knockX = 0.0
    var knockY = 0.0
    val phase = (x * 13.0 + y * 7.0) % (2 * PI)
}

class Shot(var x: Double, var y: Double, val dx: Double, val dy: Double, val dmg: Double, var pierce: Int, val glyph: Char) {
    var life = 1.4
    val hitIds = mutableSetOf<Enemy>()
}

enum class PickupKind { COMMIT, COFFEE, MAGNET }

class Pickup(val kind: PickupKind, var x: Double, var y: Double, val value: Int) {
    var pulled = false
}

sealed class Fx(var x: Double, var y: Double, val dur: Double) {
    var t = 0.0

    class Text(x: Double, y: Double, val text: String, val strong: Boolean) : Fx(x, y, 0.8)
    class Ring(x: Double, y: Double, val radius: Double) : Fx(x, y, 0.45)
    class Beam(x: Double, y: Double, val dx: Double, val dy: Double, val length: Double, val width: Double) : Fx(x, y, 0.25)
    class Pop(x: Double, y: Double, val kind: EnemyKind) : Fx(x, y, 0.35)
}

/** What happened, for the page (sound-free announcements and the screen reader). */
sealed class Event {
    data class LevelUp(val level: Int) : Event()
    data class Boss(val kind: EnemyKind) : Event()
    data class Surge(val kind: EnemyKind) : Event()
    data object Over : Event()
    data object Won : Event()
}

class Input(var dx: Double = 0.0, var dy: Double = 0.0)

/** Seconds you can't be hit again after a hit. */
const val HURT_TIME = 0.5

/** Focus you get back per second on your own. */
const val FOCUS_REGEN = 1.0

/** More than this on the map at once and new ones wait: keeps the frame rate up. */
const val MAX_ENEMIES = 360

class Game(seed: Long = 1L) {
    val rng = Rng(seed)
    var phase = Phase.READY
    var time = 0.0

    // the player
    var x = 0.0
    var y = 0.0
    var faceX = 1.0
    var faceY = 0.0
    var focus = 100.0
    var hurt = 0.0
    var level = 1
    var xp = 0
    var squashed = 0

    val owned = LinkedHashMap<Upgrade, Int>().apply { put(Upgrade.KEYBOARD, 1) }
    var choices: List<Upgrade> = emptyList()

    val enemies = ArrayList<Enemy>()
    val shots = ArrayList<Shot>()
    val pickups = ArrayList<Pickup>()
    val fx = ArrayList<Fx>()
    val events = ArrayList<Event>()

    /** distance at which new enemies appear, set by the page from the size of the view */
    var spawnRadius = 420.0

    private val cooldowns = HashMap<Upgrade, Double>()
    /** enemies born during a step (boss minions, subtasks); they join after it, not while the list is being walked */
    private val born = ArrayList<Enemy>()
    private var spawnDebt = 0.0
    private var surgeIndex = 0
    private var bossesSpawned = 0

    /* ---------- stats from passives ---------- */

    fun lvl(u: Upgrade) = owned[u] ?: 0
    val maxFocus get() = 100.0 + 20.0 * lvl(Upgrade.STANDING_DESK)
    val speed get() = 150.0 * (1 + 0.1 * lvl(Upgrade.COFFEE))
    val cooldownMult get() = 1 - 0.08 * lvl(Upgrade.FOCUS_MODE)
    val damageMult get() = 1 + 0.15 * lvl(Upgrade.PAIRING)
    val magnet get() = 100.0 * (1 + 0.4 * lvl(Upgrade.DND))
    fun xpToNext() = 5 + (level - 1) * 7 + (level - 1) * (level - 1) / 3

    /* ---------- flow ---------- */

    fun start() {
        if (phase == Phase.READY) phase = Phase.PLAYING
    }

    fun togglePause() {
        phase = when (phase) {
            Phase.PLAYING -> Phase.PAUSED
            Phase.PAUSED -> Phase.PLAYING
            else -> phase
        }
    }

    /** Picks one of the offered upgrades (0-2). */
    fun choose(i: Int) {
        if (phase != Phase.LEVEL_UP) return
        val pick = choices.getOrNull(i)
        if (pick == null) {
            // nothing left to upgrade: a snack instead
            focus = min(maxFocus, focus + 30)
        } else {
            owned[pick] = lvl(pick) + 1
            if (pick == Upgrade.STANDING_DESK) focus = min(maxFocus, focus + 20)
        }
        choices = emptyList()
        phase = Phase.PLAYING
        // two level ups in a row (a big pickup) come one after the other
        checkLevelUp()
    }

    private fun checkLevelUp() {
        if (xp < xpToNext()) return
        xp -= xpToNext()
        level++
        val open = Upgrade.entries.filter { lvl(it) < Upgrade.MAX && (lvl(it) > 0 || owned.count { e -> e.key.weapon == it.weapon } < 4) }
        choices = open.shuffled(rng).take(3)
        phase = Phase.LEVEL_UP
        events += Event.LevelUp(level)
    }

    /* ---------- the loop ---------- */

    fun update(dt: Double, input: Input) {
        for (f in fx) f.t += dt
        fx.removeAll { it.t >= it.dur }
        if (phase != Phase.PLAYING) return
        time += dt
        hurt = max(0.0, hurt - dt)
        // a deep breath now and then: early mistakes can be recovered from
        focus = min(maxFocus, focus + FOCUS_REGEN * dt)

        movePlayer(dt, input)
        spawn(dt)
        moveEnemies(dt)
        weapons(dt)
        moveShots(dt)
        collect(dt)
        enemies.removeAll { !it.alive }
        // everything counts toward the cap, boss minions and subtasks too
        enemies += born.take(max(0, MAX_ENEMIES - enemies.size))
        born.clear()

        if (focus <= 0) {
            focus = 0.0
            phase = Phase.OVER
            events += Event.Over
        } else if (time >= Schedule.DAY) {
            time = Schedule.DAY
            phase = Phase.WON
            events += Event.Won
        }
    }

    private fun movePlayer(dt: Double, input: Input) {
        val len = hypot(input.dx, input.dy)
        if (len > 0.01) {
            val k = min(1.0, len)
            x += input.dx / len * speed * k * dt
            y += input.dy / len * speed * k * dt
            faceX = input.dx / len
            faceY = input.dy / len
        }
    }

    private fun spawn(dt: Double) {
        // the steady stream, faster as the day goes on
        val kinds = Schedule.stream.filter { it.first <= time }.map { it.second }
        spawnDebt += dt * (1.1 + time / 32.0)
        while (spawnDebt >= 1 && enemies.size < MAX_ENEMIES) {
            spawnDebt -= 1
            spawnAround(rng.pick(kinds), spawnRadius + rng.range(0.0, 80.0), rng.range(0.0, 2 * PI))
        }
        // surges
        while (surgeIndex < Schedule.surges.size && Schedule.surges[surgeIndex].first <= time) {
            val (_, kind, count) = Schedule.surges[surgeIndex++]
            for (i in 0 until count) spawnAround(kind, spawnRadius * 0.85, i * 2 * PI / count)
            events += Event.Surge(kind)
        }
        // bosses
        if (bossesSpawned == 0 && time >= Schedule.ALL_HANDS) boss(EnemyKind.ALL_HANDS)
        if (bossesSpawned == 1 && time >= Schedule.REORG) boss(EnemyKind.REORG)
    }

    private fun boss(kind: EnemyKind) {
        bossesSpawned++
        spawnAround(kind, spawnRadius, rng.range(0.0, 2 * PI))
        events += Event.Boss(kind)
    }

    private fun hpMult() = 1 + time / 90.0

    fun spawnAround(kind: EnemyKind, dist: Double, angle: Double) {
        val hp = kind.hp * if (kind.boss) 1.0 else hpMult()
        enemies += Enemy(kind, x + cos(angle) * dist, y + sin(angle) * dist, hp)
    }

    private fun moveEnemies(dt: Double) {
        val grid = Grid(enemies)
        for (e in enemies) {
            e.age += dt
            e.hit = max(0.0, e.hit - dt)
            var dx = x - e.x
            var dy = y - e.y
            val d = max(1e-6, hypot(dx, dy))
            dx /= d
            dy /= d
            var sp = e.kind.speed
            when (e.kind) {
                // zig-zag in from the side, like a DM you didn't ask for
                EnemyKind.RECRUITER -> {
                    val w = sin(e.age * 5 + e.phase) * 0.9
                    val (px, py) = -dy to dx
                    dx += px * w
                    dy += py * w
                }
                // "just a quick one": speeds up when it gets close
                EnemyKind.QUESTION -> if (d < 160) sp *= 1.6
                // scope creep grows the longer it lives
                EnemyKind.SCOPE -> e.radius = min(34.0, e.kind.radius + e.age * 1.2)
                EnemyKind.ALL_HANDS, EnemyKind.REORG -> {
                    e.spawnTimer += dt
                    if (e.spawnTimer > 3.5) {
                        e.spawnTimer = 0.0
                        val minion = if (e.kind == EnemyKind.ALL_HANDS) EnemyKind.PING else EnemyKind.INVITE
                        for (i in 0 until 6) {
                            val a = i * PI / 3 + e.age
                            born.add(Enemy(minion, e.x + cos(a) * e.radius, e.y + sin(a) * e.radius, minion.hp * hpMult()))
                        }
                    }
                }
                else -> {}
            }
            // keep a little distance from each other, so a swarm reads as a swarm
            var sx = 0.0
            var sy = 0.0
            for (o in grid.near(e.x, e.y)) {
                if (o === e) continue
                val ox = e.x - o.x
                val oy = e.y - o.y
                val gap = e.radius + o.radius
                val dd = ox * ox + oy * oy
                if (dd in 1e-6..gap * gap) {
                    val dl = sqrt(dd)
                    sx += ox / dl * (gap - dl)
                    sy += oy / dl * (gap - dl)
                }
            }
            e.x += (dx * sp + e.knockX) * dt + sx * 0.5 * dt * 10
            e.y += (dy * sp + e.knockY) * dt + sy * 0.5 * dt * 10
            e.knockX *= 0.9
            e.knockY *= 0.9
            // touching you costs focus; then you get half a second to get away
            if (d < e.radius + 12 && hurt <= 0) {
                // one hit costs what the old per-second drain did over the safe time: a crowd can't stack up
                val hit = e.kind.dps * HURT_TIME
                focus -= hit
                hurt = HURT_TIME
                fx += Fx.Text(x, y - 34, "-${hit.toInt()}", true)
            }
        }
    }

    private fun ready(u: Upgrade, dt: Double, every: Double): Boolean {
        val c = (cooldowns[u] ?: 0.0) - dt
        if (c > 0) {
            cooldowns[u] = c
            return false
        }
        cooldowns[u] = every * cooldownMult
        return true
    }

    private fun weapons(dt: Double) {
        val dmg = damageMult
        lvl(Upgrade.KEYBOARD).takeIf { it > 0 }?.let { l ->
            if (ready(Upgrade.KEYBOARD, dt, 0.62 - 0.06 * l)) {
                // only what's in reach, so squashed things drop their commits where you can get them
                val targets = enemies.filter { it.alive && hypot(it.x - x, it.y - y) < 300 }
                    .sortedBy { hypot(it.x - x, it.y - y) }.take(listOf(1, 1, 2, 2, 3)[l - 1])
                for (t in targets) {
                    val a = atan2(t.y - y, t.x - x)
                    shots += Shot(x, y, cos(a) * 400, sin(a) * 400, (10.0 + 3 * l) * dmg, if (l >= 4) 2 else 1, "{};<>/=()".random(rng))
                }
            }
        }
        lvl(Upgrade.HEADPHONES).takeIf { it > 0 }?.let { l ->
            if (ready(Upgrade.HEADPHONES, dt, 0.25)) {
                val r = 55.0 + 12 * l
                for (e in enemies) if (e.alive && hypot(e.x - x, e.y - y) < r + e.radius) damage(e, (3.0 + 1.5 * l) * dmg, quiet = true)
            }
        }
        lvl(Upgrade.DUCKS).takeIf { it > 0 }?.let { l ->
            val n = listOf(1, 2, 2, 3, 4)[l - 1]
            for (i in 0 until n) {
                val (dx, dy) = duckOffset(i, n)
                for (e in enemies) {
                    if (e.alive && time - e.touchedAt > 0.45 && hypot(e.x - (x + dx), e.y - (y + dy)) < e.radius + 11) {
                        e.touchedAt = time
                        damage(e, (14.0 + 4 * l) * dmg)
                    }
                }
            }
        }
        lvl(Upgrade.DECLINE).takeIf { it > 0 }?.let { l ->
            if (ready(Upgrade.DECLINE, dt, 5.0 - 0.5 * l)) {
                val r = 140.0 + 20 * l
                fx += Fx.Ring(x, y, r)
                fx += Fx.Text(x, y - 30, "declined", true)
                for (e in enemies) {
                    val d = hypot(e.x - x, e.y - y)
                    if (e.alive && d < r) {
                        damage(e, (25.0 + 10 * l) * dmg)
                        if (!e.kind.boss) {
                            e.knockX = (e.x - x) / max(d, 1.0) * 420
                            e.knockY = (e.y - y) / max(d, 1.0) * 420
                        }
                    }
                }
            }
        }
        lvl(Upgrade.FORCE_PUSH).takeIf { it > 0 }?.let { l ->
            if (ready(Upgrade.FORCE_PUSH, dt, 2.2 - 0.15 * l)) {
                val len = 340.0
                val w = 16.0 + 4 * l
                fx += Fx.Beam(x, y, faceX, faceY, len, w)
                for (e in enemies) {
                    if (!e.alive) continue
                    val rx = e.x - x
                    val ry = e.y - y
                    val along = rx * faceX + ry * faceY
                    val across = kotlin.math.abs(rx * faceY - ry * faceX)
                    if (along in 0.0..len && across < w / 2 + e.radius) damage(e, (30.0 + 12 * l) * dmg)
                }
            }
        }
    }

    /** Where duck `i` of `n` orbits, relative to you. */
    fun duckOffset(i: Int, n: Int): Pair<Double, Double> {
        val a = time * 3.0 + i * 2 * PI / n
        return cos(a) * 72 to sin(a) * 72
    }

    private fun moveShots(dt: Double) {
        val grid = Grid(enemies)
        for (s in shots) {
            s.x += s.dx * dt
            s.y += s.dy * dt
            s.life -= dt
            for (e in grid.near(s.x, s.y)) {
                if (!e.alive || e in s.hitIds || hypot(e.x - s.x, e.y - s.y) > e.radius + 5) continue
                s.hitIds += e
                damage(e, s.dmg)
                if (--s.pierce <= 0) {
                    s.life = 0.0
                    break
                }
            }
        }
        shots.removeAll { it.life <= 0 }
    }

    fun damage(e: Enemy, amount: Double, quiet: Boolean = false) {
        if (!e.alive) return
        e.hp -= amount
        e.hit = 0.1
        if (!quiet || e.hp <= 0) fx += Fx.Text(e.x, e.y - e.radius, amount.toInt().toString(), false)
        if (e.hp > 0) return
        e.alive = false
        squashed++
        fx += Fx.Pop(e.x, e.y, e.kind)
        pickups += Pickup(PickupKind.COMMIT, e.x, e.y, e.kind.xp)
        val roll = rng.next()
        if (e.kind.boss || roll < 0.015) pickups += Pickup(PickupKind.COFFEE, e.x + 14, e.y, 0)
        else if (roll < 0.02) pickups += Pickup(PickupKind.MAGNET, e.x - 14, e.y, 0)
        // a ticket falls apart into subtasks
        if (e.kind == EnemyKind.TICKET) {
            for (i in 0 until 2) born.add(Enemy(EnemyKind.SUBTASK, e.x + (i * 2 - 1) * 10, e.y, EnemyKind.SUBTASK.hp * hpMult()))
        }
    }

    private fun collect(dt: Double) {
        for (p in pickups) {
            val d = hypot(p.x - x, p.y - y)
            if (d < magnet || p.pulled) p.pulled = true
            if (p.pulled) {
                val sp = max(260.0, 900 - d) * dt
                p.x += (x - p.x) / max(d, 1.0) * min(sp, d)
                p.y += (y - p.y) / max(d, 1.0) * min(sp, d)
            }
            if (d < 16) {
                when (p.kind) {
                    PickupKind.COMMIT -> xp += p.value
                    PickupKind.COFFEE -> {
                        focus = min(maxFocus, focus + 35)
                        fx += Fx.Text(x, y - 28, "+35 focus", true)
                    }
                    PickupKind.MAGNET -> for (o in pickups) o.pulled = true
                }
                p.x = Double.NaN
            }
        }
        pickups.removeAll { it.x.isNaN() }
        if (pickups.size > 500) pickups.subList(0, pickups.size - 500).clear()
        checkLevelUp()
    }
}

/** A coarse spatial hash, so collisions only look at nearby enemies. */
private class Grid(items: List<Enemy>) {
    private val cells = HashMap<Long, MutableList<Enemy>>()

    init {
        for (e in items) if (e.alive) cells.getOrPut(key(e.x, e.y)) { ArrayList() }.add(e)
    }

    private fun cell(v: Double) = floor(v / SIZE).toLong()
    private fun key(x: Double, y: Double) = key(cell(x), cell(y))
    private fun key(cx: Long, cy: Long) = (cx shl 32) xor (cy and 0xffffffffL)

    fun near(x: Double, y: Double): Sequence<Enemy> = sequence {
        val cx = cell(x)
        val cy = cell(y)
        for (i in -1L..1L) for (j in -1L..1L) cells[key(cx + i, cy + j)]?.let { yieldAll(it) }
    }

    companion object {
        const val SIZE = 64.0
    }
}

private fun String.random(rng: Rng) = this[rng.int(length)]

private fun <T> List<T>.shuffled(rng: Rng): List<T> {
    val out = toMutableList()
    for (i in out.indices.reversed()) {
        val j = rng.int(i + 1)
        val t = out[i]
        out[i] = out[j]
        out[j] = t
    }
    return out
}
