package standup

/** Everything that interrupts a developer's day. Numbers are per second and in world units (the view is ~640 wide). */
enum class EnemyKind(
    val hp: Double,
    val speed: Double,
    /** how hard it hits: a hit costs dps × HURT_TIME focus, and you get HURT_TIME seconds before the next one */
    val dps: Double,
    val xp: Int,
    val radius: Double,
    val boss: Boolean = false,
) {
    PING(8.0, 92.0, 6.0, 1, 9.0),
    SUBTASK(6.0, 108.0, 6.0, 1, 7.0),
    INVITE(22.0, 62.0, 12.0, 2, 13.0),
    QUESTION(40.0, 74.0, 14.0, 3, 12.0),
    RECRUITER(18.0, 128.0, 10.0, 3, 10.0),
    TICKET(36.0, 56.0, 12.0, 3, 14.0),
    SCOPE(60.0, 40.0, 18.0, 5, 14.0),
    ALL_HANDS(1600.0, 46.0, 30.0, 40, 40.0, boss = true),
    REORG(4200.0, 52.0, 40.0, 80, 52.0, boss = true),
}

/** Upgrades you pick on level up. Weapons fire on their own; passives change your stats. Five levels each. */
enum class Upgrade(val weapon: Boolean) {
    KEYBOARD(true),
    HEADPHONES(true),
    DUCKS(true),
    DECLINE(true),
    FORCE_PUSH(true),
    COFFEE(false),
    FOCUS_MODE(false),
    STANDING_DESK(false),
    DND(false),
    PAIRING(false),
    ;

    companion object {
        const val MAX = 5
    }
}

/** Minutes after 09:00 when something big happens. One real second is one minute of the workday. */
object Schedule {
    const val DAY = 480.0 // 09:00 → 17:00
    const val ALL_HANDS = 180.0 // 12:00
    const val REORG = 420.0 // 16:00

    /** Surges: every enemy of a kind at once, in a ring around you. (time, kind, count) */
    val surges = listOf(
        Triple(15.0, EnemyKind.PING, 14), // 09:15 stand-up
        Triple(90.0, EnemyKind.INVITE, 16), // 10:30 sprint planning
        Triple(240.0, EnemyKind.QUESTION, 22), // 13:00 after lunch
        Triple(300.0, EnemyKind.TICKET, 20), // 14:00 backlog grooming
        Triple(360.0, EnemyKind.RECRUITER, 26), // 15:00
        Triple(450.0, EnemyKind.INVITE, 36), // 16:30 "one last sync"
    )

    /** Which kinds show up in the normal stream, from when */
    val stream = listOf(
        0.0 to EnemyKind.PING,
        50.0 to EnemyKind.INVITE,
        120.0 to EnemyKind.QUESTION,
        170.0 to EnemyKind.RECRUITER,
        230.0 to EnemyKind.TICKET,
        290.0 to EnemyKind.SCOPE,
    )

    fun clock(t: Double): String {
        val m = 9 * 60 + t.toInt().coerceIn(0, DAY.toInt())
        return "${(m / 60).toString().padStart(2, '0')}:${(m % 60).toString().padStart(2, '0')}"
    }
}
