// Builds Rubber Duck Therapy into dist/: shadow-cljs compiles the ClojureScript (Closure advanced optimizations)
// into dist/js/main.js, then the static files from public/ and the font go next to it. Needs Java 21 (JAVA_HOME).
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';

rmSync('dist', { recursive: true, force: true });
execSync('npx shadow-cljs release app', { stdio: 'inherit' });
cpSync('public', 'dist', { recursive: true });
mkdirSync('dist/fonts', { recursive: true });
cpSync('node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2', 'dist/fonts/jetbrains-mono.woff2');
console.log('Rubber Duck Therapy built into dist/');
