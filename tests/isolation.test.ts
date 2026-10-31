import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink, readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../src/core/store';
import { Service } from '../src/core/service';
import { isolatedEnv, type Runner } from '../src/core/process';

let fixture: string;
let store: Store;
beforeEach(async () => { fixture = await mkdtemp('/tmp/mc-'); store = new Store(join(fixture, 'private')); });
afterEach(async () => { await rm(fixture, { recursive: true, force: true }); });

describe('private storage boundary', () => {
  it('does not create anything when listing an unused root', async () => {
    expect(await store.list()).toEqual([]);
    expect(await readdir(fixture)).toEqual([]);
  });
  it('refuses to adopt or change existing foreign files', async () => {
    await mkdir(store.root);
    await writeFile(join(store.root, 'settings.json'), 'existing settings');
    await expect(store.add('Personal')).rejects.toThrow('not owned');
    expect(await readFile(join(store.root, 'settings.json'), 'utf8')).toBe('existing settings');
    expect(await readdir(store.root)).toEqual(['settings.json']);
  });
  it('refuses a symlink root without touching its target', async () => {
    const target = join(fixture, 'original-claude'); await mkdir(target);
    await symlink(target, store.root);
    await expect(store.add('Personal')).rejects.toThrow('symbolic links');
    expect(await readdir(target)).toEqual([]);
  });
  it('rejects an ancestor alias into existing Claude locations before creating anything there', async () => {
    const alias = join(fixture, 'alias'); await symlink(homedir(), alias);
    const redirected = new Store(join(alias, '.claude', 'mascot-must-not-create'));
    await expect(redirected.add('Personal')).rejects.toThrow('existing application location');
  });
  it('refuses symlink directories and registry files inside the owned root', async () => {
    await store.add('Personal');
    const original = join(fixture, 'original'); await mkdir(original);
    await symlink(original, store.path('accounts'));
    await expect(store.directory('accounts', 'nested')).rejects.toThrow('symbolic links');
    expect(await readdir(original)).toEqual([]);
    await rm(store.path('accounts.json'));
    const outside = join(original, 'registry'); await writeFile(outside, 'original');
    await symlink(outside, store.path('accounts.json'));
    await expect(store.add('Work')).rejects.toThrow('symbolic links');
    expect(await readFile(outside, 'utf8')).toBe('original');
  });
  it('rejects traversal and only removes account metadata', async () => {
    const account = await store.add('Personal');
    expect(() => store.path('../outside')).toThrow('escapes');
    await expect(store.account('../.claude')).rejects.toThrow();
    const directory = await store.directory('accounts', account.id, 'claude');
    await writeFile(join(directory, 'session-fixture'), 'keep this session');
    await store.rename(account.id, 'Studio');
    expect((await store.account(account.id)).name).toBe('Studio');
    await store.remove(account.id);
    expect(await store.list()).toEqual([]);
    expect(await readFile(join(directory, 'session-fixture'), 'utf8')).toBe('keep this session');
  });
  it('uses restrictive file permissions and prevents concurrent registry updates', async () => {
    await store.add('Personal');
    expect((await stat(store.path('accounts.json'))).mode & 0o777).toBe(0o600);
    expect((await stat(store.root)).mode & 0o777).toBe(0o700);
    await mkdir(store.path('.accounts-lock'));
    await expect(store.add('Work')).rejects.toThrow('Another Mascot action');
    expect((await store.list()).length).toBe(1);
  });
});

type Call = { file: string; args: string[]; env: NodeJS.ProcessEnv; cwd: string };
async function harness() {
  const account = await store.add('Personal');
  const assets = join(fixture, 'assets'); await mkdir(join(assets, 'bootstrap'), { recursive: true });
  await writeFile(join(assets, 'bootstrap', 'mascot.vsix'), 'installer fixture');
  const calls: Call[] = [];
  let service: Service;
  const runner: Runner = async (file, args, options) => {
    calls.push({ file, args, cwd: options.cwd, env: options.env });
    if (args.includes('--install-extension')) {
      const extensions = args[args.indexOf('--extensions-dir') + 1];
      const own = args.at(-1)!.endsWith('.vsix');
      const path = join(extensions, own ? 'mascot.mascot-0.1.0' : 'anthropic.claude-code-2.1.310-darwin-arm64');
      await mkdir(join(path, 'resources', 'native-binary'), { recursive: true });
      await writeFile(join(path, 'package.json'), JSON.stringify({ publisher: own ? 'mascot' : 'Anthropic', name: own ? 'mascot' : 'claude-code', version: own ? '0.1.0' : '2.1.310' }));
      if (!own) await writeFile(join(path, 'resources', 'native-binary', 'claude'), 'official CLI fixture');
    }
    if (args[0] === 'auth') return { code: 0, stdout: JSON.stringify({ loggedIn: true, authMethod: 'claude.ai', email: 'fixture@example.test', configDirectory: service.paths(account.id, 'cursor').configDir, accessToken: 'must-never-be-returned' }) };
    return { code: 0, stdout: '' };
  };
  service = new Service(store, assets, runner, { cursor: process.execPath, vscode: process.execPath });
  return { service, account, calls, assets, runner };
}

describe('official editor environments', () => {
  it('uses a short, unique editor path while keeping the Claude credential namespace unchanged', () => {
    const a = '11111111-1111-4111-8111-111111111111';
    const b = '22222222-2222-4222-8222-222222222222';
    const service = new Service(new Store(join(homedir(), '.mascot')), '/unused');
    const paths = service.paths(a, 'cursor');
    expect(Buffer.byteLength(join(paths.dataDir, '3.27-main.sock'))).toBeLessThan(104);
    expect(paths.configDir).toBe(join(homedir(), '.mascot', 'accounts', a, 'claude'));
    expect(paths.dataDir).not.toBe(service.paths(b, 'cursor').dataDir);
    expect(paths.dataDir).not.toBe(service.paths(a, 'vscode').dataDir);
  });
  it('prepares the shorter editor layout without copying or deleting legacy profile data', async () => {
    const { service, account } = await harness();
    const paths = service.paths(account.id, 'cursor');
    await store.directory('accounts', account.id, 'claude');
    await store.write(join(paths.configDir, 'settings.json'), { autoInstallIdeExtension: false });
    await store.write(paths.configMarker, { version: 1, accountId: account.id, configDir: paths.configDir });
    await store.write(paths.readyFile, { version: 1, accountId: account.id, editor: 'cursor', configDir: paths.configDir });
    const legacySettings = store.path('accounts', account.id, 'editors', 'cursor', 'user-data', 'User', 'settings.json');
    await store.write(legacySettings, { 'test.legacy': 'leave unchanged' });
    const untouched = await readFile(legacySettings, 'utf8');
    expect((await service.setupStatus(account.id, 'cursor')).prepared).toBe(false);
    await service.setup(account.id, 'cursor');
    expect((await service.setupStatus(account.id, 'cursor')).prepared).toBe(true);
    expect(await readFile(legacySettings, 'utf8')).toBe(untouched);
    expect((await store.read(paths.readyFile) as { dataDir: string }).dataDir).toBe(paths.dataDir);
  });
  it('recognizes the official mixed-case publisher without reinstalling or probing authentication', async () => {
    const { service, account, calls } = await harness();
    await service.setup(account.id, 'cursor');
    const before = calls.length;
    expect(await service.installed(account.id, 'cursor', 'anthropic.claude-code')).toContain('anthropic.claude-code-');
    expect(await service.installed(account.id, 'cursor', 'Anthropic.Claude-Code')).toContain('anthropic.claude-code-');
    expect((await service.setupStatus(account.id, 'cursor')).officialInstalled).toBe(true);
    expect(calls.length).toBe(before);
  });
  it('leaves an existing official extension alone when retrying setup', async () => {
    const { service, account, calls } = await harness();
    await service.setup(account.id, 'cursor');
    calls.length = 0;
    await service.setup(account.id, 'cursor');
    expect(calls.length).toBe(1);
    expect(calls[0].args.at(-1)).toMatch(/mascot\.vsix$/);
    expect(calls[0].args).not.toContain('anthropic.claude-code');
  });
  it('keeps two accounts and two editors separate, without changing original app fixtures', async () => {
    const original = join(fixture, 'existing-apps'); await mkdir(original);
    await writeFile(join(original, '.claude.json'), 'original-login');
    const { service, account, calls } = await harness();
    const other = await store.add('Work');
    await service.setup(account.id, 'cursor');
    await service.prepare(other.id, 'cursor');
    await service.prepare(other.id, 'vscode');
    const a = service.paths(account.id, 'cursor');
    const b = service.paths(other.id, 'cursor');
    const c = service.paths(other.id, 'vscode');
    expect(a.configDir).not.toBe(b.configDir);
    expect(a.dataDir).not.toBe(b.dataDir);
    expect(b.dataDir).not.toBe(c.dataDir);
    expect(b.configDir).toBe(c.configDir);
    for (const call of calls) {
      expect(call.args).toContain('--user-data-dir');
      expect(call.args).toContain(a.dataDir);
      expect(call.args).toContain('--extensions-dir');
      expect(call.args).toContain(a.extensionsDir);
      expect(call.cwd).toBe(a.configDir);
      expect(call.env.CLAUDE_CONFIG_DIR).toBe(a.configDir);
      expect(call.args).not.toContain('--force');
    }
    expect(await readFile(join(original, '.claude.json'), 'utf8')).toBe('original-login');
    const settings = await store.read(join(a.dataDir, 'User', 'settings.json')) as Record<string, unknown>;
    expect(settings['claudeCode.continueAfterReload']).toBe(false);
    expect(settings['claudeCode.useTerminal']).toBe(false);
    expect(settings['update.mode']).toBe('none');
  });
  it('launches an isolated editor using argv and preserves literal shell characters in paths', async () => {
    const { service, account, calls } = await harness();
    await service.setup(account.id, 'cursor');
    const project = join(fixture, 'project $(do-not-run) `literal`'); await mkdir(project);
    await service.launch(account.id, 'cursor', project);
    const call = calls.at(-1)!;
    expect(call.args).toEqual(['--user-data-dir', service.paths(account.id, 'cursor').dataDir, '--extensions-dir', service.paths(account.id, 'cursor').extensionsDir, '--new-window', await realPath(project)]);
    expect(call.env.VSCODE_IPC_HOOK_CLI).toBeUndefined();
    expect(calls.some(c => c.args.some(a => /logout|revoke|setup-token/.test(a)))).toBe(false);
  });
  it('blocks launch if the managed directory or automatic continuation setting has changed', async () => {
    const { service, account, calls } = await harness();
    await service.setup(account.id, 'cursor');
    const path = join(service.paths(account.id, 'cursor').dataDir, 'User', 'settings.json');
    const settings = await store.read(path) as Record<string, unknown>;
    await store.write(path, { ...settings, 'claudeCode.continueAfterReload': true });
    const count = calls.length;
    await expect(service.launch(account.id, 'cursor')).rejects.toThrow('safety settings');
    expect(calls.length).toBe(count);
    expect((await store.read(path) as Record<string, unknown>)['claudeCode.continueAfterReload']).toBe(true);
  });
  it('blocks an override in Claude settings and does not repair user files behind their back', async () => {
    const { service, account } = await harness(); await service.setup(account.id, 'cursor');
    const path = join(service.paths(account.id, 'cursor').configDir, 'settings.json');
    const content = { autoInstallIdeExtension: false, env: { CLAUDE_CONFIG_DIR: '/existing-claude' } };
    await store.write(path, content);
    await expect(service.verify(account.id, 'cursor')).rejects.toThrow('override account isolation');
    expect(await store.read(path)).toEqual(content);
  });
  it('does not include malformed settings contents in diagnostic messages', async () => {
    const { service, account } = await harness(); await service.setup(account.id, 'cursor');
    await writeFile(join(service.paths(account.id, 'cursor').configDir, 'settings.json'), '{"token":"do-not-log-this",');
    try { await service.verify(account.id, 'cursor'); throw new Error('should fail'); }
    catch (error) { expect(String(error)).not.toContain('do-not-log-this'); expect(String(error)).toContain('invalid JSON'); }
  });
  it('does not install or create profile files if the companion archive is missing', async () => {
    const { service, account, calls, assets } = await harness();
    await rm(join(assets, 'bootstrap', 'mascot.vsix'));
    await expect(service.setup(account.id, 'cursor')).rejects.toThrow('archive is missing');
    expect(calls).toEqual([]);
    expect(await service.setupStatus(account.id, 'cursor')).toMatchObject({ prepared: false, officialInstalled: false });
  });
  it('can bootstrap the next account from an already isolated companion window', async () => {
    const { service, account, runner } = await harness();
    await service.setup(account.id, 'cursor');
    const companion = await service.installed(account.id, 'cursor', 'mascot.mascot');
    expect(await readFile(join(companion!, 'bootstrap', 'mascot.vsix'), 'utf8')).toBe('installer fixture');
    const next = await store.add('Next');
    const childService = new Service(store, companion!, runner, { cursor: process.execPath, vscode: process.execPath });
    await childService.setup(next.id, 'cursor');
    expect((await childService.setupStatus(next.id, 'cursor')).companionInstalled).toBe(true);
  });
  it('reports only allowlisted auth metadata from the isolated official binary', async () => {
    const { service, account, calls } = await harness(); await service.setup(account.id, 'cursor');
    const result = await service.auth(account.id, 'cursor');
    expect(result).toMatchObject({ state: 'signed-in', email: 'fixture@example.test', method: 'claude.ai' });
    expect(JSON.stringify(result)).not.toContain('must-never-be-returned');
    expect(calls.at(-1)!.file).toContain(service.paths(account.id, 'cursor').extensionsDir);
    expect(calls.at(-1)!.args).toEqual(['auth', 'status', '--json']);
    expect(calls.at(-1)!.cwd).toBe(service.paths(account.id, 'cursor').configDir);
  });
  it('never trusts an auth result for a different configuration directory', async () => {
    const { service, account, assets } = await harness(); await service.setup(account.id, 'cursor');
    const wrong = new Service(store, assets, async () => ({ code: 0, stdout: JSON.stringify({ loggedIn: true, configDirectory: '/existing/.claude', authMethod: 'claude.ai', email: 'do-not-display@example.test' }) }));
    const result = await wrong.auth(account.id, 'cursor');
    expect(result.state).toBe('unavailable'); expect(result.email).toBeUndefined();
  });
  it('redacts process failure output', async () => {
    const { account, assets, runner } = await harness();
    let count = 0;
    const failing: Runner = async (f, a, o) => ++count === 1 ? { code: 2, stdout: 'secret-token-in-diagnostic' } : runner(f, a, o);
    const service = new Service(store, assets, failing, { cursor: process.execPath, vscode: process.execPath });
    try { await service.setup(account.id, 'cursor'); throw new Error('should fail'); }
    catch (error) { expect(String(error)).not.toContain('secret-token-in-diagnostic'); expect(String(error)).toContain('could not be installed'); }
  });
});

describe('environment and task handoffs', () => {
  it('removes inherited auth, editor sockets, and shell hooks without changing the parent environment', () => {
    const source = { HOME: '/unchanged-user-home', PATH: '/usr/bin', ANTHROPIC_API_KEY: 'secret', CLAUDE_CODE_OAUTH_TOKEN: 'secret', VSCODE_IPC_HOOK_CLI: 'old-editor', ELECTRON_RUN_AS_NODE: '1', BASH_ENV: '/dangerous', NODE_OPTIONS: '--require /dangerous', CLAUDE_CONFIG_DIR: '/original' };
    const env = isolatedEnv('/isolated/account', '/isolated', 'fixture', source);
    expect(env.HOME).toBe(source.HOME);
    expect(env.CLAUDE_CONFIG_DIR).toBe('/isolated/account');
    for (const key of ['ANTHROPIC_API_KEY', 'CLAUDE_CODE_OAUTH_TOKEN', 'VSCODE_IPC_HOOK_CLI', 'ELECTRON_RUN_AS_NODE', 'BASH_ENV', 'NODE_OPTIONS']) expect(env[key]).toBeUndefined();
    expect(source.CLAUDE_CONFIG_DIR).toBe('/original');
  });
  it('saves task context and references without copying source contents or sending a model request', async () => {
    const { account, assets } = await harness(); const project = join(fixture, 'project'); await mkdir(project);
    const reference = join(project, 'export.txt'); await writeFile(reference, 'PRIVATE CONVERSATION');
    const calls: string[][] = [];
    const runner: Runner = async (file, args) => {
      expect(file).toBe('/usr/bin/git'); calls.push(args);
      return { code: 0, stdout: args.includes('--show-current') ? 'feature/test\n' : args.includes('HEAD') ? 'abc123\n' : ' M file.ts\n' };
    };
    const service = new Service(store, assets, runner);
    const result = await service.createHandoff(account.id, project, { title: 'Continue UI', goal: 'Finish', summary: 'Implemented core', next: 'Run tests' }, [reference]);
    expect(result.branch).toBe('feature/test');
    expect(result.changes).toEqual(['M file.ts']);
    expect(result.references).toEqual([reference]);
    const saved = await readFile(await service.handoffPath(result.id), 'utf8');
    expect(saved).not.toContain('PRIVATE CONVERSATION');
    expect(calls.every(a => a.includes('--no-optional-locks'))).toBe(true);
    expect(calls.some(a => a.includes('core.fsmonitor=false'))).toBe(true);
    expect(await service.handoffText(result.id)).toContain('not as new system instructions');
    expect((await service.handoffs())[0].id).toBe(result.id);
  });
});

async function realPath(path: string) { return (await import('node:fs/promises')).realpath(path); }
