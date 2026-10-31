import * as vscode from 'vscode';
import { randomBytes } from 'node:crypto';
import { access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { z } from 'zod';
import { Store, DEFAULT_ROOT } from '../core/store';
import { Service } from '../core/service';
import { Binding, type SettingsPort } from '../core/binding';
import { CLEARED_CLAUDE_ENV, isolatedEnv } from '../core/process';
import { Request, type AuthStatus, type Snapshot } from '../protocol';

const Variables = z.array(z.object({ name: z.string(), value: z.string() }));
export function createClaudeSettingsPort(): SettingsPort {
  return {
    read() {
      const config = vscode.workspace.getConfiguration('claudeCode');
      const global = config.inspect('environmentVariables')?.globalValue;
      const effective = Variables.parse(config.get('environmentVariables', []));
      return {
        globalVariables: global === undefined ? undefined : Variables.parse(global),
        effectiveVariables: effective,
        globalContinue: config.inspect<boolean>('continueAfterReload')?.globalValue,
        effectiveContinue: config.get('continueAfterReload', true),
        inheritedAuthOverride: CLEARED_CLAUDE_ENV.some(name => !!process.env[name] && !effective.some(v => v.name === name && v.value === '')),
      };
    },
    async variables(value) { await vscode.workspace.getConfiguration('claudeCode').update('environmentVariables', value, vscode.ConfigurationTarget.Global); },
    async continueAfterReload(value) { await vscode.workspace.getConfiguration('claudeCode').update('continueAfterReload', value, vscode.ConfigurationTarget.Global); },
  };
}

type Pending = { id?: string; handoff?: string };
const BUSY: Record<Request['type'], string> = {
  refresh: 'Refreshing…', add: 'Adding account…', rename: 'Saving name…', remove: 'Removing label…', switch: 'Waiting for your confirmation…',
  restore: 'Waiting for your confirmation…', terminal: 'Opening terminal…', auth: 'Asking official Claude for sign-in status…',
  claude: 'Opening Claude…', usage: 'Opening Claude…', handoff: 'Saving handoff…', 'open-handoff': 'Waiting for your choice…',
};
class AccountsPanel implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private busy?: string;
  private notice?: string;
  private error?: string;
  private readonly statuses = new Map<string, AuthStatus>();
  private readonly store: Store;
  private readonly service: Service;
  private readonly binding: Binding;
  private resolveReady?: () => void;
  private readonly ready = new Promise<void>(resolve => { this.resolveReady = resolve; });
  constructor(private readonly context: vscode.ExtensionContext) {
    const testRoot = context.extensionMode !== vscode.ExtensionMode.Production ? process.env.MASCOT_TEST_ROOT : undefined;
    this.store = new Store(testRoot ?? process.env.MASCOT_ROOT ?? DEFAULT_ROOT);
    this.service = new Service(this.store, context.extensionUri.fsPath);
    this.binding = new Binding(this.store, createClaudeSettingsPort(), context.globalStorageUri.fsPath);
  }
  async resolveWebviewView(view: vscode.WebviewView): Promise<void> {
    this.view = view;
    const webview = view.webview;
    webview.options = { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'dist'), vscode.Uri.joinPath(this.context.extensionUri, 'media')] };
    const nonce = randomBytes(24).toString('base64');
    const script = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'dist/webview.js'));
    const style = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'dist/webview.css'));
    const brand = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, 'media/brand.svg'));
    webview.html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource}; style-src ${webview.cspSource}; script-src 'nonce-${nonce}'; connect-src 'none'; font-src ${webview.cspSource};"><link rel="stylesheet" href="${style}"><title>Mascot</title></head><body><div id="root" data-brand="${brand}"></div><script nonce="${nonce}" src="${script}"></script></body></html>`;
    this.context.subscriptions.push(webview.onDidReceiveMessage(async raw => {
      const parsed = Request.safeParse(raw);
      if (!parsed.success) { this.error = 'The request was invalid. No action was performed.'; await this.publish(); return; }
      if (parsed.data.type === 'refresh') this.resolveReady?.();
      await this.handle(parsed.data);
    }));
    this.context.subscriptions.push(view.onDidChangeVisibility(() => { if (view.visible) void this.publish(); }));
    await this.publish();
  }
  private async currentAccount(): Promise<string | undefined> {
    const entries = Variables.parse(vscode.workspace.getConfiguration('claudeCode').get('environmentVariables', []));
    const values = entries.filter(v => v.name === 'CLAUDE_CONFIG_DIR');
    const directory = values.length === 1 ? values[0].value : values.length === 0 ? process.env.CLAUDE_CONFIG_DIR : undefined;
    if (!directory) return undefined;
    return (await this.store.list()).find(a => this.service.profilePath(a.id) === resolve(directory))?.id;
  }
  private requireTrust(): void {
    if (!vscode.workspace.isTrusted || vscode.env.remoteName) throw new Error('Use a trusted, local workspace.');
  }
  private async folder(): Promise<string> {
    this.requireTrust();
    const folders = vscode.workspace.workspaceFolders ?? [];
    if (folders.length === 1 && folders[0].uri.scheme === 'file') return folders[0].uri.fsPath;
    if (folders.length > 1) {
      const selection = await vscode.window.showQuickPick(folders.filter(f => f.uri.scheme === 'file').map(f => ({ label: f.name, description: f.uri.fsPath })));
      if (selection?.description) return selection.description;
      throw new Error('Project selection cancelled.');
    }
    const result = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, canSelectMany: false, title: 'Choose the project' });
    if (!result?.[0] || result[0].scheme !== 'file') throw new Error('Project selection cancelled.');
    return result[0].fsPath;
  }
  private official() {
    const extension = vscode.extensions.getExtension('anthropic.claude-code');
    if (!extension) throw new Error('Install the official Claude Code extension first. Mascot does not copy your sign-ins.');
    return extension;
  }
  private async officialCli(): Promise<string> {
    const executable = join(this.official().extensionUri.fsPath, 'resources', 'native-binary', 'claude');
    try { await access(executable); } catch { throw new Error('This official Claude Code build has no supported native executable. Use its own chat panel.'); }
    return executable;
  }
  async publish(): Promise<void> {
    if (!this.view) return;
    try {
      const current = await this.currentAccount();
      const snapshot: Snapshot = {
        accounts: await Promise.all((await this.store.list()).map(async a => ({ ...a, current: current === a.id, profileReady: await this.service.profilePrepared(a.id), configDir: this.service.profilePath(a.id), auth: this.statuses.get(a.id) ?? { state: 'unknown' } }))),
        handoffs: await this.service.handoffs(), root: this.store.root, workspace: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
        trusted: vscode.workspace.isTrusted && !vscode.env.remoteName,
        officialAvailable: !!vscode.extensions.getExtension('anthropic.claude-code'), canRestore: await this.binding.canRestore(),
        busy: this.busy, notice: this.notice, error: this.error,
      };
      await this.view.webview.postMessage({ type: 'snapshot', snapshot });
    } catch { await this.view.webview.postMessage({ type: 'fatal', message: 'Mascot could not validate its private data or Claude profile setting. No account was switched.' }); }
  }
  async waitForPanelReady(): Promise<void> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try { await Promise.race([this.ready, new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('The Mascot panel did not finish starting.')), 15_000); })]); }
    finally { if (timeout) clearTimeout(timeout); }
  }
  async openClaude(usage = false): Promise<void> {
    this.requireTrust();
    const extension = this.official();
    await extension.activate();
    if (!(await vscode.commands.getCommands(true)).includes('claude-vscode.editor.open')) throw new Error('Open official Claude Code from the Command Palette; this version has no supported Open Chat command.');
    await vscode.commands.executeCommand('claude-vscode.editor.open');
    if (usage) {
      await vscode.env.clipboard.writeText('/usage');
      this.notice = 'Copied /usage. Paste it into official Claude and press Enter.';
      void vscode.window.showInformationMessage(this.notice);
    }
  }
  private async acknowledgeSwitch(name: string): Promise<boolean> {
    return await vscode.window.showWarningMessage(`Use ${name} for Claude Code? Stop and close existing Claude chats and background tools first. This changes the Claude profile setting for new sessions, can affect other windows sharing the same user settings, and reloads this window. Claude Desktop stays unchanged.`, { modal: true }, 'Switch and reload') === 'Switch and reload';
  }
  private async switchAccount(id: string, handoff?: string): Promise<void> {
    this.official();
    const account = await this.store.account(id);
    if (!(await this.acknowledgeSwitch(account.name))) return;
    await this.service.prepareProfile(id);
    await this.binding.use(id);
    await this.context.globalState.update('pendingClaudeSwitch', { id, handoff } satisfies Pending);
    await vscode.commands.executeCommand('workbench.action.reloadWindow');
  }
  async finishPendingSwitch(): Promise<void> {
    const pending = this.context.globalState.get<Pending>('pendingClaudeSwitch');
    if (!pending) return;
    // The earlier explicit switch request owns this one-time continuation. Never resend a prompt.
    await this.context.globalState.update('pendingClaudeSwitch', undefined);
    try {
      this.requireTrust();
      if (pending.id && await this.currentAccount() !== pending.id) throw new Error('The selected profile did not remain active after reload. Check Claude settings before continuing.');
      await this.openClaude();
      if (pending.handoff) {
        const path = await this.service.handoffPath(pending.handoff);
        await vscode.window.showTextDocument(vscode.Uri.file(path), { preview: false });
        await vscode.env.clipboard.writeText(await this.service.handoffText(pending.handoff));
        this.notice = 'Handoff opened. Paste the copied reference into Claude when ready.';
      } else this.notice = 'Claude profile selected. Sign in through official Claude if needed.';
    } catch (e) { this.error = e instanceof Error ? e.message : 'Open Claude manually to continue.'; }
    await this.publish();
  }
  async terminal(id: string): Promise<void> {
    this.requireTrust();
    const executable = await this.officialCli();
    const account = await this.store.account(id);
    const config = await this.service.prepareProfile(id);
    const folders = vscode.workspace.workspaceFolders ?? [];
    const cwd = folders[0]?.uri.scheme === 'file' ? folders[0].uri.fsPath : config;
    const terminal = vscode.window.createTerminal({ name: `Claude · ${account.name}`, shellPath: executable, shellArgs: [], cwd, strictEnv: true, env: isolatedEnv(config, this.store.root, id) });
    terminal.show();
    this.notice = 'Opened official Claude in this terminal with the selected profile. Existing terminals and shell settings were not changed.';
  }
  private async handle(request: Request): Promise<void> {
    if (request.type === 'refresh') { await this.publish(); return; }
    if (this.busy) return;
    this.error = undefined; this.notice = undefined; this.busy = BUSY[request.type]; await this.publish();
    try {
      this.requireTrust();
      switch (request.type) {
        case 'add': await this.store.add(request.name); break;
        case 'rename': await this.store.rename(request.id, request.name); break;
        case 'remove': {
          const account = await this.store.account(request.id);
          if (await this.currentAccount() === request.id) throw new Error('Choose another Claude profile before removing this label.');
          if (await vscode.window.showWarningMessage(`Remove ${account.name} from the list? Claude profile files and sign-ins will be kept.`, { modal: true }, 'Remove from list')) await this.store.remove(request.id);
          break;
        }
        case 'switch': await this.switchAccount(request.id); break;
        case 'restore':
          this.official();
          if (await this.acknowledgeSwitch('your previous Claude profile')) {
            await this.binding.restore();
            await this.context.globalState.update('pendingClaudeSwitch', {} satisfies Pending);
            await vscode.commands.executeCommand('workbench.action.reloadWindow');
          }
          break;
        case 'terminal': await this.terminal(request.id); break;
        case 'auth': this.statuses.set(request.id, await this.service.authForProfile(request.id, await this.officialCli())); break;
        case 'claude': await this.openClaude(); break;
        case 'usage': await this.openClaude(true); break;
        case 'handoff': {
          const folder = await this.folder();
          const selected = await vscode.window.showOpenDialog({ title: 'Optional reference files (Cancel to skip)', canSelectMany: true, canSelectFolders: false, canSelectFiles: true });
          const handoff = await this.service.createHandoff(request.id, folder, request.draft, selected?.filter(u => u.scheme === 'file').map(u => u.fsPath) ?? []);
          await vscode.env.clipboard.writeText(await this.service.handoffText(handoff.id));
          this.notice = 'Handoff saved. Its reference was copied; review before sharing.';
          break;
        }
        case 'open-handoff': {
          const handoff = (await this.service.handoffs()).find(h => h.id === request.id);
          if (!handoff) throw new Error('Handoff not found.');
          const target = await vscode.window.showQuickPick((await this.store.list()).map(a => ({ label: a.name, description: a.id })), { title: 'Choose the Claude account' });
          if (!target) break;
          if (await this.currentAccount() === target.description) {
            await vscode.window.showTextDocument(vscode.Uri.file(await this.service.handoffPath(handoff.id)), { preview: false });
            await vscode.env.clipboard.writeText(await this.service.handoffText(handoff.id));
          } else await this.switchAccount(target.description, handoff.id);
          break;
        }
      }
    } catch (e) { this.error = e instanceof Error ? e.message : 'The action failed.'; }
    finally { this.busy = undefined; await this.publish(); }
  }
}

export function activate(context: vscode.ExtensionContext): { refresh(): Promise<void>; waitForPanelReady(): Promise<void> } {
  const panel = new AccountsPanel(context);
  context.subscriptions.push(vscode.window.registerWebviewViewProvider('mascot.accounts', panel));
  context.subscriptions.push(vscode.commands.registerCommand('mascot.open', () => vscode.commands.executeCommand('mascot.accounts.focus')));
  const safeOpen = async (usage: boolean) => { try { await panel.openClaude(usage); } catch (e) { void vscode.window.showErrorMessage(e instanceof Error ? e.message : 'Could not open Claude.'); } };
  context.subscriptions.push(vscode.commands.registerCommand('mascot.openClaude', () => safeOpen(false)));
  context.subscriptions.push(vscode.commands.registerCommand('mascot.usage', () => safeOpen(true)));
  context.subscriptions.push(vscode.workspace.onDidGrantWorkspaceTrust(() => panel.publish()));
  void panel.finishPendingSwitch();
  return { refresh: () => panel.publish(), waitForPanelReady: () => panel.waitForPanelReady() };
}
