import { access, readdir } from 'node:fs/promises';
import { constants } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, isAbsolute, join } from 'node:path';

/** Read-only executable lookup. It never installs or updates software. */
export async function findClaudeExecutable(explicit?: string): Promise<string> {
  const executable = async (path: string) => { try { await access(path, constants.X_OK); return true; } catch { return false; } };
  if (explicit) {
    if (!isAbsolute(explicit) || !(await executable(explicit))) throw new Error('--claude must name an executable at an absolute path.');
    return explicit;
  }
  const folders = [...(process.env.PATH ?? '').split(delimiter), join(homedir(), '.local/bin'), '/opt/homebrew/bin', '/usr/local/bin'];
  for (const folder of [...new Set(folders)].filter(isAbsolute)) {
    const path = join(folder, 'claude');
    if (await executable(path)) return path;
  }
  for (const root of [join(homedir(), '.cursor/extensions'), join(homedir(), '.vscode/extensions')]) {
    let entries: string[]; try { entries = await readdir(root); } catch { continue; }
    for (const name of entries.filter(n => n.toLowerCase().startsWith('anthropic.claude-code-')).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))) {
      const path = join(root, name, 'resources/native-binary/claude');
      if (await executable(path)) return path;
    }
  }
  throw new Error('Official Claude Code was not found. Install it yourself or pass --claude /absolute/path/to/claude.');
}
