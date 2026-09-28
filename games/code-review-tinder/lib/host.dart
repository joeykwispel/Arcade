/// The browser around the game: the language and theme from the arcade, the best score, and a few data attributes on
/// `<body>` for the end-to-end tests (Flutter draws on a canvas, so there is no DOM to look at otherwise).
library;

import 'dart:js_interop';

import 'package:web/web.dart' as web;

const _bestKey = 'play:code-review-tinder:best';

/// The language from ?lang=, or the browser's.
String initialLang() {
  final p = Uri.base.queryParameters['lang'];
  if (p == 'en' || p == 'nl') return p!;
  return web.window.navigator.language.startsWith('nl') ? 'nl' : 'en';
}

/// Dark unless the site says light: the arcade page around the frame, its jo-theme cookie, or localStorage.
/// Flutter starts a few seconds after the frame has loaded, so the arcade's first settings message is usually
/// missed; the arcade is the same origin, so its current theme can be read directly instead.
bool initialDark() {
  final arcade = web.window.frameElement?.ownerDocument?.documentElement?.getAttribute('data-theme');
  final cookie = RegExp(r'(?:^|; )jo-theme=(dark|light)').firstMatch(web.document.cookie)?.group(1);
  String? stored;
  try {
    stored = web.window.localStorage.getItem('theme');
  } catch (_) {}
  return (arcade ?? cookie ?? stored) != 'light';
}

/// Follow the arcade: it sends {type: 'play:settings', lang, theme} when either changes.
void followHub({required void Function(String lang) onLang, required void Function(bool dark) onDark}) {
  web.window.addEventListener(
    'message',
    (web.MessageEvent e) {
      if (e.origin != web.window.location.origin) return;
      final data = e.data.dartify();
      if (data is! Map || data['type'] != 'play:settings') return;
      final lang = data['lang'];
      if (lang == 'en' || lang == 'nl') onLang(lang as String);
      final theme = data['theme'];
      if (theme == 'light' || theme == 'dark') onDark(theme == 'dark');
    }.toJS,
  );
  web.window.addEventListener(
    'storage',
    (web.StorageEvent e) {
      if (e.key == 'theme') onDark(e.newValue != 'light');
    }.toJS,
  );
}

/// State for the end-to-end tests, as data attributes on `<body>`.
void report(Map<String, Object> state) {
  final body = web.document.body;
  if (body == null) return;
  state.forEach((k, v) => body.setAttribute('data-$k', '$v'));
}

int loadBest() {
  try {
    return int.tryParse(web.window.localStorage.getItem(_bestKey) ?? '') ?? 0;
  } catch (_) {
    return 0;
  }
}

void saveBest(int n) {
  try {
    web.window.localStorage.setItem(_bestKey, '$n');
  } catch (_) {}
}
