import { mkdir, copyFile, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

await mkdir('bootstrap', { recursive: true });
await mkdir('artifacts', { recursive: true });
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
const vsce = 'node_modules/@vscode/vsce/vsce';
const options = { stdio: 'inherit' };
execFileSync(process.execPath, [vsce, 'package', '--no-dependencies', '--allow-missing-repository', '--skip-license', '--ignoreFile', '.vscodeignore-bootstrap', '--out', 'bootstrap/clawcoon.vsix'], options);
execFileSync(process.execPath, [vsce, 'package', '--no-dependencies', '--allow-missing-repository', '--skip-license', '--ignoreFile', '.vscodeignore', '--out', `artifacts/mascot-${version}.vsix`], options);
await copyFile('bootstrap/clawcoon.vsix', `artifacts/mascot-bootstrap-${version}.vsix`);
