import { mkdir, readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

await mkdir('artifacts', { recursive: true });
const { version } = JSON.parse(await readFile('package.json', 'utf8'));
execFileSync(process.execPath, ['node_modules/@vscode/vsce/vsce', 'package', '--no-dependencies', '--allow-missing-repository', '--skip-license', '--ignoreFile', '.vscodeignore', '--out', `artifacts/mascot-${version}.vsix`], { stdio: 'inherit' });
