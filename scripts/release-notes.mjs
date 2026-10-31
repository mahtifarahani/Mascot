import { readFile, writeFile } from 'node:fs/promises';

const tag = process.argv[2];
const manifest = JSON.parse(await readFile('package.json', 'utf8'));
if (!/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tag ?? '') || tag !== `v${manifest.version}`) {
  throw new Error('Release tag must be v<package.json version>.');
}
if (manifest.publisher !== 'Mascot' || manifest.name !== 'mascot') {
  throw new Error('Release identity must remain Mascot.mascot.');
}
const changelog = await readFile('docs/CHANGELOG.md', 'utf8');
const heading = `## [${manifest.version}] - `;
const section = changelog.split('\n').findIndex(line => line.startsWith(heading));
if (section < 0) throw new Error('Add a dated changelog section for this version.');
const lines = changelog.split('\n').slice(section + 1);
const next = lines.findIndex(line => line.startsWith('## '));
const notes = (next < 0 ? lines : lines.slice(0, next)).join('\n').trim();
if (!notes) throw new Error('Release notes must not be empty.');
await writeFile('release-notes.md', `${notes}\n\nInstall from [Open VSX](https://open-vsx.org/extension/Mascot/mascot), or download \`mascot-${manifest.version}.vsix\` and \`SHA256SUMS\` below. This preview is validated on macOS Apple Silicon. Official Claude Code is required.\n`);
console.log(`Validated ${tag} (Mascot.mascot).`);
