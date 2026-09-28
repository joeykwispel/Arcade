// Builds the game into dist/ for the hub:
//   1. Gradle compiles the Kotlin to JavaScript (Kotlin/JS + webpack): ./gradlew jsBrowserDistribution
//   2. the output, the font and the favicon are copied into dist/
// Needs a JDK 21 (JAVA_HOME). `node build.mjs --test` runs the tests on the JVM instead.
import { execSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

const gradlew = process.platform === 'win32' ? `"${resolve('gradlew.bat')}"` : './gradlew';
const gradle = (task) => execSync(`${gradlew} ${task} --console=plain --no-daemon`, { stdio: 'inherit' });

if (process.argv.includes('--test')) {
  gradle('jvmTest');
  process.exit(0);
}

gradle('jsBrowserDistribution');

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
cpSync('build/dist/js/productionExecutable', 'dist', { recursive: true });
copyFileSync('node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2', 'dist/jetbrains-mono.woff2');
copyFileSync('favicon.svg', 'dist/favicon.svg');
console.log('Standup Survivor built into dist/');
