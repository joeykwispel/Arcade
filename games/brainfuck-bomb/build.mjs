// Builds the Brainf*ck Bomb Defuser into dist/: wabt (from npm) assembles the hand-written src/bf.wat into bf.wasm,
// then Vite builds the page. `node build.mjs --wasm` only assembles the module (the tests need it).
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import initWabt from 'wabt';

const wabt = await initWabt();
const mod = wabt.parseWat('bf.wat', readFileSync('src/bf.wat', 'utf8'), { bulk_memory: true });
mod.validate();
const { buffer } = mod.toBinary({});
writeFileSync('src/bf.wasm', buffer);
console.log(`bf.wat → bf.wasm, ${buffer.length} bytes`);

if (!process.argv.includes('--wasm')) execSync('npx vite build', { stdio: 'inherit' });
