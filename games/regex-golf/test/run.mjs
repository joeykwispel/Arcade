// Runs the Ruby tests with the same ruby.wasm the page uses, in Node: no Ruby install needed.
import { readFile } from 'node:fs/promises';
import { WASI } from 'node:wasi';
import { RubyVM } from '@ruby/wasm-wasi';

const wasm = await readFile(new URL('../node_modules/@ruby/3.4-wasm-wasi/dist/ruby.wasm', import.meta.url));
const module = await WebAssembly.compile(wasm);
const wasi = new WASI({ version: 'preview1', returnOnExit: true });
const { vm } = await RubyVM.instantiateModule({ module, wasip1: wasi });

vm.eval(await readFile(new URL('../ruby/golf.rb', import.meta.url), 'utf8'));
const result = vm.eval(await readFile(new URL('../ruby/golf_test.rb', import.meta.url), 'utf8')).toString();
console.log(`Regex Golf rules: ${result}`);
if (result.includes('FAIL')) process.exit(1);
