// Builds Git Blame Detective into dist/: js_of_ocaml (through dune) compiles the OCaml in lib/ and bin/ to
// _build/default/bin/main.bc.js, then Vite builds the page around it. Needs OCaml with dune and js_of_ocaml (opam);
// on Windows without them, this uses an earlier compile if there is one (made in WSL), and says so.
// `node build.mjs --test` runs the OCaml tests instead (dune test).
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });
const dune = (args) => run(`opam exec -- dune ${args}`);

if (process.argv.includes('--test')) {
  dune('test');
  process.exit(0);
}

try {
  dune('build --profile release bin/main.bc.js');
} catch (err) {
  const compiled = existsSync('_build/default/bin/main.bc.js');
  if (process.platform !== 'win32' || !compiled) throw err;
  console.warn('\nno opam/dune here; using the earlier compile in _build/ (made in WSL).\n');
}
run('npx vite build');
