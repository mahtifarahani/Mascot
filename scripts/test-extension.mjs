import { build } from 'esbuild';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync, spawn } from 'node:child_process';

await build({ entryPoints: ['src/extension/smoke.ts'], outfile: 'dist/extension-test.cjs', bundle: true, platform: 'node', format: 'cjs', external: ['vscode'], target: 'node20' });
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const temp = await mkdtemp(join(tmpdir(), 'clawcoon-extension-smoke-'));
await mkdir(join(temp, 'editor', 'User'), { recursive: true });
await mkdir(join(temp, 'project'));
await writeFile(join(temp, 'editor', 'User', 'settings.json'), JSON.stringify({ 'update.mode': 'none', 'extensions.autoUpdate': false, 'extensions.autoCheckUpdates': false, 'security.workspace.trust.enabled': false, 'window.restoreWindows': 'none', 'telemetry.telemetryLevel': 'off' }));
const executable = '/Applications/Visual Studio Code.app/Contents/MacOS/Code';
const env = { ...process.env, CLAWCOON_TEST_ROOT: join(temp, 'data') };
for (const key of Object.keys(env)) if (/^(ANTHROPIC_|CLAUDE|CLAWCOON_ROOT|CLAWCOON_ACCOUNT_ID|VSCODE_|ELECTRON_RUN_AS_NODE|NODE_OPTIONS)/.test(key) && key !== 'CLAWCOON_TEST_ROOT') delete env[key];
try {
  let extensionPath = resolve('.');
  if (process.argv.includes('--packaged')) {
    execFileSync(executable, ['/Applications/Visual Studio Code.app/Contents/Resources/app/out/cli.js', '--user-data-dir', join(temp, 'editor'), '--extensions-dir', join(temp, 'extensions'), '--install-extension', resolve(`artifacts/mascot-${version}.vsix`)], { env: { ...env, ELECTRON_RUN_AS_NODE: '1' }, timeout: 30_000, stdio: 'pipe' });
    const installed = (await readdir(join(temp, 'extensions'))).find(name => name.startsWith('clawcoon.clawcoon-'));
    if (!installed) throw new Error('The packaged extension was not installed in its temporary directory.');
    extensionPath = join(temp, 'extensions', installed);
  }
  const child = spawn(executable, ['--user-data-dir', join(temp, 'editor'), '--extensions-dir', join(temp, 'extensions'), '--disable-extensions', '--skip-welcome', '--skip-release-notes', '--extensionDevelopmentPath=' + extensionPath, '--extensionTestsPath=' + resolve('dist/extension-test.cjs'), join(temp, 'project')], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  let diagnostics = '';
  child.stdout.on('data', data => { output += data; });
  child.stderr.on('data', data => { diagnostics += data; });
  const timer = setTimeout(() => child.kill('SIGTERM'), 60_000);
  let code;
  try { code = await new Promise((resolve, reject) => { child.on('exit', resolve); child.on('error', reject); }); }
  finally { clearTimeout(timer); }
  if (code !== 0 || !output.includes('CLAWCOON_EXTENSION_SMOKE_PASSED')) { process.stderr.write(output + diagnostics); throw new Error('Extension smoke test failed.'); }
  console.log((process.argv.includes('--packaged') ? 'Packaged VSIX: ' : '') + 'CLAWCOON_EXTENSION_SMOKE_PASSED — activation, commands, React webview handshake, private storage.');
} finally { await rm(temp, { force: true, recursive: true }); }
