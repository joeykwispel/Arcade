/// Code Review Tinder: swipe right to approve a diff, left to request changes. The bugs you let through come back.
/// The rules are in game.dart; this is the Flutter UI around them.
library;

import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter/services.dart';

import 'game.dart';
import 'host.dart' as host;
import 'strings.dart';

void main() => runApp(const App());

enum Phase { title, playing, paused, over }

/// The joeyoosenbrug.nl colours, dark and light.
class Palette {
  const Palette({
    required this.bg,
    required this.panel,
    required this.raised,
    required this.border,
    required this.text,
    required this.muted,
    required this.accent,
    required this.onAccent,
    required this.danger,
    required this.warn,
    required this.ok,
    required this.addBg,
    required this.delBg,
  });
  final Color bg, panel, raised, border, text, muted, accent, onAccent, danger, warn, ok, addBg, delBg;

  static const dark = Palette(
    bg: Color(0xFF0D1220),
    panel: Color(0xFF111827),
    raised: Color(0xFF182033),
    border: Color(0xFF253049),
    text: Color(0xFFE6E9F2),
    muted: Color(0xFF98A3B9),
    accent: Color(0xFF7DD3C0),
    onAccent: Color(0xFF06201B),
    danger: Color(0xFFF7768E),
    warn: Color(0xFFE0AF68),
    ok: Color(0xFF9ECE6A),
    addBg: Color(0x269ECE6A),
    delBg: Color(0x26F7768E),
  );
  static const light = Palette(
    bg: Color(0xFFFFFFFF),
    panel: Color(0xFFF4F6FB),
    raised: Color(0xFFE8ECF4),
    border: Color(0xFFD3D9E6),
    text: Color(0xFF141B2D),
    muted: Color(0xFF4B566D),
    accent: Color(0xFF0F766E),
    onAccent: Color(0xFFFFFFFF),
    danger: Color(0xFFB4233F),
    warn: Color(0xFF8A5300),
    ok: Color(0xFF2F6B1F),
    addBg: Color(0x1F2F6B1F),
    delBg: Color(0x1FB4233F),
  );
}

const _font = 'JetBrainsMono';

class App extends StatefulWidget {
  const App({super.key});
  @override
  State<App> createState() => _AppState();
}

class _AppState extends State<App> {
  String lang = host.initialLang();
  bool dark = host.initialDark();

  @override
  void initState() {
    super.initState();
    host.followHub(
      onLang: (l) => setState(() => lang = l),
      onDark: (d) => setState(() => dark = d),
    );
  }

  @override
  Widget build(BuildContext context) {
    final p = dark ? Palette.dark : Palette.light;
    return MaterialApp(
      title: 'Code Review Tinder',
      debugShowCheckedModeBanner: false,
      // the app's locale is also what Flutter writes into <html lang>
      locale: Locale(lang),
      supportedLocales: const [Locale('en'), Locale('nl')],
      localizationsDelegates: GlobalMaterialLocalizations.delegates,
      theme: ThemeData(
        brightness: dark ? Brightness.dark : Brightness.light,
        fontFamily: _font,
        scaffoldBackgroundColor: p.bg,
        colorScheme: ColorScheme.fromSeed(
          seedColor: p.accent,
          brightness: dark ? Brightness.dark : Brightness.light,
        ),
      ),
      home: GameScreen(palette: p, text: Strings.of(lang), lang: lang),
    );
  }
}

class GameScreen extends StatefulWidget {
  const GameScreen({super.key, required this.palette, required this.text, required this.lang});
  final Palette palette;
  final Strings text;
  final String lang;
  @override
  State<GameScreen> createState() => _GameScreenState();
}

class _GameScreenState extends State<GameScreen> with SingleTickerProviderStateMixin {
  Game game = Game();
  Phase phase = Phase.title;
  int best = host.loadBest();
  bool newBest = false;

  /// The last review's outcome, shown under the card until the next one.
  Outcome? last;

  /// Approved bugs that just hit production, shown for a moment.
  List<Review> incidents = [];
  double incidentTime = 0;

  /// The card being dragged: how far, in pixels.
  double drag = 0;

  /// The card flying off after a decision, and where to.
  Review? flying;
  double flyDir = 0;
  double flyTime = 0;

  late final Ticker ticker;
  Duration previous = Duration.zero;
  late final AppLifecycleListener lifecycle;
  final focus = FocusNode();

  Palette get p => widget.palette;
  Strings get t => widget.text;

  @override
  void initState() {
    super.initState();
    ticker = createTicker(_tick)..start();
    lifecycle = AppLifecycleListener(onHide: _pause, onInactive: _pause);
    _report();
  }

  @override
  void dispose() {
    ticker.dispose();
    lifecycle.dispose();
    focus.dispose();
    super.dispose();
  }

  void _report() => host.report({
        'phase': phase.name,
        'score': game.score,
        'lives': game.lives,
        'reviewed': game.reviewed,
      });

  void _tick(Duration now) {
    final dt = min(0.1, (now - previous).inMicroseconds / 1e6);
    previous = now;
    if (flyTime > 0) flyTime = max(0, flyTime - dt);
    if (incidentTime > 0) incidentTime = max(0, incidentTime - dt);
    if (phase == Phase.playing) {
      final o = game.tick(dt);
      if (o != null) _after(o, 0);
    }
    setState(() {});
  }

  void _start() {
    setState(() {
      game = Game();
      phase = Phase.playing;
      last = null;
      incidents = [];
      newBest = false;
      drag = 0;
    });
    _report();
  }

  void _pause() {
    if (phase != Phase.playing) return;
    setState(() => phase = Phase.paused);
    _report();
  }

  void _decide(Verdict v) {
    if (phase != Phase.playing) return;
    _after(game.decide(v), v == Verdict.approve ? 1 : -1);
  }

  void _after(Outcome o, double dir) {
    last = o;
    flying = o.review;
    flyDir = dir == 0 ? 1 : dir;
    flyTime = 0.3;
    drag = 0;
    final due = game.incidents();
    if (due.isNotEmpty) {
      incidents = due;
      incidentTime = 3;
      HapticFeedback.heavyImpact();
    }
    if (game.over) {
      phase = Phase.over;
      if (game.score > best) {
        best = game.score;
        newBest = true;
        host.saveBest(best);
      }
    }
    _report();
  }

  KeyEventResult _key(FocusNode _, KeyEvent e) {
    if (e is! KeyDownEvent) return KeyEventResult.ignored;
    final k = e.logicalKey;
    if (k == LogicalKeyboardKey.space || k == LogicalKeyboardKey.enter) {
      if (phase == Phase.title || phase == Phase.over) _start();
      if (phase == Phase.paused) setState(() => phase = Phase.playing);
      return KeyEventResult.handled;
    }
    if (k == LogicalKeyboardKey.arrowRight || k == LogicalKeyboardKey.keyD) {
      _decide(Verdict.approve);
      return KeyEventResult.handled;
    }
    if (k == LogicalKeyboardKey.arrowLeft || k == LogicalKeyboardKey.keyA) {
      _decide(Verdict.reject);
      return KeyEventResult.handled;
    }
    if (k == LogicalKeyboardKey.keyP || k == LogicalKeyboardKey.escape) {
      if (phase == Phase.playing) {
        _pause();
      } else if (phase == Phase.paused) {
        setState(() => phase = Phase.playing);
      }
      return KeyEventResult.handled;
    }
    return KeyEventResult.ignored;
  }

  void _tap() {
    focus.requestFocus();
    if (phase == Phase.title || phase == Phase.over) _start();
    if (phase == Phase.paused) setState(() => phase = Phase.playing);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Focus(
        focusNode: focus,
        autofocus: true,
        onKeyEvent: _key,
        child: DefaultTextStyle.merge(
          // no ligatures: in a code review, == and != must look like what they are
          style: TextStyle(
            color: p.text,
            fontFamily: _font,
            fontFeatures: const [FontFeature.disable('calt'), FontFeature.disable('liga')],
          ),
          child: Column(
            children: [
              _hud(),
              Expanded(
                child: switch (phase) {
                  Phase.title => _overlay(
                      'Code Review Tinder',
                      [t.tagline, t.how],
                      t.start,
                    ),
                  Phase.paused => _overlay(t.paused, const [], t.resume),
                  Phase.over => _overlay(
                      t.down,
                      [
                        t.downText,
                        '${t.reviewed}: ${game.reviewed} · ${t.score}: ${game.score}',
                        if (newBest) t.newBest,
                      ],
                      t.again,
                      danger: true,
                    ),
                  Phase.playing => _table(),
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _hud() {
    final small = TextStyle(color: p.muted, fontSize: 13);
    final strong = TextStyle(color: p.text, fontSize: 13, fontWeight: FontWeight.w700);
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: p.panel,
        border: Border(bottom: BorderSide(color: p.border)),
      ),
      child: Wrap(
        alignment: WrapAlignment.spaceBetween,
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: 16,
        runSpacing: 4,
        children: [
          Row(mainAxisSize: MainAxisSize.min, children: [
            Text('${t.prod} ', style: small),
            for (var i = 0; i < Game.startLives; i++)
              Icon(i < game.lives ? Icons.favorite : Icons.favorite_border, size: 15, color: p.danger),
            if (game.ticking > 0 && phase == Phase.playing)
              Tooltip(
                message: '${game.ticking} ${t.ticking}',
                child: Padding(
                  padding: const EdgeInsets.only(left: 8),
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    Icon(Icons.bug_report, size: 15, color: p.warn),
                    Text('${game.ticking}', style: strong.copyWith(color: p.warn)),
                  ]),
                ),
              ),
          ]),
          Text.rich(TextSpan(children: [
            TextSpan(text: '${t.score} ', style: small),
            TextSpan(text: '${game.score}', style: strong),
          ])),
          Text.rich(TextSpan(children: [
            TextSpan(text: '${t.streak} ', style: small),
            TextSpan(text: '${game.streak} ×${game.multiplier}', style: strong),
          ])),
          Text.rich(TextSpan(children: [
            TextSpan(text: '${t.best} ', style: small),
            TextSpan(text: '$best', style: strong),
          ])),
        ],
      ),
    );
  }

  Widget _overlay(String title, List<String> lines, String hint, {bool danger = false}) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: _tap,
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                danger ? '500' : '+/-',
                style: TextStyle(fontSize: 44, fontWeight: FontWeight.w800, color: danger ? p.danger : p.accent),
              ),
              const SizedBox(height: 8),
              Text(
                title,
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 30, fontWeight: FontWeight.w800, color: danger ? p.danger : p.text),
              ),
              for (final l in lines)
                Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 460),
                    child: Text(l, textAlign: TextAlign.center, style: TextStyle(color: p.muted, height: 1.4)),
                  ),
                ),
              const SizedBox(height: 18),
              Text(hint, textAlign: TextAlign.center, style: TextStyle(color: p.accent, fontWeight: FontWeight.w700)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _table() {
    return LayoutBuilder(builder: (context, box) {
      final width = min(560.0, box.maxWidth - 24);
      return Column(
        children: [
          if (incidentTime > 0) _incidentBar(),
          Expanded(
            child: Center(
              child: SizedBox(
                width: width,
                child: Stack(
                  clipBehavior: Clip.none,
                  alignment: Alignment.center,
                  children: [
                    _draggable(game.current, width),
                    if (flying != null && flyTime > 0) _flyingCard(width),
                  ],
                ),
              ),
            ),
          ),
          _feedback(width),
          _buttons(width),
        ],
      );
    });
  }

  Widget _incidentBar() {
    final r = incidents.first;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      color: p.danger,
      child: Row(children: [
        Icon(Icons.local_fire_department, color: p.bg, size: 18),
        const SizedBox(width: 6),
        Expanded(
          child: Text(
            '${t.incident} · #${r.number} ${r.pr.title}: ${r.pr.why(widget.lang)}',
            style: TextStyle(color: p.bg, fontWeight: FontWeight.w700, fontSize: 13),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ]),
    );
  }

  Widget _draggable(Review r, double width) {
    final tilt = drag / 900;
    return GestureDetector(
      onHorizontalDragUpdate: (d) => setState(() => drag += d.delta.dx),
      onHorizontalDragEnd: (d) {
        final v = d.primaryVelocity ?? 0;
        if (drag > width * 0.28 || v > 900) {
          _decide(Verdict.approve);
        } else if (drag < -width * 0.28 || v < -900) {
          _decide(Verdict.reject);
        } else {
          setState(() => drag = 0);
        }
      },
      child: Transform.translate(
        offset: Offset(drag, 0),
        child: Transform.rotate(angle: tilt, child: _card(r, stamp: drag / (width * 0.28))),
      ),
    );
  }

  Widget _flyingCard(double width) {
    final k = 1 - flyTime / 0.3;
    return IgnorePointer(
      child: Opacity(
        opacity: 1 - k,
        child: Transform.translate(
          offset: Offset(flyDir * k * width * 1.1, 0),
          child: Transform.rotate(angle: flyDir * k * 0.25, child: _card(flying!, stamp: flyDir)),
        ),
      ),
    );
  }

  /// A PR card. [stamp] is -1…1: how strongly to show the "changes" or "approve" stamp while dragging.
  Widget _card(Review r, {double stamp = 0}) {
    final pr = r.pr;
    final s = stamp.clamp(-1.0, 1.0);
    final current = identical(r, game.current);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: p.panel,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: s > 0.15 ? p.ok : (s < -0.15 ? p.danger : p.border),
          width: s.abs() > 0.15 ? 2 : 1,
        ),
        boxShadow: const [BoxShadow(color: Color(0x55000000), blurRadius: 30, offset: Offset(0, 14))],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (current)
            ClipRRect(
              borderRadius: BorderRadius.circular(3),
              child: LinearProgressIndicator(
                value: (game.left / game.limit).clamp(0, 1),
                minHeight: 5,
                backgroundColor: p.raised,
                color: game.left < 2.5 ? p.danger : p.accent,
              ),
            ),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text.rich(
                  TextSpan(children: [
                    TextSpan(text: '#${r.number} ', style: TextStyle(color: p.muted)),
                    TextSpan(text: pr.title, style: const TextStyle(fontWeight: FontWeight.w700)),
                  ]),
                  style: const TextStyle(fontSize: 15),
                ),
              ),
              if (s.abs() > 0.15)
                Row(mainAxisSize: MainAxisSize.min, children: [
                  Icon(s > 0 ? Icons.check : Icons.close, size: 18, color: s > 0 ? p.ok : p.danger),
                  Text(
                    s > 0 ? 'LGTM' : 'NOPE',
                    style: TextStyle(color: s > 0 ? p.ok : p.danger, fontWeight: FontWeight.w800),
                  ),
                ]),
            ],
          ),
          const SizedBox(height: 4),
          Text('${r.author} ${t.opened} · ${pr.file}', style: TextStyle(color: p.muted, fontSize: 12)),
          const SizedBox(height: 10),
          _diff(pr.lines),
        ],
      ),
    );
  }

  Widget _diff(List<String> lines) {
    return LayoutBuilder(builder: (context, box) {
      final longest = lines.map((l) => l.length).reduce(max);
      // JetBrains Mono is 0.6em wide; fit the longest line, between 10 and 15 px
      final size = (box.maxWidth - 20) / (longest * 0.6);
      final fontSize = size.clamp(9.5, 15.0);
      return Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(vertical: 6),
        decoration: BoxDecoration(
          color: p.bg,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: p.border),
        ),
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final l in lines)
                Container(
                  color: l.startsWith('+') ? p.addBg : (l.startsWith('-') ? p.delBg : null),
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 1),
                  constraints: BoxConstraints(minWidth: box.maxWidth - 2),
                  child: Text.rich(
                    TextSpan(children: [
                      TextSpan(
                        text: l.substring(0, 1),
                        style: TextStyle(
                          color: l.startsWith('+') ? p.ok : (l.startsWith('-') ? p.danger : p.muted),
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      TextSpan(text: l.substring(1)),
                    ]),
                    style: TextStyle(fontSize: fontSize, height: 1.45),
                    softWrap: false,
                  ),
                ),
            ],
          ),
        ),
      );
    });
  }

  Widget _feedback(double width) {
    final o = last;
    if (o == null) return const SizedBox(height: 52);
    // icons rather than ✓ and ✗, which aren't in the bundled font (Flutter would fetch a fallback font for them)
    final (label, color, icon) = switch (o.result) {
      Result.caught => (t.caught, p.ok, Icons.check),
      Result.shipped => (t.shipped, p.ok, Icons.check),
      Result.blocked => (t.blocked, p.danger, Icons.close),
      Result.slipped => (t.slipped, p.warn, Icons.hourglass_bottom),
    };
    return SizedBox(
      width: width,
      height: 52,
      child: Padding(
        padding: const EdgeInsets.only(top: 8),
        child: Text.rich(
          TextSpan(children: [
            WidgetSpan(
              alignment: PlaceholderAlignment.middle,
              child: Padding(
                padding: const EdgeInsets.only(right: 4),
                child: Icon(o.timedOut ? Icons.timer_off : icon, size: 16, color: o.timedOut ? p.warn : color),
              ),
            ),
            TextSpan(
              text: o.timedOut ? '${t.lgtm}. ' : '$label${o.points > 0 ? ' +${o.points}' : ''}. ',
              style: TextStyle(color: o.timedOut ? p.warn : color, fontWeight: FontWeight.w700),
            ),
            // what the slipped bug was stays a secret until it hits production
            if (o.result != Result.slipped) TextSpan(text: o.review.pr.why(widget.lang), style: TextStyle(color: p.muted)),
          ]),
          style: const TextStyle(fontSize: 13),
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
      ),
    );
  }

  Widget _buttons(double width) {
    Widget button(String label, IconData icon, Color color, Verdict v) => Expanded(
          child: OutlinedButton.icon(
            onPressed: () {
              focus.requestFocus();
              _decide(v);
            },
            icon: Icon(icon, color: color),
            label: Text(label, style: TextStyle(color: p.text, fontWeight: FontWeight.w700)),
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 14),
              side: BorderSide(color: color, width: 1.5),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
        );
    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 4, 12, 14),
      child: SizedBox(
        width: width,
        child: Row(children: [
          button('← ${t.reject}', Icons.close, p.danger, Verdict.reject),
          const SizedBox(width: 12),
          button('${t.approve} →', Icons.check, p.ok, Verdict.approve),
        ]),
      ),
    );
  }
}
