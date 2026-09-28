/// The rules of Code Review Tinder, without any Flutter: a deck of pull requests, a review clock that gets shorter,
/// and the bugs you approve coming back as production incidents a few reviews later.
library;

import 'dart:math';

import 'diffs.dart';

enum Verdict { approve, reject }

/// What a review turned out to be.
enum Result {
  /// Rejected a buggy PR.
  caught,

  /// Approved a clean PR.
  shipped,

  /// Rejected a clean PR: no harm to production, but the streak is gone.
  blocked,

  /// Approved a buggy PR. Nothing happens yet: it comes back as an incident.
  slipped,
}

/// A pull request on the table: the diff, plus a number and an author for flavour.
class Review {
  const Review(this.pr, this.number, this.author);
  final PullRequest pr;
  final int number;
  final String author;
}

class Outcome {
  const Outcome(this.review, this.result, this.points, {this.timedOut = false});
  final Review review;
  final Result result;
  final int points;

  /// Nobody decided in time, so it was merged with a "LGTM".
  final bool timedOut;

  bool get correct => result == Result.caught || result == Result.shipped;
}

class Game {
  Game({Random? random, this.deck = pullRequests}) : _random = random ?? Random() {
    _number = 100 + _random.nextInt(300);
    current = _draw();
    left = limit;
  }

  static const startLives = 3;

  /// How many reviews later an approved bug hits production.
  static const incidentDelay = 2;

  final Random _random;
  final List<PullRequest> deck;
  final List<int> _order = [];
  int _last = -1;
  int _number = 0;

  int lives = startLives;
  int score = 0;
  int streak = 0;
  int reviewed = 0;
  late Review current;

  /// Seconds left on the current review.
  late double left;

  /// Approved bugs waiting to go off: the review count at which each one does.
  final List<(int, Review)> _pending = [];

  bool get over => lives <= 0;

  /// Seconds you get per review: 12 at first, down to 4.
  double get limit => max(4.0, 12.0 - reviewed * 0.35);

  /// Points for a correct review grow with the streak: ×1, then ×2 from 5 in a row, ×3 from 10, …
  int get multiplier => 1 + streak ~/ 5;

  /// Approved bugs that haven't hit production yet.
  int get ticking => _pending.length;

  Review _draw() {
    if (_order.isEmpty) {
      _order.addAll(List.generate(deck.length, (i) => i)..shuffle(_random));
      // never the same PR twice in a row across a reshuffle
      if (_order.first == _last && _order.length > 1) _order.add(_order.removeAt(0));
    }
    _last = _order.removeAt(0);
    _number += 1 + _random.nextInt(6);
    return Review(deck[_last], _number, authors[_random.nextInt(authors.length)]);
  }

  /// Review the current PR. Returns what it was, and moves on to the next one.
  Outcome decide(Verdict verdict, {bool timedOut = false}) {
    assert(!over);
    final review = current;
    final buggy = review.pr.buggy;
    final Result result = switch ((verdict, buggy)) {
      (Verdict.reject, true) => Result.caught,
      (Verdict.approve, false) => Result.shipped,
      (Verdict.reject, false) => Result.blocked,
      (Verdict.approve, true) => Result.slipped,
    };
    var points = 0;
    if (result == Result.caught || result == Result.shipped) {
      // quick reviews earn a little extra
      points = (100 + (50 * left / limit).round()) * multiplier;
      streak++;
    } else if (result == Result.blocked) {
      streak = 0;
    } else {
      _pending.add((reviewed + 1 + incidentDelay, review));
    }
    score += points;
    reviewed++;
    current = _draw();
    left = limit;
    return Outcome(review, result, points, timedOut: timedOut);
  }

  /// Approved bugs that hit production now: each costs a life and the streak. Call after [decide].
  List<Review> incidents() {
    final due = _pending.where((p) => p.$1 <= reviewed).map((p) => p.$2).toList();
    _pending.removeWhere((p) => p.$1 <= reviewed);
    if (due.isNotEmpty) {
      lives = max(0, lives - due.length);
      streak = 0;
    }
    return due;
  }

  /// Let time pass. When the clock runs out, the PR gets merged unread: returns that outcome.
  Outcome? tick(double seconds) {
    if (over) return null;
    left -= seconds;
    if (left > 0) return null;
    return decide(Verdict.approve, timedOut: true);
  }
}
