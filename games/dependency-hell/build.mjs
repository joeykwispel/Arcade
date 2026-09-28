// Builds Dependency Hell into dist/:
//   1. fetches Box2D v3.1.1 (the physics engine, MIT) into vendor/ if it isn't there yet
//   2. compiles Box2D and the game (C++) to WebAssembly with Emscripten, into web/build/
//   3. Vite builds the page around it (web/main.js draws; the C++ decides)
// Needs Emscripten (emcc/em++ on the PATH, e.g. via emsdk). `node build.mjs --test` compiles the tests and runs them in Node.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';

const BOX2D = 'v3.1.1';
const run = (cmd) => execSync(cmd, { stdio: 'inherit' });
const test = process.argv.includes('--test');

if (!existsSync('vendor/box2d')) {
  mkdirSync('vendor', { recursive: true });
  run(`git clone --quiet --depth 1 --branch ${BOX2D} https://github.com/erincatto/box2d.git vendor/box2d`);
}

// Box2D is C; its SIMD path is off for a plain, portable WebAssembly build
const box2d = readdirSync('vendor/box2d/src')
  .filter((f) => f.endsWith('.c'))
  .map((f) => `vendor/box2d/src/${f}`);
const flags = '-O2 -DNDEBUG -DBOX2D_DISABLE_SIMD -Ivendor/box2d/include -Ivendor/box2d/src';
const objects = [];
mkdirSync('vendor/obj', { recursive: true });
for (const src of box2d) {
  const obj = `vendor/obj/${src.split('/').pop().replace(/\.c$/, '.o')}`;
  if (!existsSync(obj)) run(`emcc ${flags} -std=gnu17 -c ${src} -o ${obj}`);
  objects.push(obj);
}

if (test) {
  mkdirSync('build-test', { recursive: true });
  run(`em++ ${flags} -std=c++20 -fexceptions -sENVIRONMENT=node -sEXIT_RUNTIME=1 tests/test.cpp src/game.cpp ${objects.join(' ')} -o build-test/test.cjs`);
  run('node build-test/test.cjs');
  process.exit(0);
}

mkdirSync('web/build', { recursive: true });
const exported = [
  'new',
  'start',
  'pause',
  'input',
  'update',
  'phase',
  'crane_x',
  'crane_y',
  'current',
  'current_rotated',
  'next',
  'ready',
  'height',
  'best',
  'fallen',
  'max_fallen',
  'stacked',
  'platform_half',
  'unpublished',
  'kinds',
  'kind_name',
  'kind_w',
  'kind_h',
  'frame',
  'frame_ptr'
].map((n) => `_dh_${n}`);
run(
  [
    `em++ ${flags} -std=c++20 src/game.cpp src/api.cpp ${objects.join(' ')}`,
    '-o web/build/dh.mjs',
    '-sMODULARIZE=1 -sEXPORT_ES6=1 -sENVIRONMENT=web -sALLOW_MEMORY_GROWTH=1',
    // no eval at runtime, so the page keeps a strict Content-Security-Policy
    '-sDYNAMIC_EXECUTION=0 -sFILESYSTEM=0 --no-entry',
    `-sEXPORTED_FUNCTIONS=${exported.join(',')}`,
    '-sEXPORTED_RUNTIME_METHODS=UTF8ToString,HEAPF32'
  ].join(' ')
);
run('npx vite build');
