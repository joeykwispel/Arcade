// Builds Kernel Panic Pinball into dist/: dotnet publishes the Blazor WebAssembly app (with the C# physics in
// Pinball.Core), and its wwwroot becomes the game. Needs the .NET 10 SDK (`dotnet` on the PATH).
// `node build.mjs --test` runs the xUnit tests instead.
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync } from 'node:fs';

const run = (cmd) => execSync(cmd, { stdio: 'inherit', env: { ...process.env, DOTNET_CLI_TELEMETRY_OPTOUT: '1', DOTNET_NOLOGO: '1' } });

if (process.argv.includes('--test')) {
  run('dotnet test Pinball.Tests');
  process.exit(0);
}

rmSync('out', { recursive: true, force: true });
rmSync('dist', { recursive: true, force: true });
run('dotnet publish Pinball.Web -c Release -o out');
cpSync('out/wwwroot', 'dist', { recursive: true });
mkdirSync('dist/fonts', { recursive: true });
cpSync('node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2', 'dist/fonts/jetbrains-mono.woff2');
console.log('Kernel Panic Pinball built into dist/');
