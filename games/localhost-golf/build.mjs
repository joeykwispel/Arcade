// Builds Localhost Golf with Godot into dist/: a single-threaded web export (GitHub Pages can't send the headers that
// Godot's threaded build needs), with our own HTML shell and a strict CSP.
//
//   GODOT            the Godot 4.7 binary (default: `godot` on the PATH)
//   GODOT_TEMPLATES  the folder with web_nothreads_release.zip (default: Godot's own export_templates folder)
//
// `node build.mjs --test` runs the rules tests headless instead.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const VERSION = '4.7.2.stable';
const godot = process.env.GODOT ?? 'godot';
const run = (...args) => execFileSync(godot, ['--headless', '--path', '.', ...args], { stdio: 'inherit' });

// Godot needs its import cache before it can run scripts or export
run('--import');

if (process.argv.includes('--test')) {
  run('--script', 'res://tests/run_tests.gd');
  process.exit(0);
}

const templates =
  process.env.GODOT_TEMPLATES ??
  (process.platform === 'win32'
    ? join(process.env.APPDATA ?? '', 'Godot', 'export_templates', VERSION)
    : join(homedir(), '.local', 'share', 'godot', 'export_templates', VERSION));
const template = join(templates, 'web_nothreads_release.zip').replace(/\\/g, '/');
if (!existsSync(template)) throw new Error(`No Godot web template at ${template} (set GODOT_TEMPLATES)`);

// the export preset, written here so it can point at the template wherever it is
writeFileSync(
  'export_presets.cfg',
  `[preset.0]

name="Web"
platform="Web"
runnable=true
export_filter="all_resources"
include_filter=""
exclude_filter="tests/*"
export_path="dist/index.html"

[preset.0.options]

custom_template/debug=""
custom_template/release="${template}"
variant/extensions_support=false
variant/thread_support=false
vram_texture_compression/for_desktop=true
vram_texture_compression/for_mobile=false
html/export_icon=false
html/custom_html_shell="res://shell/shell.html"
html/head_include=""
html/canvas_resize_policy=2
html/focus_canvas_on_start=true
html/experimental_virtual_keyboard=false
progressive_web_app/enabled=false
`
);

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist');
run('--export-release', 'Web', 'dist/index.html');
for (const f of ['boot.js', 'shell.css', 'favicon.svg']) cpSync(`web/${f}`, `dist/${f}`);
console.log('Localhost Golf built into dist/');
