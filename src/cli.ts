import { parseArgs } from 'node:util';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { HandoffDraft } from './protocol';
import { Store, DEFAULT_ROOT } from './core/store';
import { Service } from './core/service';
import { isolatedEnv } from './core/process';
import { findClaudeExecutable } from './core/claude';

const HELP = `Mascot — Claude account switcher

  mascot accounts list
  mascot accounts add <name>
  mascot accounts rename <id> <name>
  mascot accounts remove <id>          Keep Claude profile data; no logout
  mascot prepare <id>                 Create only this account's Claude profile
  mascot run <id> [absolute-folder]    Run official Claude in this terminal
  mascot status <id>                  Read official sign-in metadata
  mascot handoff create <id> <folder> --draft /absolute/draft.json
  mascot handoff list
  mascot handoff open <handoff-id>     Print a reference to use in Claude

Options: --data-dir <absolute-path>, --claude <absolute-executable>, --help
Draft JSON: { "title": "...", "goal": "...", "summary": "...", "next": "..." }

In the extension, Use account selects the profile for official Claude in the same window.
The CLI runs Claude directly; it never installs or opens an editor. No API keys or quota rotation.
`;

try {
  const parsed = parseArgs({ allowPositionals: true, options: {
    'data-dir': { type: 'string' }, claude: { type: 'string' }, draft: { type: 'string' }, help: { type: 'boolean' },
  } });
  const [command, action, value, ...rest] = parsed.positionals;
  if (parsed.values.help || !command) console.log(HELP);
  else {
    const store = new Store(parsed.values['data-dir'] ?? DEFAULT_ROOT);
    const service = new Service(store, resolve(dirname(fileURLToPath(import.meta.url)), '..'));
    const required = (v: string | undefined, name: string): string => { if (!v) throw new Error(`Missing ${name}. Run mascot --help.`); return v; };
    let result: unknown;
    if (command === 'accounts') {
      if (action === 'list') result = await store.list();
      else if (action === 'add') result = await store.add(required(value, 'account name'));
      else if (action === 'rename') { await store.rename(required(value, 'account ID'), required(rest[0], 'name')); result = { renamed: true }; }
      else if (action === 'remove') { await store.remove(required(value, 'account ID')); result = { removedFromList: true, profileDataKept: true }; }
      else throw new Error('Unknown accounts command.');
    } else if (command === 'prepare' || command === 'setup') {
      result = { configDir: await service.prepareProfile(required(action, 'account ID')), prepared: true };
    } else if (command === 'run' || command === 'open') {
      const id = required(action, 'account ID');
      const executable = await findClaudeExecutable(parsed.values.claude);
      const config = await service.prepareProfile(id);
      const cwd = value ? await service.validateWorkspace(value) : process.cwd();
      const child = spawn(executable, [], { cwd, env: isolatedEnv(config, store.root, id), stdio: 'inherit' });
      const code = await new Promise<number>((resolve, reject) => { child.on('close', code => resolve(code ?? 1)); child.on('error', () => reject(new Error('Could not start official Claude.'))); });
      process.exitCode = code;
    } else if (command === 'status') {
      result = await service.authForProfile(required(action, 'account ID'), await findClaudeExecutable(parsed.values.claude));
    } else if (command === 'handoff') {
      if (action === 'list') result = await service.handoffs();
      else if (action === 'create') {
        let draft; try { draft = HandoffDraft.parse(JSON.parse(await readFile(required(parsed.values.draft, '--draft'), 'utf8'))); }
        catch { throw new Error('The handoff draft is missing or invalid.'); }
        result = await service.createHandoff(required(value, 'account ID'), required(rest[0], 'absolute folder'), draft);
      } else if (action === 'open') {
        const id = required(value, 'handoff ID');
        result = { path: await service.handoffPath(id), promptToCopy: await service.handoffText(id) };
      } else throw new Error('Unknown handoff command.');
    } else throw new Error('Unknown command. Run mascot --help.');
    if (result !== undefined) console.log(JSON.stringify(result, null, 2));
  }
} catch (error) {
  console.error(`Mascot: ${error instanceof Error ? error.message : 'The action failed.'}`);
  process.exitCode = 1;
}
