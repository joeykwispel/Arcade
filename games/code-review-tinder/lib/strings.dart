/// Everything the game says, in English and Dutch.
library;

class Strings {
  const Strings({
    required this.tagline,
    required this.how,
    required this.start,
    required this.approve,
    required this.reject,
    required this.score,
    required this.best,
    required this.streak,
    required this.prod,
    required this.caught,
    required this.shipped,
    required this.blocked,
    required this.slipped,
    required this.lgtm,
    required this.incident,
    required this.down,
    required this.downText,
    required this.reviewed,
    required this.newBest,
    required this.again,
    required this.paused,
    required this.resume,
    required this.opened,
    required this.ticking,
  });

  final String tagline, how, start, approve, reject, score, best, streak, prod;
  final String caught, shipped, blocked, slipped, lgtm, incident;
  final String down, downText, reviewed, newBest, again, paused, resume, opened, ticking;

  static Strings of(String lang) => lang == 'nl' ? nl : en;

  static const en = Strings(
    tagline: 'Diffs slide in. Approve the good ones, request changes on the bad ones.',
    how: 'Swipe right or → to approve, left or ← to request changes. The bugs you approve come back later.',
    start: 'Press Space or tap to start reviewing',
    approve: 'Approve',
    reject: 'Request changes',
    score: 'score',
    best: 'best',
    streak: 'streak',
    prod: 'prod',
    caught: 'Bug caught',
    shipped: 'Shipped',
    blocked: 'Blocked a good PR',
    slipped: 'Merged…',
    lgtm: 'Too slow: merged with "LGTM"',
    incident: 'INCIDENT',
    down: 'Production is down',
    downText: 'Three bugs you approved made it to production.',
    reviewed: 'PRs reviewed',
    newBest: 'New best score!',
    again: 'Press Space or tap to review again',
    paused: 'Paused',
    resume: 'Press Space or tap to go on',
    opened: 'opened',
    ticking: 'bugs in prod, not found yet',
  );

  static const nl = Strings(
    tagline: 'Diffs schuiven binnen. Keur de goede goed, vraag changes bij de slechte.',
    how: 'Veeg naar rechts of → om goed te keuren, naar links of ← voor changes. De bugs die je goedkeurt komen later terug.',
    start: 'Druk op spatie of tik om te beginnen met reviewen',
    approve: 'Goedkeuren',
    reject: 'Changes vragen',
    score: 'score',
    best: 'record',
    streak: 'reeks',
    prod: 'prod',
    caught: 'Bug gevonden',
    shipped: 'Geshipt',
    blocked: 'Goede PR tegengehouden',
    slipped: 'Gemerged…',
    lgtm: 'Te traag: gemerged met "LGTM"',
    incident: 'INCIDENT',
    down: 'Productie ligt plat',
    downText: 'Drie bugs die je goedkeurde haalden productie.',
    reviewed: "PR's gereviewd",
    newBest: 'Nieuw record!',
    again: 'Druk op spatie of tik om opnieuw te reviewen',
    paused: 'Gepauzeerd',
    resume: 'Druk op spatie of tik om verder te gaan',
    opened: 'opende',
    ticking: 'bugs in prod, nog niet ontdekt',
  );
}
