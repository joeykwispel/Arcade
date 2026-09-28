package standup

import kotlinx.browser.document
import kotlinx.browser.window
import org.w3c.dom.CanvasRenderingContext2D
import org.w3c.dom.HTMLCanvasElement
import org.w3c.dom.HTMLElement
import org.w3c.dom.MessageEvent
import org.w3c.dom.events.KeyboardEvent
import org.w3c.dom.pointerevents.PointerEvent
import org.w3c.dom.url.URLSearchParams
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

/**
 * The browser side: canvas sizing, the loop, keyboard and touch input, theme and language from the hub, and the best
 * time in localStorage. The rules live in commonMain (Game.kt) and know nothing about the page.
 */
private const val BEST_KEY = "play:standup-survivor:best"

private val stage = document.getElementById("stage") as HTMLElement
private val canvas = document.getElementById("game") as HTMLCanvasElement
private val ctx = canvas.getContext("2d") as CanvasRenderingContext2D
private val live = document.getElementById("live") as HTMLElement
private val painter = Painter(ctx)

private var game = Game(seed())
private var text = EN
private val keys = mutableSetOf<String>()
private var stick: Stick? = null
private var banner: Pair<String, Double>? = null
private var best = storedBest()
private var last = 0.0
private var endedAt = 0.0

private fun seed() = (window.performance.now() * 1000).toLong() xor 0x5DEECE66DL

private fun storedBest(): Double = try {
    window.localStorage.getItem(BEST_KEY)?.toDoubleOrNull() ?: 0.0
} catch (e: dynamic) {
    0.0
}

private fun saveBest() {
    try {
        window.localStorage.setItem(BEST_KEY, best.toString())
    } catch (e: dynamic) {
        // private mode: the best time just won't stick
    }
}

private fun readColors() {
    val cs = window.getComputedStyle(document.documentElement!!)
    painter.c = Colors { cs.getPropertyValue("--c-$it").trim() }
}

private fun setTheme(theme: String?) {
    document.documentElement!!.setAttribute("data-theme", if (theme == "light") "light" else "dark")
    readColors()
}

private fun setLang(lang: String) {
    text = if (lang == "nl") NL else EN
    document.documentElement!!.setAttribute("lang", lang)
}

private fun say(s: String) {
    live.textContent = s
}

/** Space, Enter or a tap: starts, resumes, or starts a new day after the last one ended. */
private fun press() {
    when (game.phase) {
        Phase.READY -> {
            game.start()
            say(text.sayStart)
        }
        Phase.PAUSED -> game.togglePause()
        Phase.OVER, Phase.WON -> if (window.performance.now() - endedAt > 600) {
            game = Game(seed())
            game.start()
            say(text.sayStart)
        }
        else -> {}
    }
}

private fun pause() {
    if (game.phase == Phase.PLAYING) game.togglePause()
    keys.clear()
    stick = null
}

private fun input(): Input {
    var dx = 0.0
    var dy = 0.0
    if ("ArrowLeft" in keys || "KeyA" in keys) dx -= 1
    if ("ArrowRight" in keys || "KeyD" in keys) dx += 1
    if ("ArrowUp" in keys || "KeyW" in keys) dy -= 1
    if ("ArrowDown" in keys || "KeyS" in keys) dy += 1
    stick?.let {
        dx += it.dx
        dy += it.dy
    }
    return Input(dx, dy)
}

private fun events() {
    for (e in game.events) {
        when (e) {
            is Event.LevelUp -> say(text.sayLevel.fill("n" to e.level))
            is Event.Boss -> text.bosses[e.kind]?.let {
                banner = it to 0.0
                say(it)
            }
            is Event.Surge -> text.surges[e.kind]?.let { banner = it to 0.0 }
            Event.Over, Event.Won -> {
                endedAt = window.performance.now()
                if (game.time > best) {
                    best = game.time
                    saveBest()
                }
                say(if (e == Event.Won) text.won else "${text.over}. ${text.overSub.fill("clock" to Schedule.clock(game.time), "n" to game.squashed)}")
            }
        }
    }
    game.events.clear()
}

private fun frame(now: Double) {
    val dt = min(0.05, max(0.0, (now - last) / 1000))
    last = now
    val rect = stage.getBoundingClientRect()
    val w = rect.width
    val h = rect.height
    val dpr = min(window.devicePixelRatio, 3.0)
    if (canvas.width != (w * dpr).toInt() || canvas.height != (h * dpr).toInt()) {
        canvas.width = (w * dpr).toInt()
        canvas.height = (h * dpr).toInt()
    }
    // about 560 world units on the short side; a bit more on big screens
    val scale = max(0.55, min(w, h) / 560)
    game.spawnRadius = sqrt((w / scale) * (w / scale) + (h / scale) * (h / scale)) / 2 + 40
    game.update(dt, input())
    events()
    banner = banner?.let { (m, age) -> if (age + dt > 3) null else m to age + dt }
    painter.frame(game, text, w, h, scale, dpr, stick, banner, best)
    stage.setAttribute("data-phase", game.phase.name.lowercase())
    window.requestAnimationFrame(::frame)
}

private val MOVE_KEYS = setOf("ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "KeyA", "KeyD", "KeyW", "KeyS")

fun main() {
    if (js("window.top === window.self") as Boolean) document.documentElement!!.classList.add("standalone")

    val cookie = Regex("(?:^|; )jo-theme=(dark|light)").find(document.cookie)?.groupValues?.get(1)
    val stored = try {
        window.localStorage.getItem("theme")
    } catch (e: dynamic) {
        null
    }
    setTheme(cookie ?: stored)
    val param = URLSearchParams(window.location.search).get("lang")
    setLang(if (param == "nl" || param == "en") param else if (window.navigator.language.startsWith("nl")) "nl" else "en")

    window.addEventListener("keydown", { ev ->
        val e = ev as KeyboardEvent
        if (e.ctrlKey || e.metaKey || e.altKey) return@addEventListener
        when {
            e.code in MOVE_KEYS -> {
                e.preventDefault()
                keys += e.code
            }
            e.code == "Space" || e.code == "Enter" -> {
                e.preventDefault()
                if (!e.repeat) press()
            }
            e.code == "KeyP" || e.code == "Escape" -> game.togglePause()
            e.code in setOf("Digit1", "Digit2", "Digit3", "Numpad1", "Numpad2", "Numpad3") -> game.choose(e.code.last() - '1')
        }
    })
    window.addEventListener("keyup", { ev -> keys -= (ev as KeyboardEvent).code })

    stage.addEventListener("pointerdown", { ev ->
        val e = ev as PointerEvent
        if (!e.isPrimary) return@addEventListener
        e.preventDefault()
        window.focus()
        val r = stage.getBoundingClientRect()
        val x = e.clientX - r.left
        val y = e.clientY - r.top
        if (game.phase == Phase.LEVEL_UP) {
            painter.hits.firstOrNull { x >= it.x && x < it.x + it.w && y >= it.y && y < it.y + it.h }?.let { game.choose(it.index) }
            return@addEventListener
        }
        if (game.phase != Phase.PLAYING) return@addEventListener press()
        stick = Stick(x, y)
        stage.setPointerCapture(e.pointerId)
    })
    stage.addEventListener("pointermove", { ev ->
        val e = ev as PointerEvent
        val s = stick ?: return@addEventListener
        val r = stage.getBoundingClientRect()
        val dx = e.clientX - r.left - s.ox
        val dy = e.clientY - r.top - s.oy
        val d = hypot(dx, dy)
        val k = if (d > 40) 40 / d else 1.0
        s.dx = dx * k / 40
        s.dy = dy * k / 40
    })
    val release = { _: org.w3c.dom.events.Event -> stick = null }
    stage.addEventListener("pointerup", release)
    stage.addEventListener("pointercancel", release)

    // Losing focus pauses, so no meeting ambushes you while you're in another tab.
    window.addEventListener("blur", { pause() })
    document.addEventListener("visibilitychange", { if (document.asDynamic().hidden == true) pause() })

    window.addEventListener("message", { ev ->
        val e = ev as MessageEvent
        val data = e.data.asDynamic()
        if (e.origin != window.location.origin || data?.type != "play:settings") return@addEventListener
        val theme = data.theme as? String
        if (theme == "light" || theme == "dark") setTheme(theme)
        val lang = data.lang as? String
        if (lang == "en" || lang == "nl") setLang(lang)
    })
    window.addEventListener("storage", { ev ->
        val e = ev as org.w3c.dom.StorageEvent
        if (e.key == "theme") setTheme(e.newValue)
    })

    // redraw with the real font once it's in
    document.asDynamic().fonts?.load("700 12px $MONO")
    last = window.performance.now()
    window.requestAnimationFrame(::frame)
}
