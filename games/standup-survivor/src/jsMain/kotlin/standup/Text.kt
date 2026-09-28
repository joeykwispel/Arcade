package standup

/** Everything the game says, in English and Dutch. */
class Text(
    val title: String,
    val tagline: String,
    val start: String,
    val controls: String,
    val touch: String,
    val focus: String,
    val level: String,
    val squashed: String,
    val paused: String,
    val resume: String,
    val levelUp: String,
    val pick: String,
    val snack: String,
    val snackDesc: String,
    val over: String,
    val overSub: String,
    val won: String,
    val wonSub: String,
    val best: String,
    val again: String,
    val upgrades: Map<Upgrade, Pair<String, String>>,
    val surges: Map<EnemyKind, String>,
    val bosses: Map<EnemyKind, String>,
    val sayStart: String,
    val sayLevel: String,
)

private val names = mapOf(
    Upgrade.KEYBOARD to "Keyboard spam",
    Upgrade.HEADPHONES to "Noise-cancelling",
    Upgrade.DUCKS to "Rubber ducks",
    Upgrade.DECLINE to "Decline meeting",
    Upgrade.FORCE_PUSH to "git push --force",
    Upgrade.COFFEE to "Coffee",
    Upgrade.FOCUS_MODE to "Focus mode",
    Upgrade.STANDING_DESK to "Standing desk",
    Upgrade.DND to "Do not disturb",
    Upgrade.PAIRING to "Pair programming",
)

val EN = Text(
    title = "Standup Survivor",
    tagline = "Survive the workday. Slack pings, meeting invites and quick questions come from everywhere.",
    start = "Press Space or tap to clock in",
    controls = "WASD or arrows to walk. Your tools fire by themselves. P pauses.",
    touch = "On a phone: drag anywhere to walk.",
    focus = "focus",
    level = "lv",
    squashed = "handled",
    paused = "Paused",
    resume = "Space or tap to continue",
    levelUp = "Level up!",
    pick = "Pick one: 1, 2, 3 or tap",
    snack = "Snack break",
    snackDesc = "Everything is maxed. Have a snack: +30 focus.",
    over = "You got pulled into another meeting",
    overSub = "Lasted until {clock}, handled {n} interruptions.",
    won = "17:00. Laptop closed.",
    wonSub = "You survived the whole day, handled {n} interruptions. Go home.",
    best = "best: {clock}",
    again = "Space or tap for another day",
    upgrades = names.mapValues { (u, n) ->
        n to when (u) {
            Upgrade.KEYBOARD -> "Types characters at the nearest interruption."
            Upgrade.HEADPHONES -> "Hurts everything that gets too close."
            Upgrade.DUCKS -> "Rubber ducks circle you and bonk what they touch."
            Upgrade.DECLINE -> "A shockwave that pushes everything back."
            Upgrade.FORCE_PUSH -> "A beam where you walk. Goes through everything."
            Upgrade.COFFEE -> "+10% walking speed."
            Upgrade.FOCUS_MODE -> "Every tool fires 8% faster."
            Upgrade.STANDING_DESK -> "+20 max focus, and heals a bit."
            Upgrade.DND -> "Pick up commits from further away."
            Upgrade.PAIRING -> "+15% damage for every tool."
        }
    },
    surges = mapOf(
        EnemyKind.PING to "09:15 Stand-up: @here",
        EnemyKind.INVITE to "Sprint planning",
        EnemyKind.QUESTION to "After lunch: quick questions",
        EnemyKind.TICKET to "Backlog grooming",
        EnemyKind.RECRUITER to "Recruiters found your profile",
    ),
    bosses = mapOf(
        EnemyKind.ALL_HANDS to "12:00 All-hands meeting!",
        EnemyKind.REORG to "16:00 A reorg is coming!",
    ),
    sayStart = "Clocked in at 09:00. Survive until 17:00.",
    sayLevel = "Level {n}. Pick an upgrade with 1, 2 or 3.",
)

val NL = Text(
    title = "Standup Survivor",
    tagline = "Overleef de werkdag. Slack-pings, meeting-uitnodigingen en snelle vraagjes komen van alle kanten.",
    start = "Druk op spatie of tik om in te klokken",
    controls = "WASD of pijltjes om te lopen. Je tools vuren vanzelf. P pauzeert.",
    touch = "Op je telefoon: sleep ergens om te lopen.",
    focus = "focus",
    level = "lv",
    squashed = "afgehandeld",
    paused = "Gepauzeerd",
    resume = "Spatie of tik om verder te gaan",
    levelUp = "Level omhoog!",
    pick = "Kies er een: 1, 2, 3 of tik",
    snack = "Snackpauze",
    snackDesc = "Alles is maximaal. Neem een snack: +30 focus.",
    over = "Je bent in een meeting getrokken",
    overSub = "Volgehouden tot {clock}, {n} onderbrekingen afgehandeld.",
    won = "17:00. Laptop dicht.",
    wonSub = "Je hebt de hele dag overleefd en {n} onderbrekingen afgehandeld. Ga naar huis.",
    best = "record: {clock}",
    again = "Spatie of tik voor nog een dag",
    upgrades = names.mapValues { (u, n) ->
        n to when (u) {
            Upgrade.KEYBOARD -> "Typt tekens naar de dichtstbijzijnde onderbreking."
            Upgrade.HEADPHONES -> "Raakt alles wat te dichtbij komt."
            Upgrade.DUCKS -> "Rubber ducks cirkelen om je heen en meppen wat ze raken."
            Upgrade.DECLINE -> "Een schokgolf die alles terugduwt."
            Upgrade.FORCE_PUSH -> "Een straal in je looprichting. Gaat overal doorheen."
            Upgrade.COFFEE -> "+10% loopsnelheid."
            Upgrade.FOCUS_MODE -> "Elke tool vuurt 8% sneller."
            Upgrade.STANDING_DESK -> "+20 maximale focus, en een beetje herstel."
            Upgrade.DND -> "Pak commits op van verder weg."
            Upgrade.PAIRING -> "+15% schade voor elke tool."
        }
    },
    surges = mapOf(
        EnemyKind.PING to "09:15 Stand-up: @here",
        EnemyKind.INVITE to "Sprint planning",
        EnemyKind.QUESTION to "Na de lunch: snelle vraagjes",
        EnemyKind.TICKET to "Backlog grooming",
        EnemyKind.RECRUITER to "Recruiters hebben je profiel gevonden",
    ),
    bosses = mapOf(
        EnemyKind.ALL_HANDS to "12:00 All-hands meeting!",
        EnemyKind.REORG to "16:00 Er komt een reorganisatie!",
    ),
    sayStart = "Ingeklokt om 09:00. Houd het vol tot 17:00.",
    sayLevel = "Level {n}. Kies een upgrade met 1, 2 of 3.",
)

fun String.fill(vararg vars: Pair<String, Any>): String = vars.fold(this) { s, (k, v) -> s.replace("{$k}", v.toString()) }
