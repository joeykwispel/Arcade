import 'dart:math';

import 'package:code_review_tinder/diffs.dart';
import 'package:code_review_tinder/game.dart';
import 'package:flutter_test/flutter_test.dart';

/// Always gives the right answer.
Verdict right(Game g) => g.current.pr.buggy ? Verdict.reject : Verdict.approve;

void main() {
  test('every PR is a real diff with an explanation in both languages', () {
    expect(pullRequests.length, greaterThanOrEqualTo(20));
    expect(pullRequests.where((p) => p.buggy).length, greaterThanOrEqualTo(10));
    expect(pullRequests.where((p) => !p.buggy).length, greaterThanOrEqualTo(10));
    for (final p in pullRequests) {
      expect(p.lines.any((l) => l.startsWith('+') || l.startsWith('-')), isTrue, reason: p.title);
      for (final l in p.lines) {
        expect(l[0], anyOf('+', '-', ' '), reason: '${p.title}: "$l"');
        expect(l.length, lessThanOrEqualTo(60), reason: 'too wide for a phone: "$l"');
      }
      expect(p.en.trim(), isNotEmpty);
      expect(p.nl.trim(), isNotEmpty);
      expect(p.lines.length, lessThanOrEqualTo(7), reason: p.title);
    }
  });

  test('right answers score, and the multiplier grows with the streak', () {
    final g = Game(random: Random(1));
    for (var i = 0; i < 5; i++) {
      final o = g.decide(right(g));
      expect(o.correct, isTrue);
      expect(o.points, greaterThanOrEqualTo(100));
    }
    expect(g.streak, 5);
    expect(g.multiplier, 2);
    expect(g.lives, Game.startLives);
    expect(g.decide(right(g)).points, greaterThanOrEqualTo(200));
  });

  test('blocking a clean PR costs the streak, not a life', () {
    final g = Game(random: Random(2), deck: pullRequests.where((p) => !p.buggy).toList());
    g.decide(Verdict.approve);
    final o = g.decide(Verdict.reject);
    expect(o.result, Result.blocked);
    expect(o.points, 0);
    expect(g.streak, 0);
    expect(g.lives, Game.startLives);
    expect(g.incidents(), isEmpty);
  });

  test('an approved bug comes back as an incident a few reviews later', () {
    final g = Game(random: Random(3), deck: pullRequests.where((p) => p.buggy).toList());
    final o = g.decide(Verdict.approve);
    expect(o.result, Result.slipped);
    expect(g.incidents(), isEmpty, reason: 'not right away');
    expect(g.ticking, 1);
    for (var i = 0; i < Game.incidentDelay - 1; i++) {
      g.decide(Verdict.reject);
      expect(g.incidents(), isEmpty);
    }
    g.decide(Verdict.reject);
    final due = g.incidents();
    expect(due.map((r) => r.number), [o.review.number]);
    expect(g.lives, Game.startLives - 1);
    expect(g.streak, 0);
  });

  test('three incidents and production is down', () {
    final g = Game(random: Random(4), deck: pullRequests.where((p) => p.buggy).toList());
    while (!g.over) {
      g.decide(Verdict.approve);
      g.incidents();
      expect(g.reviewed, lessThan(20));
    }
    expect(g.lives, 0);
  });

  test('when the clock runs out, the PR is merged unread', () {
    final g = Game(random: Random(5));
    expect(g.tick(1), isNull);
    final o = g.tick(g.limit);
    expect(o, isNotNull);
    expect(o!.timedOut, isTrue);
    expect(o.result, anyOf(Result.shipped, Result.slipped));
    expect(g.left, g.limit, reason: 'the next review gets a full clock');
  });

  test('reviews get faster, down to four seconds', () {
    final g = Game(random: Random(6));
    final first = g.limit;
    for (var i = 0; i < 60; i++) {
      g.decide(right(g));
    }
    expect(g.limit, lessThan(first));
    expect(g.limit, 4.0);
  });

  test('never the same PR twice in a row, and PR numbers go up', () {
    final g = Game(random: Random(7));
    var last = g.current;
    for (var i = 0; i < 200; i++) {
      g.decide(right(g));
      expect(identical(g.current.pr, last.pr), isFalse);
      expect(g.current.number, greaterThan(last.number));
      last = g.current;
    }
  });
}
