package standup

import org.w3c.dom.CanvasRenderingContext2D
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sin

const val MONO = "'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace"

/** Theme colors from the CSS custom properties (--c-<name>), read again when the theme changes. */
class Colors(private val read: (String) -> String) {
    val bg = read("bg")
    val floor = read("floor")
    val grid = read("grid")
    val desk = read("desk")
    val text = read("text")
    val muted = read("muted")
    val accent = read("accent")
    val accent2 = read("accent2")
    val danger = read("danger")
    val warn = read("warn")
    val success = read("success")
    val info = read("info")
    val duck = read("duck")
    val beak = read("beak")
    val panel = read("panel")
    val shade = read("shade")
}

/** A clickable area on the canvas (level-up cards), in screen pixels. */
class Hit(val x: Double, val y: Double, val w: Double, val h: Double, val index: Int)

class Painter(private val ctx: CanvasRenderingContext2D) {
    lateinit var c: Colors
    var hits = listOf<Hit>()
    private val d get() = ctx.asDynamic()

    private fun font(size: Double, bold: Boolean = false) {
        ctx.font = "${if (bold) 700 else 500} ${size}px $MONO"
    }

    private fun text(s: String, x: Double, y: Double, size: Double, color: String, align: String = "center", bold: Boolean = false) {
        font(size, bold)
        d.textAlign = align
        d.textBaseline = "middle"
        ctx.fillStyle = color
        ctx.fillText(s, x, y)
    }

    private fun circle(x: Double, y: Double, r: Double, color: String) {
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(x, y, max(0.0, r), 0.0, 2 * PI)
        ctx.fill()
    }

    private fun ring(x: Double, y: Double, r: Double, color: String, w: Double) {
        ctx.strokeStyle = color
        ctx.lineWidth = w
        ctx.beginPath()
        ctx.arc(x, y, max(0.0, r), 0.0, 2 * PI)
        ctx.stroke()
    }

    private fun rrect(x: Double, y: Double, w: Double, h: Double, r: Double, color: String) {
        ctx.fillStyle = color
        ctx.beginPath()
        d.roundRect(x, y, w, h, r)
        ctx.fill()
    }

    private fun frame(x: Double, y: Double, w: Double, h: Double, r: Double, color: String, lw: Double) {
        ctx.strokeStyle = color
        ctx.lineWidth = lw
        ctx.beginPath()
        d.roundRect(x, y, w, h, r)
        ctx.stroke()
    }

    /**
     * Draws a frame. `w`/`h` are CSS pixels, `scale` is world units → CSS pixels, `dpr` the device pixel ratio.
     */
    fun frame(g: Game, t: Text, w: Double, h: Double, scale: Double, dpr: Double, stick: Stick?, banner: Pair<String, Double>?, best: Double) {
        ctx.setTransform(dpr, 0.0, 0.0, dpr, 0.0, 0.0)
        ctx.fillStyle = c.floor
        ctx.fillRect(0.0, 0.0, w, h)

        // the world, centered on you
        ctx.save()
        ctx.translate(w / 2, h / 2)
        ctx.scale(scale, scale)
        ctx.translate(-g.x, -g.y)
        val halfW = w / 2 / scale
        val halfH = h / 2 / scale
        office(g.x - halfW, g.y - halfH, g.x + halfW, g.y + halfH)
        auras(g)
        for (p in g.pickups) pickup(p, g.time)
        for (e in g.enemies) enemy(e, g.time)
        player(g)
        ducks(g)
        for (s in g.shots) text(s.glyph.toString(), s.x, s.y, 15.0, c.accent, bold = true)
        effects(g)
        ctx.restore()

        hud(g, t, w, h)
        stick?.let { joystick(it) }
        banner?.let { (msg, age) ->
            ctx.globalAlpha = min(1.0, (3.0 - age) * 2).coerceIn(0.0, 1.0)
            val bw = msg.length * 9.6 + 40
            rrect(w / 2 - bw / 2, 70.0, bw, 34.0, 17.0, c.danger)
            text(msg, w / 2, 87.0, 15.0, c.bg, bold = true)
            ctx.globalAlpha = 1.0
        }
        hits = emptyList()
        when (g.phase) {
            Phase.READY -> title(t, w, h, best)
            Phase.PAUSED -> dialog(w, h, t.paused, t.resume, null, c.text)
            Phase.LEVEL_UP -> levelUp(g, t, w, h)
            Phase.OVER -> dialog(w, h, t.over, t.overSub.fill("clock" to Schedule.clock(g.time), "n" to g.squashed), t.again, c.danger, t.best.fill("clock" to Schedule.clock(best)))
            Phase.WON -> dialog(w, h, t.won, t.wonSub.fill("n" to g.squashed), t.again, c.success)
            Phase.PLAYING -> {}
        }
    }

    /* ---------- the world ---------- */

    private fun office(x0: Double, y0: Double, x1: Double, y1: Double) {
        val tile = 80.0
        ctx.strokeStyle = c.grid
        ctx.lineWidth = 1.0
        ctx.beginPath()
        var gx = floor(x0 / tile) * tile
        while (gx <= x1) {
            ctx.moveTo(gx, y0)
            ctx.lineTo(gx, y1)
            gx += tile
        }
        var gy = floor(y0 / tile) * tile
        while (gy <= y1) {
            ctx.moveTo(x0, gy)
            ctx.lineTo(x1, gy)
            gy += tile
        }
        ctx.stroke()
        // desks with a monitor, on a fixed pattern so the office doesn't move under you
        val step = tile * 3
        var dx = floor(x0 / step) * step
        while (dx <= x1) {
            var dy = floor(y0 / step) * step
            while (dy <= y1) {
                val hsh = ((dx / step).toInt() * 73856093) xor ((dy / step).toInt() * 19349663)
                if (abs(hsh) % 3 == 0) {
                    rrect(dx + 60, dy + 70, 110.0, 50.0, 6.0, c.desk)
                    rrect(dx + 95, dy + 76, 40.0, 24.0, 3.0, c.grid)
                    if (abs(hsh) % 2 == 0) text("☕", dx + 150, dy + 108, 12.0, c.muted)
                }
                dy += step
            }
            dx += step
        }
    }

    private fun auras(g: Game) {
        val l = g.lvl(Upgrade.HEADPHONES)
        if (l == 0) return
        val r = 55.0 + 12 * l
        ctx.globalAlpha = 0.1 + 0.05 * sin(g.time * 6)
        circle(g.x, g.y, r, c.info)
        ctx.globalAlpha = 0.5
        ring(g.x, g.y, r, c.info, 1.5)
        ctx.globalAlpha = 1.0
    }

    private fun player(g: Game) {
        val bob = sin(g.time * 10) * if (g.phase == Phase.PLAYING) 1.5 else 0.0
        // shadow, body, head
        ctx.globalAlpha = 0.25
        circle(g.x, g.y + 14, 11.0, c.shade)
        ctx.globalAlpha = 1.0
        // blink while you can't be hit
        if (g.hurt > 0 && (g.hurt * 20).toInt() % 2 == 0) ctx.globalAlpha = 0.4
        circle(g.x, g.y + bob, 12.0, if (g.hurt > 0) c.danger else c.accent)
        circle(g.x, g.y - 14 + bob, 8.0, c.text)
        ctx.globalAlpha = 1.0
        // headphones once you have them
        if (g.lvl(Upgrade.HEADPHONES) > 0) {
            ctx.strokeStyle = c.info
            ctx.lineWidth = 2.5
            ctx.beginPath()
            ctx.arc(g.x, g.y - 14 + bob, 9.5, PI, 2 * PI)
            ctx.stroke()
        }
        // the laptop, held in the direction you walk
        val lx = g.x + g.faceX * 14
        val ly = g.y + g.faceY * 10 + 4 + bob
        rrect(lx - 9, ly - 6, 18.0, 12.0, 2.0, c.panel)
        rrect(lx - 7, ly - 4, 14.0, 7.0, 1.0, c.accent2)
    }

    private fun ducks(g: Game) {
        val l = g.lvl(Upgrade.DUCKS)
        if (l == 0) return
        val n = listOf(1, 2, 2, 3, 4)[l - 1]
        for (i in 0 until n) {
            val (dx, dy) = g.duckOffset(i, n)
            val x = g.x + dx
            val y = g.y + dy
            circle(x - 1, y + 2, 8.0, c.duck)
            circle(x + 4, y - 5, 5.0, c.duck)
            rrect(x + 7.5, y - 6, 5.0, 3.0, 1.0, c.beak)
            circle(x + 5, y - 6, 1.2, c.bg)
        }
    }

    private fun enemy(e: Enemy, time: Double) {
        val x = e.x
        val y = e.y + sin(e.age * 8 + e.phase) * 1.5
        val r = e.radius
        when (e.kind) {
            EnemyKind.PING -> {
                rrect(x - r, y - r * 0.8, r * 2, r * 1.6, r * 0.6, c.accent2)
                text("@", x, y, r * 1.2, c.bg, bold = true)
            }
            EnemyKind.SUBTASK -> {
                rrect(x - r, y - r * 0.7, r * 2, r * 1.4, 2.0, c.info)
                text("sub", x, y, r * 0.8, c.bg, bold = true)
            }
            EnemyKind.INVITE -> calendar(x, y, r, "15m")
            EnemyKind.QUESTION -> {
                circle(x, y, r, c.warn)
                text("?", x, y + 1, r * 1.4, c.bg, bold = true)
            }
            EnemyKind.RECRUITER -> {
                rrect(x - r * 1.2, y - r * 0.75, r * 2.4, r * 1.5, r * 0.6, c.info)
                text("hi!", x, y, r * 0.9, c.bg, bold = true)
            }
            EnemyKind.TICKET -> {
                rrect(x - r, y - r * 1.2, r * 2, r * 2.4, 3.0, c.panel)
                frame(x - r, y - r * 1.2, r * 2, r * 2.4, 3.0, c.info, 1.5)
                rrect(x - r, y - r * 1.2, 4.0, r * 2.4, 2.0, c.info)
                text("T-${(e.phase * 100).toInt() % 900 + 100}", x + 1, y, r * 0.55, c.text, bold = true)
            }
            EnemyKind.SCOPE -> {
                ctx.globalAlpha = 0.9
                circle(x, y, r, c.success)
                circle(x + r * 0.5, y - r * 0.4, r * 0.5, c.success)
                ctx.globalAlpha = 1.0
                text("+1", x, y, r * 0.8, c.bg, bold = true)
            }
            EnemyKind.ALL_HANDS -> {
                calendar(x, y, r, "ALL")
                text("ALL-HANDS", x, y - r - 18, 11.0, c.danger, bold = true)
                bar(x - r, y + r + 8, r * 2, e.hp / e.maxHp, c.danger)
            }
            EnemyKind.REORG -> {
                for (k in 0 until 6) {
                    val a = e.age * 1.5 + k * PI / 3
                    circle(x + cos(a) * r * 0.6, y + sin(a) * r * 0.6, r * 0.45, if (k % 2 == 0) c.accent2 else c.danger)
                }
                circle(x, y, r * 0.5, c.panel)
                text("REORG", x, y, 12.0, c.text, bold = true)
                bar(x - r, y + r + 8, r * 2, e.hp / e.maxHp, c.danger)
            }
        }
        if (e.hit > 0) {
            ctx.globalAlpha = e.hit * 5
            circle(x, y, r, c.text)
            ctx.globalAlpha = 1.0
        }
    }

    private fun calendar(x: Double, y: Double, r: Double, label: String) {
        rrect(x - r, y - r, r * 2, r * 2, r * 0.25, c.text)
        rrect(x - r, y - r, r * 2, r * 0.6, r * 0.25, c.danger)
        ctx.fillStyle = c.danger
        ctx.fillRect(x - r, y - r * 0.6, r * 2, r * 0.2)
        text(label, x, y + r * 0.25, r * 0.7, c.bg, bold = true)
    }

    private fun bar(x: Double, y: Double, w: Double, pct: Double, color: String) {
        rrect(x, y, w, 5.0, 2.5, c.shade)
        rrect(x, y, w * pct.coerceIn(0.0, 1.0), 5.0, 2.5, color)
    }

    private fun pickup(p: Pickup, time: Double) {
        when (p.kind) {
            PickupKind.COMMIT -> {
                val r = 3.5 + min(p.value, 10) * 0.5
                ring(p.x, p.y, r + 2, c.success, 1.5)
                circle(p.x, p.y, r - 1, c.success)
            }
            PickupKind.COFFEE -> {
                rrect(p.x - 6, p.y - 7, 12.0, 14.0, 3.0, c.beak)
                ring(p.x + 7, p.y, 3.5, c.beak, 2.0)
            }
            PickupKind.MAGNET -> {
                ctx.strokeStyle = c.danger
                ctx.lineWidth = 4.0
                ctx.beginPath()
                ctx.arc(p.x, p.y, 7.0, 0.0, PI)
                ctx.stroke()
                ctx.globalAlpha = 0.4 + 0.3 * sin(time * 8)
                ring(p.x, p.y + 2, 12.0, c.danger, 1.0)
                ctx.globalAlpha = 1.0
            }
        }
    }

    private fun effects(g: Game) {
        for (f in g.fx) {
            val k = f.t / f.dur
            ctx.globalAlpha = 1 - k
            when (f) {
                is Fx.Text -> text(f.text, f.x, f.y - k * 20, if (f.strong) 14.0 else 10.0, if (f.strong) c.warn else c.text, bold = f.strong)
                is Fx.Ring -> ring(f.x, f.y, f.radius * (0.3 + 0.7 * k), c.warn, 4.0)
                is Fx.Beam -> {
                    ctx.strokeStyle = c.danger
                    ctx.lineWidth = f.width * (1 - k * 0.5)
                    d.lineCap = "round"
                    ctx.beginPath()
                    ctx.moveTo(f.x, f.y)
                    ctx.lineTo(f.x + f.dx * f.length, f.y + f.dy * f.length)
                    ctx.stroke()
                }
                is Fx.Pop -> for (i in 0 until 6) {
                    val a = i * PI / 3
                    val r0 = 6 + 14 * k
                    circle(f.x + cos(a) * r0, f.y + sin(a) * r0, 2.5, c.muted)
                }
            }
        }
        ctx.globalAlpha = 1.0
    }

    /* ---------- screen space ---------- */

    private fun hud(g: Game, t: Text, w: Double, h: Double) {
        // the day, as a progress bar with the clock
        val pct = g.time / Schedule.DAY
        rrect(w / 2 - 110, 14.0, 220.0, 38.0, 10.0, c.panel)
        text(Schedule.clock(g.time), w / 2, 30.0, 20.0, if (g.time >= Schedule.REORG) c.danger else c.text, bold = true)
        rrect(w / 2 - 96, 44.0, 192.0, 3.0, 1.5, c.grid)
        rrect(w / 2 - 96, 44.0, 192 * pct, 3.0, 1.5, c.accent)

        // focus
        rrect(14.0, 14.0, 180.0, 38.0, 10.0, c.panel)
        text("${t.focus} ${g.focus.toInt()}/${g.maxFocus.toInt()}", 26.0, 25.0, 11.0, c.muted, align = "left", bold = true)
        val f = g.focus / g.maxFocus
        rrect(26.0, 36.0, 156.0, 7.0, 3.5, c.grid)
        rrect(26.0, 36.0, 156 * f, 7.0, 3.5, if (f > 0.5) c.success else if (f > 0.25) c.warn else c.danger)

        // level and handled
        rrect(w - 164, 14.0, 150.0, 38.0, 10.0, c.panel)
        text("${t.level} ${g.level}", w - 150, 25.0, 12.0, c.accent, align = "left", bold = true)
        text("${g.squashed} ${t.squashed}", w - 150, 40.0, 10.0, c.muted, align = "left")

        // xp along the bottom
        rrect(0.0, h - 6, w, 6.0, 0.0, c.grid)
        rrect(0.0, h - 6, w * g.xp / g.xpToNext(), 6.0, 0.0, c.success)

        // your kit
        var x = 14.0
        for ((u, l) in g.owned) {
            val label = (t.upgrades[u]?.first ?: u.name).split(' ', '-').filter { it.isNotEmpty() }.joinToString("") { it.take(1) }.take(3).uppercase()
            rrect(x, h - 44, 34.0, 30.0, 7.0, c.panel)
            text(label, x + 17, h - 33, 10.0, if (u.weapon) c.accent else c.accent2, bold = true)
            for (i in 0 until l) circle(x + 7 + i * 5, h - 21, 1.6, c.warn)
            x += 38
        }
    }

    private fun joystick(s: Stick) {
        ctx.globalAlpha = 0.35
        ring(s.ox, s.oy, 40.0, c.text, 2.0)
        circle(s.ox + s.dx * 40, s.oy + s.dy * 40, 16.0, c.text)
        ctx.globalAlpha = 1.0
    }

    private fun shade(w: Double, h: Double) {
        ctx.globalAlpha = 0.6
        ctx.fillStyle = c.shade
        ctx.fillRect(0.0, 0.0, w, h)
        ctx.globalAlpha = 1.0
    }

    private fun title(t: Text, w: Double, h: Double, best: Double) {
        shade(w, h)
        val cy = h / 2
        text("$ standup --survive", w / 2, cy - 92, 13.0, c.muted)
        text(t.title, w / 2, cy - 56, min(46.0, w / 13), c.text, bold = true)
        text(t.tagline, w / 2, cy - 18, min(14.0, w / 52), c.muted)
        text(t.start, w / 2, cy + 26, 15.0, c.accent, bold = true)
        text(t.controls, w / 2, cy + 58, 12.0, c.muted)
        text(t.touch, w / 2, cy + 78, 12.0, c.muted)
        if (best > 0) text(t.best.fill("clock" to Schedule.clock(best)), w / 2, cy + 110, 12.0, c.warn, bold = true)
    }

    private fun dialog(w: Double, h: Double, title: String, sub: String, hint: String?, color: String, extra: String? = null) {
        shade(w, h)
        val bw = min(560.0, w - 32)
        val bh = 170.0
        rrect(w / 2 - bw / 2, h / 2 - bh / 2, bw, bh, 14.0, c.panel)
        frame(w / 2 - bw / 2, h / 2 - bh / 2, bw, bh, 14.0, color, 1.5)
        text(title, w / 2, h / 2 - 42, min(24.0, bw / 22), color, bold = true)
        text(sub, w / 2, h / 2 - 6, min(13.0, bw / 44), c.text)
        extra?.let { text(it, w / 2, h / 2 + 20, 12.0, c.warn, bold = true) }
        hint?.let { text(it, w / 2, h / 2 + 50, 13.0, c.accent, bold = true) }
    }

    private fun levelUp(g: Game, t: Text, w: Double, h: Double) {
        shade(w, h)
        text(t.levelUp, w / 2, h / 2 - 118, 26.0, c.warn, bold = true)
        text(t.pick, w / 2, h / 2 - 88, 12.0, c.muted)
        val options = g.choices.ifEmpty { listOf(null) }
        val cw = min(230.0, (w - 48) / options.size - 10)
        val ch = 150.0
        val total = options.size * cw + (options.size - 1) * 12
        val out = ArrayList<Hit>()
        options.forEachIndexed { i, u ->
            val x = w / 2 - total / 2 + i * (cw + 12)
            val y = h / 2 - 64
            rrect(x, y, cw, ch, 12.0, c.panel)
            frame(x, y, cw, ch, 12.0, if (u?.weapon == true) c.accent else c.accent2, 1.5)
            text("${i + 1}", x + 16, y + 18, 12.0, c.muted, bold = true)
            val (name, desc) = if (u == null) t.snack to t.snackDesc else t.upgrades.getValue(u)
            val next = if (u == null) "" else if (g.lvl(u) == 0) "new" else "v${g.lvl(u) + 1}"
            text(next, x + cw - 16, y + 18, 11.0, c.warn, align = "right", bold = true)
            text(name, x + cw / 2, y + 48, min(14.0, cw / 12), c.text, bold = true)
            wrap(desc, (cw / 7).toInt()).forEachIndexed { k, line -> text(line, x + cw / 2, y + 78 + k * 16, 11.0, c.muted) }
            out += Hit(x, y, cw, ch, i)
        }
        hits = out
    }

    private fun wrap(s: String, max: Int): List<String> {
        val lines = ArrayList<String>()
        var line = ""
        for (word in s.split(' ')) {
            if (line.isNotEmpty() && line.length + 1 + word.length > max) {
                lines += line
                line = word
            } else line = if (line.isEmpty()) word else "$line $word"
        }
        if (line.isNotEmpty()) lines += line
        return lines
    }
}

/** The touch joystick: where the finger went down, and the unit-clamped direction it moved. */
class Stick(val ox: Double, val oy: Double, var dx: Double = 0.0, var dy: Double = 0.0)
