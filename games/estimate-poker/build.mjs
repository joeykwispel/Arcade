// Builds Estimate Poker into dist/: Fable compiles the F# in src/ to JavaScript in build/, then Vite builds the
// page. Needs the .NET 10 SDK; Fable itself is a local dotnet tool (dotnet-tools.json), restored here.
// `node build.mjs --test` runs the rules tests on .NET instead (tests/, xUnit).
import { execSync } from 'node:child_process';
import { cpSync, rmSync } from 'node:fs';

const env = { ...process.env, DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_NOLOGO: '1' };
const run = (cmd) => execSync(cmd, { stdio: 'inherit', env });

if (process.argv.includes('--test')) {
  run('dotnet test tests');
  process.exit(0);
}

rmSync('build', { recursive: true, force: true });
run('dotnet tool restore');
run('dotnet fable src -o build');
// Main.fs imports ./host.js next to itself
cpSync('src/host.js', 'build/host.js');
run('npx vite build');
