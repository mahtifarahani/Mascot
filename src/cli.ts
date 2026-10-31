import { parseArgs } from 'node:util';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { Editor, HandoffDraft } from './protocol';
import { Store, DEFAULT_ROOT } from './core/store';
import { Service } from './core/service';

const HELP = `Mascot — isolated homes for your Claude Code subscriptions

  mascot accounts list
  mascot accounts add <name>
  mascot accounts rename <id> <name>
  mascot accounts remove <id>            Keep all profile data; no logout
  mascot setup <id> --editor cursor      Install only in the account's environment
  mascot open <id> [absolute-folder] --editor cursor
  mascot status <id> --editor cursor     Read official auth metadata only
  mascot handoff create <id> <folder> --draft /path/to/draft.json
  mascot handoff list
  mascot handoff open <handoff-id> --account <destination-id>

Options: --editor cursor|vscode (default: cursor), --data-dir <absolute-path>, --help
Draft JSON: { "title": "...", "goal": "...", "summary": "...", "next": "..." }

Chat and sign-in stay in official Claude Code. No API keys or automatic quota switching.
Setup requires a packaged release (pnpm package). Nothing installs until setup is requested.
`;

try {
  const parsed = parseArgs({ allowPositionals: true, options: {
    editor: { type: 'string', default: 'cursor' }, 'data-dir': { type: 'string' },
    draft: { type: 'string' }, account: { type: 'string' }, help: { type: 'boolean' },
  } });
  const [command, action, value, ...rest] = parsed.positionals;
  if (parsed.values.help || !command) { console.log(HELP); }
  else {
    const store = new Store(parsed.values['data-dir'] ?? DEFAULT_ROOT);
    const service = new Service(store, resolve(dirname(fileURLToPath(import.meta.url)), '..'));
    const editor = Editor.parse(parsed.values.editor);
    const required = (v: string | undefined, name: string): string => { if (!v) throw new Error(`Missing ${name}. Run mascot --help.`); return v; };
    const id = () => required(action, 'account ID');
    let result: unknown;
    if (command === 'accounts') {
      if (action === 'list') result = await store.list();
      else if (action === 'add') result = await store.add(required(value, 'account name'));
      else if (action === 'rename') { await store.rename(required(value, 'account ID'), required(rest[0], 'name')); result = { renamed: true }; }
      else if (action === 'remove') { await store.remove(required(value, 'account ID')); result = { removedFromList: true, profileDataKept: true }; }
      else throw new Error('Unknown accounts command. Run mascot --help.');
    } else if (command === 'setup') { await service.setup(id(), editor); result = await service.setupStatus(id(), editor); }
    else if (command === 'open') { await service.launch(id(), editor, value); result = { opened: true }; }
    else if (command === 'status') result = await service.auth(id(), editor);
    else if (command === 'handoff') {
      if (action === 'list') result = await service.handoffs();
      else if (action === 'create') {
        const draft = HandoffDraft.parse(JSON.parse(await readFile(required(parsed.values.draft, '--draft'), 'utf8')));
        result = await service.createHandoff(required(value, 'account ID'), required(rest[0], 'absolute folder'), draft);
      } else if (action === 'open') {
        const handoffId = required(value, 'handoff ID');
        const account = required(parsed.values.account, '--account');
        const handoff = (await service.handoffs()).find(h => h.id === handoffId);
        if (!handoff) throw new Error('Handoff not found.');
        await service.launch(account, editor, handoff.workspace, handoffId);
        result = { opened: true, promptToCopy: await service.handoffText(handoffId) };
      } else throw new Error('Unknown handoff command.');
    } else throw new Error('Unknown command. Run mascot --help.');
    console.log(JSON.stringify(result, null, 2));
  }
} catch (error) {
  const message = error instanceof Error ? error.message : 'The action failed.';
  // Zod errors contain only our schema inputs; subprocess output is never forwarded.
  console.error(`Mascot: ${message}`);
  process.exitCode = 1;
}
