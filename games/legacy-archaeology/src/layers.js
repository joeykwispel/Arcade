// The layers of legacy PHP. Each is a file whose output must never change: dig out (delete) as many lines as you can
// without breaking it. The page never looks at `dig`: it runs every attempt in real PHP (php-wasm) and compares the
// output. The tests check, with the same PHP, that `dig` (the lines that can go) keeps the output, and that nothing
// more can.

export const LAYERS = [
  {
    year: 2009,
    title: { en: 'The shop, 2009', nl: 'De webshop, 2009' },
    code: [
      '<?php',
      '// TODO: remove before launch (2009)',
      '$debug = false;',
      'function old_price($p) { return $p * 1.19; } // unused since 2011',
      '$items = [10, 20, 12];',
      '$total = 0;',
      'foreach ($items as $i) {',
      '    $total += $i;',
      '}',
      "// $total = $total * 2; // Kevin's fix, reverted",
      'if ($debug) { echo "DEBUG\\n"; }',
      'echo "Total: $total\\n";'
    ],
    dig: [1, 3, 9, 10, 2]
  },
  {
    year: 2012,
    title: { en: 'The greeting, 2012', nl: 'De begroeting, 2012' },
    code: [
      '<?php',
      '$user = "Ada";',
      '$greeting = "Hello";',
      '/* disabled in 2012:',
      '$greeting = "Howdy";',
      '*/',
      '$unused = strtoupper($user);',
      'echo "$greeting, $user!\\n";',
      '// echo "Beta banner";',
      '$count = 3; // do not touch, used below',
      'echo str_repeat("*", $count), "\\n";',
      '?>'
    ],
    dig: [3, 4, 5, 6, 8, 11]
  },
  {
    year: 2008,
    title: { en: 'The load-bearing comment, 2008', nl: 'Het dragende commentaar, 2008' },
    code: [
      '<?php',
      '$name = "total";',
      '$$name = 0; // variable variables, 2008',
      'for ($i = 1; $i <= 3; $i++) { $total += $i; }',
      '# goto end; // tried this once',
      '$legacy = true; // DO NOT REMOVE: nobody knows why',
      'if (!isset($legacy)) { $total = -1; }',
      'echo "Sum: $total\\n";',
      'function never_called() { return 42; }',
      'echo "Done\\n";'
    ],
    dig: [4, 6, 5, 8]
  }
];

/** The fewest lines a layer can keep. */
export const minimum = (layer) => layer.code.length - layer.dig.length;

/** Points for every line dug out, and for leaving a layer at its minimum. */
export const LINE_POINTS = 10;
export const CLEAN_BONUS = 50;
export const LIVES = 3;

/** The file with some lines removed (`gone`: a Set of line indexes). */
export const source = (layer, gone) => layer.code.filter((_, i) => !gone.has(i)).join('\n');

/**
 * Runs PHP and returns everything it printed, errors included: a warning about an undefined variable is a change in
 * output too. `load` makes a php-wasm PHP instance; a fatal error (a parse error, say) leaves that instance unusable,
 * so the next run starts a fresh one.
 */
export class Runner {
  constructor(load) {
    this.load = load;
    this.php = null;
  }

  async run(code) {
    this.php ??= await this.load();
    try {
      const r = await this.php.run({ code });
      return r.text + (r.errors ? `\n[${r.errors.trim()}]` : '');
    } catch (e) {
      try {
        this.php.exit?.();
      } catch {
        /* already gone */
      }
      this.php = null;
      // the first line of the error, without the file name, so the same mistake always reads the same
      const message = (e instanceof Error ? e.message : String(e)).split('\n')[0].replace(/ in \S+ on line/, ' on line');
      return `[fatal] ${message}`;
    }
  }
}
