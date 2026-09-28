/// The pull requests to review. Each is a small diff that is either fine or has a real bug in it, with a one-line
/// explanation in English and Dutch that is shown after you decide. A few clean ones look suspicious on purpose.
library;

class PullRequest {
  const PullRequest({
    required this.title,
    required this.file,
    required this.lines,
    required this.buggy,
    required this.en,
    required this.nl,
  });

  /// The PR title, as developers write them (in English, in both languages).
  final String title;
  final String file;

  /// Diff lines, each starting with '+', '-' or ' '.
  final List<String> lines;

  /// Whether merging this breaks something.
  final bool buggy;

  /// What is wrong with it, or why it is fine.
  final String en;
  final String nl;

  String why(String lang) => lang == 'nl' ? nl : en;
}

const pullRequests = <PullRequest>[
  // ---------- buggy ----------
  PullRequest(
    title: 'feat: show all items on one page',
    file: 'pagination.js',
    lines: [
      ' function render(items) {',
      '-  for (let i = 0; i < items.length; i++) {',
      '+  for (let i = 0; i <= items.length; i++) {',
      '     draw(items[i]);',
      '   }',
      ' }',
    ],
    buggy: true,
    en: 'Off by one: <= reads one item past the end.',
    nl: 'Off-by-one: <= leest één item voorbij het einde.',
  ),
  PullRequest(
    title: 'fix: guests can see the dashboard',
    file: 'auth.js',
    lines: [
      ' function canSee(user) {',
      '-  if (user == null) return false;',
      '+  if (user = null) return false;',
      '   return user.role === "admin";',
      ' }',
    ],
    buggy: true,
    en: '= assigns instead of compares: user is now always null.',
    nl: '= kent toe in plaats van te vergelijken: user is nu altijd null.',
  ),
  PullRequest(
    title: 'refactor: default bucket',
    file: 'cart.py',
    lines: [
      '-def add(item, bucket=None):',
      '-    bucket = bucket or []',
      '+def add(item, bucket=[]):',
      '     bucket.append(item)',
      '     return bucket',
    ],
    buggy: true,
    en: 'A mutable default: every call shares the same list.',
    nl: 'Een muteerbare default: elke aanroep deelt dezelfde lijst.',
  ),
  PullRequest(
    title: 'perf: simpler user lookup',
    file: 'users.js',
    lines: [
      '-const user = await db.query(',
      '-  "SELECT * FROM users WHERE id = \$1", [req.params.id]);',
      '+const user = await db.query(',
      '+  "SELECT * FROM users WHERE id = " + req.params.id);',
    ],
    buggy: true,
    en: 'SQL injection: the id is pasted straight into the query.',
    nl: 'SQL-injectie: het id wordt zo in de query geplakt.',
  ),
  PullRequest(
    title: 'chore: drop unneeded await',
    file: 'profile.ts',
    lines: [
      ' async function name(id: string) {',
      '-  const user = await fetchUser(id);',
      '+  const user = fetchUser(id);',
      '   return user.name;',
      ' }',
    ],
    buggy: true,
    en: 'Without await, user is a Promise, and user.name is undefined.',
    nl: 'Zonder await is user een Promise, en user.name undefined.',
  ),
  PullRequest(
    title: 'feat: payments in production',
    file: 'config.js',
    lines: [
      '-const API_KEY = process.env.STRIPE_KEY;',
      '+const API_KEY = "sk_live_51HxQ2vK8Tq9";',
      ' export const stripe = new Stripe(API_KEY);',
    ],
    buggy: true,
    en: 'A live secret key committed to the repo.',
    nl: 'Een live secret key in de repo gecommit.',
  ),
  PullRequest(
    title: 'style: tidy up the loop',
    file: 'retry.js',
    lines: [
      ' let i = 0;',
      ' while (i < 3) {',
      '   tryConnect();',
      '-  i++;',
      ' }',
    ],
    buggy: true,
    en: 'Without i++ the loop never ends.',
    nl: 'Zonder i++ stopt de lus nooit.',
  ),
  PullRequest(
    title: 'refactor: use the default sort',
    file: 'scores.js',
    lines: [
      ' const scores = [10, 9, 100, 25];',
      '-scores.sort((a, b) => a - b);',
      '+scores.sort();',
    ],
    buggy: true,
    en: 'sort() without a compare sorts as text: 10, 100, 25, 9.',
    nl: 'sort() zonder vergelijking sorteert als tekst: 10, 100, 25, 9.',
  ),
  PullRequest(
    title: 'chore: less error handling noise',
    file: 'load.go',
    lines: [
      '-data, err := os.ReadFile(path)',
      '-if err != nil {',
      '-    return nil, err',
      '-}',
      '+data, _ := os.ReadFile(path)',
      ' return parse(data), nil',
    ],
    buggy: true,
    en: 'The error is thrown away: a missing file parses as empty.',
    nl: 'De fout wordt weggegooid: een ontbrekend bestand wordt leeg geparsed.',
  ),
  PullRequest(
    title: 'feat: parse the age field',
    file: 'form.rs',
    lines: [
      ' fn age(input: &str) -> u32 {',
      '-    input.trim().parse().unwrap_or(0)',
      '+    input.parse().unwrap()',
      ' }',
    ],
    buggy: true,
    en: 'unwrap() on user input: "abc" or " 42" crashes the server.',
    nl: 'unwrap() op gebruikersinvoer: "abc" of " 42" laat de server crashen.',
  ),
  PullRequest(
    title: 'refactor: remove redundant check',
    file: 'orders.js',
    lines: [
      ' function ship(order) {',
      '-  if (!order) return;',
      '   order.items.forEach(send);',
      ' }',
    ],
    buggy: true,
    en: 'The check was not redundant: ship(null) now throws.',
    nl: 'De check was niet overbodig: ship(null) gooit nu een fout.',
  ),
  PullRequest(
    title: 'debug: log failed logins',
    file: 'login.js',
    lines: [
      ' if (!ok) {',
      '+  console.log("login failed", email, password);',
      '   return res.status(401).end();',
      ' }',
    ],
    buggy: true,
    en: 'Passwords end up in the logs.',
    nl: 'Wachtwoorden komen in de logs terecht.',
  ),
  PullRequest(
    title: 'ci: clean before build',
    file: 'deploy.sh',
    lines: [
      ' #!/bin/sh',
      '+rm -rf "\$BUILD_DIR"/*',
      ' npm run build',
    ],
    buggy: true,
    en: 'If BUILD_DIR is empty, this runs rm -rf /*.',
    nl: 'Als BUILD_DIR leeg is, wordt dit rm -rf /*.',
  ),
  PullRequest(
    title: 'feat: confirm dialog',
    file: 'Confirm.java',
    lines: [
      ' String input = scanner.nextLine();',
      '-if (input.equals("yes")) {',
      '+if (input == "yes") {',
      '     delete(account);',
      ' }',
    ],
    buggy: true,
    en: '== compares references in Java, not the text.',
    nl: '== vergelijkt in Java referenties, niet de tekst.',
  ),
  PullRequest(
    title: 'fix: flaky cache test',
    file: 'cache.test.js',
    lines: [
      '-test("expires after a minute", async () => {',
      '+test.skip("expires after a minute", async () => {',
      '   await clock.tick(60_000);',
      '   expect(cache.get("a")).toBeUndefined();',
    ],
    buggy: true,
    en: 'Skipping a flaky test hides the bug instead of fixing it.',
    nl: 'Een flaky test overslaan verstopt de bug in plaats van hem te fixen.',
  ),

  // ---------- clean ----------
  PullRequest(
    title: 'refactor: name the magic number',
    file: 'time.js',
    lines: [
      '-const d = 86400;',
      '+const SECONDS_PER_DAY = 86400;',
      '-return seconds / d;',
      '+return seconds / SECONDS_PER_DAY;',
    ],
    buggy: false,
    en: 'Just a rename: same behaviour, clearer code.',
    nl: 'Alleen een rename: hetzelfde gedrag, duidelijkere code.',
  ),
  PullRequest(
    title: 'fix: empty list crashes the chart',
    file: 'chart.js',
    lines: [
      ' function maxOf(values) {',
      '+  if (values.length === 0) return 0;',
      '   return Math.max(...values);',
      ' }',
    ],
    buggy: false,
    en: 'A sensible guard: Math.max() of nothing is -Infinity.',
    nl: 'Een goede guard: Math.max() van niets is -Infinity.',
  ),
  PullRequest(
    title: 'fix: sum 1 to n',
    file: 'math.js',
    lines: [
      ' let sum = 0;',
      '-for (let i = 1; i < n; i++) sum += i;',
      '+for (let i = 1; i <= n; i++) sum += i;',
    ],
    buggy: false,
    en: 'Looks like an off-by-one, but <= is right: 1 to n includes n.',
    nl: 'Lijkt een off-by-one, maar <= klopt: 1 t/m n telt n mee.',
  ),
  PullRequest(
    title: 'refactor: close the file properly',
    file: 'report.py',
    lines: [
      '-f = open(path)',
      '-data = f.read()',
      '-f.close()',
      '+with open(path) as f:',
      '+    data = f.read()',
    ],
    buggy: false,
    en: 'with closes the file, even when read() fails.',
    nl: 'with sluit het bestand, ook als read() faalt.',
  ),
  PullRequest(
    title: 'fix: handle read errors',
    file: 'load.go',
    lines: [
      '-data, _ := os.ReadFile(path)',
      '+data, err := os.ReadFile(path)',
      '+if err != nil {',
      '+    return nil, err',
      '+}',
    ],
    buggy: false,
    en: 'The error is returned instead of ignored.',
    nl: 'De fout wordt teruggegeven in plaats van genegeerd.',
  ),
  PullRequest(
    title: 'security: parameterise the query',
    file: 'users.js',
    lines: [
      '-db.query("SELECT * FROM users WHERE id = " + id);',
      '+db.query("SELECT * FROM users WHERE id = \$1", [id]);',
    ],
    buggy: false,
    en: 'A parameterised query: no more SQL injection.',
    nl: 'Een geparametriseerde query: geen SQL-injectie meer.',
  ),
  PullRequest(
    title: "fix: don't crash on bad input",
    file: 'form.rs',
    lines: [
      '-fn age(input: &str) -> u32 {',
      '-    input.parse().unwrap()',
      '+fn age(input: &str) -> Result<u32, ParseIntError> {',
      '+    input.trim().parse()',
      ' }',
    ],
    buggy: false,
    en: 'The caller gets a Result instead of a panic.',
    nl: 'De aanroeper krijgt een Result in plaats van een panic.',
  ),
  PullRequest(
    title: 'a11y: visible focus on buttons',
    file: 'buttons.css',
    lines: [
      ' button:focus-visible {',
      '+  outline: 2px solid var(--accent);',
      '+  outline-offset: 2px;',
      ' }',
    ],
    buggy: false,
    en: 'Keyboard users can see where they are. Ship it.',
    nl: 'Toetsenbordgebruikers zien waar ze zijn. Shippen.',
  ),
  PullRequest(
    title: 'fix: wait for the user',
    file: 'profile.ts',
    lines: [
      ' async function name(id: string) {',
      '-  const user = fetchUser(id);',
      '+  const user = await fetchUser(id);',
      '   return user.name;',
      ' }',
    ],
    buggy: false,
    en: 'The missing await is added.',
    nl: 'De ontbrekende await is toegevoegd.',
  ),
  PullRequest(
    title: 'chore: bump left-pad',
    file: 'package.json',
    lines: [
      ' "dependencies": {',
      '-  "left-pad": "1.1.0"',
      '+  "left-pad": "1.3.0"',
      ' }',
    ],
    buggy: false,
    en: 'A patch-level bump. Boring, which is good.',
    nl: 'Een patch-update. Saai, en dat is goed.',
  ),
  PullRequest(
    title: 'style: strict equality',
    file: 'filters.js',
    lines: [
      '-if (status == "active") {',
      '+if (status === "active") {',
      '   show(item);',
      ' }',
    ],
    buggy: false,
    en: '=== avoids type coercion surprises.',
    nl: '=== voorkomt verrassingen door type-conversie.',
  ),
  PullRequest(
    title: 'chore: remove debug logging',
    file: 'checkout.js',
    lines: [
      ' const total = sum(cart);',
      '-console.log("TOTAL!!!", total);',
      ' return total;',
    ],
    buggy: false,
    en: 'Removes a leftover console.log.',
    nl: 'Haalt een vergeten console.log weg.',
  ),
  PullRequest(
    title: 'fix: retry loop never stopped',
    file: 'retry.js',
    lines: [
      ' while (i < 3) {',
      '   tryConnect();',
      '+  i++;',
      ' }',
    ],
    buggy: false,
    en: 'The counter now goes up, so the loop ends.',
    nl: 'De teller loopt nu op, dus de lus stopt.',
  ),
  PullRequest(
    title: 'fix: dates in the past',
    file: 'Booking.java',
    lines: [
      ' LocalDate day = form.getDate();',
      '-if (day.isAfter(LocalDate.now())) {',
      '+if (!day.isBefore(LocalDate.now())) {',
      '     book(day);',
      ' }',
    ],
    buggy: false,
    en: 'Double negative, but right: today can now be booked too.',
    nl: 'Dubbele ontkenning, maar het klopt: vandaag is nu ook te boeken.',
  ),
  PullRequest(
    title: 'test: cover the empty cart',
    file: 'cart.test.js',
    lines: [
      '+test("an empty cart costs nothing", () => {',
      '+  expect(total([])).toBe(0);',
      '+});',
    ],
    buggy: false,
    en: 'A new test. Nobody has ever regretted one of those.',
    nl: 'Een nieuwe test. Daar heeft nog nooit iemand spijt van gehad.',
  ),
];

/// Who opened the PR.
const authors = [
  '@intern', '@10x-dev', '@cto', '@dependabot', '@friday-deployer', '@rubber-duck', '@yolo-merge', '@senior-dev',
  '@copilot-ish', '@legacy-larry', '@night-owl', '@hotfix-hannah',
];
