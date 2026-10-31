import * as vscode from 'vscode';
import { randomBytes } from 'node:crypto';
import { join, resolve } from 'node:path';
import { Store, DEFAULT_ROOT } from '../core/store';
import { Service } from '../core/service';
import { editorForApp } from '../core/editor';
import { Request, Editor, type AuthStatus, type Snapshot } from '../protocol';

class AccountsPanel implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private readonly editor: Editor;
  private busy?: string;
  private notice?: string;
  private error?: string;
  private readonly statuses = new Map<string, AuthStatus>();
  private readonly store: Store;
  private readonly service: Service;
  private resolveReady?: () => void;
  private readonly ready = new Promise<void>(resolve => { this.resolveReady = resolve; });
  constructor(private readonly context: vscode.ExtensionContext) {
    const testRoot = context.extensionMode !== vscode.ExtensionMode.Production ? process.env.CLAWCOON_TEST_ROOT : undefined;
    this.store = new Store(testRoot ?? process.env.CLAWCOON_ROOT ?? DEFAULT_ROOT);
    this.service = new Service(this.store, context.extensionUri.fsPath);
    this.editor = editorForApp(vscode.env.appName);
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
  private async managed(): Promise<string | undefined> {
    const id = process.env.CLAWCOON_ACCOUNT_ID;
    if (!id) return undefined;
    const storage = resolve(this.context.globalStorageUri.fsPath);
    for (const editor of ['cursor', 'vscode'] as const) {
      try {
        const paths = this.service.paths(id, editor);
        if (storage !== join(paths.dataDir, 'User', 'globalStorage', 'clawcoon.clawcoon')) continue;
        await this.service.verify(id, editor);
        return id;
      } catch { return undefined; }
    }
    return undefined;
  }
  private requireTrust(): void {
    if (!vscode.workspace.isTrusted || vscode.env.remoteName) throw new Error('Use a trusted, local workspace. Remote and virtual environments are not supported in this release.');
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
    const result = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, canSelectMany: false, title: 'Choose the project to open in this account environment' });
    if (!result?.[0] || result[0].scheme !== 'file') throw new Error('Project selection cancelled.');
    return result[0].fsPath;
  }
  async publish(): Promise<void> {
    if (!this.view) return;
    try {
      const current = await this.managed();
      const accounts = await this.store.list();
      const snapshot: Snapshot = {
        accounts: await Promise.all(accounts.map(async a => ({ ...a, current: current === a.id, setup: await this.service.setupStatus(a.id, this.editor), auth: this.statuses.get(`${a.id}:${this.editor}`) ?? { state: 'unknown' } }))),
        handoffs: await this.service.handoffs(), editor: this.editor, root: this.store.root,
        workspace: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
        trusted: vscode.workspace.isTrusted && !vscode.env.remoteName, managed: !!current,
        busy: this.busy, notice: this.notice, error: this.error,
      };
      await this.view.webview.postMessage({ type: 'snapshot', snapshot });
    } catch {
      await this.view.webview.postMessage({ type: 'fatal', message: 'Mascot could not validate its private data directory. No setup, login or launch was attempted. Use the CLI to inspect the directory or choose a fresh empty data directory.' });
    }
  }
  async waitForPanelReady(): Promise<void> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([this.ready, new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('The Mascot webview did not complete its startup handshake.')), 15_000); })]);
    } finally { if (timeout) clearTimeout(timeout); }
  }
  async openClaude(usage = false): Promise<void> {
    this.requireTrust();
    if (!(await this.managed())) throw new Error('Open an account’s prepared environment first. Mascot will not open or change Claude in your original editor.');
    const extension = vscode.extensions.getExtension('anthropic.claude-code');
    if (!extension) throw new Error('Official Claude Code is missing from this isolated environment. Run Setup again.');
    await extension.activate();
    const commands = await vscode.commands.getCommands(true);
    const command = 'claude-vscode.editor.open';
    if (!commands.includes(command)) throw new Error('This version of official Claude has no supported Open Chat command. Open it from the Command Palette.');
    await vscode.commands.executeCommand(command);
    if (usage) {
      await vscode.env.clipboard.writeText('/usage');
      this.notice = 'Copied /usage. Paste it into official Claude and press Enter to see this account’s limits.';
      void vscode.window.showInformationMessage(this.notice);
    }
  }
  private async acknowledgeSharedProject(): Promise<boolean> {
    return await vscode.window.showWarningMessage('Before continuing in another account, stop any Claude tools still editing this project in other windows. Mascot cannot inspect or stop the official extension’s running tools.', { modal: true }, 'I have stopped the other tools') === 'I have stopped the other tools';
  }
  private async handle(request: Request): Promise<void> {
    if (request.type === 'refresh') { await this.publish(); return; }
    if (this.busy) return;
    this.error = undefined; this.notice = undefined;
    this.busy = request.type === 'setup' ? 'Preparing a separate environment… this can take a few minutes.' : 'Working…';
    await this.publish();
    try {
      this.requireTrust();
      switch (request.type) {
        case 'add': await this.store.add(request.name); this.notice = 'Account added. Prepare its isolated environment next.'; break;
        case 'rename': await this.store.rename(request.id, request.name); break;
        case 'remove': {
          const account = await this.store.account(request.id);
          if (await this.managed() === request.id) throw new Error('Remove this account from another account’s window or from the original Mascot panel. Its current environment is still in use.');
          const answer = await vscode.window.showWarningMessage(`Remove ${account.name} from the list? All Claude sessions, credentials and editor files will remain on disk.`, { modal: true }, 'Remove from list');
          if (answer) await this.store.remove(request.id);
          break;
        }
        case 'setup': {
          const answer = await vscode.window.showInformationMessage('Install Mascot and official Claude Code in this account’s separate editor directory? Your existing editor and Claude Desktop will not be targeted.', { modal: true }, 'Prepare environment');
          if (answer) { await this.service.setup(request.id, this.editor); this.notice = 'Environment ready. Open it and sign in through official Claude Code.'; }
          break;
        }
        case 'launch': {
          const folder = await this.folder();
          if (await this.acknowledgeSharedProject()) { await this.service.launch(request.id, this.editor, folder); this.notice = 'Opened the separate account window. Sign in or chat through official Claude Code there.'; }
          break;
        }
        case 'auth': this.statuses.set(`${request.id}:${this.editor}`, await this.service.auth(request.id, this.editor)); break;
        case 'claude': await this.openClaude(); break;
        case 'usage': await this.openClaude(true); break;
        case 'handoff': {
          const folder = await this.folder();
          const selected = await vscode.window.showOpenDialog({ title: 'Optional: select exported conversations or reference files (Cancel to skip)', canSelectMany: true, canSelectFolders: false, canSelectFiles: true });
          const handoff = await this.service.createHandoff(request.id, folder, request.draft, selected?.filter(u => u.scheme === 'file').map(u => u.fsPath) ?? []);
          await vscode.env.clipboard.writeText(await this.service.handoffText(handoff.id));
          this.notice = 'Handoff saved privately. Its reference prompt was copied; review the file before sharing it with another account.';
          break;
        }
        case 'open-handoff': {
          const handoff = (await this.service.handoffs()).find(h => h.id === request.id);
          if (!handoff) throw new Error('Handoff not found.');
          const accounts = await this.store.list();
          const target = await vscode.window.showQuickPick(accounts.map(a => ({ label: a.name, description: a.id })), { title: 'Choose the account that should receive this handoff' });
          if (target && await this.acknowledgeSharedProject()) {
            await this.service.launch(target.description, this.editor, handoff.workspace, handoff.id);
            await vscode.env.clipboard.writeText(await this.service.handoffText(handoff.id));
            this.notice = 'The destination window and handoff file were opened. Paste the copied reference into official Claude yourself.';
          }
          break;
        }
      }
    } catch (e) { this.error = e instanceof Error ? e.message : 'The action failed.'; }
    finally { this.busy = undefined; await this.publish(); }
  }
}

export function activate(context: vscode.ExtensionContext): { refresh(): Promise<void>; waitForPanelReady(): Promise<void> } {
  const panel = new AccountsPanel(context);
  context.subscriptions.push(vscode.window.registerWebviewViewProvider('clawcoon.accounts', panel));
  context.subscriptions.push(vscode.commands.registerCommand('clawcoon.open', () => vscode.commands.executeCommand('clawcoon.accounts.focus')));
  const safeOpen = async (usage: boolean) => { try { await panel.openClaude(usage); } catch (e) { void vscode.window.showErrorMessage(e instanceof Error ? e.message : 'Could not open Claude.'); } };
  context.subscriptions.push(vscode.commands.registerCommand('clawcoon.openClaude', () => safeOpen(false)));
  context.subscriptions.push(vscode.commands.registerCommand('clawcoon.usage', () => safeOpen(true)));
  context.subscriptions.push(vscode.workspace.onDidGrantWorkspaceTrust(() => panel.publish()));
  return { refresh: () => panel.publish(), waitForPanelReady: () => panel.waitForPanelReady() };
}
