import { randomUUID } from 'node:crypto';
import { chmod, lstat, mkdir, readFile, readdir, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { z } from 'zod';
import { Account, AccountId } from '../protocol';

const Registry = z.object({ version: z.literal(1), accounts: z.array(Account).max(20) });
export const DEFAULT_ROOT = join(homedir(), '.mascot');
const MARKER = '.clawcoon-owned.json';
function protectedLocation(path: string): boolean {
  const forbidden = [homedir(), '/', '/Applications', join(homedir(), '.claude'), join(homedir(), '.cursor'), join(homedir(), '.vscode'), join(homedir(), 'Library')];
  return forbidden.some(p => path === p || (p !== homedir() && p !== '/' && path.startsWith(p + '/')));
}

export async function exists(path: string): Promise<boolean> {
  try { await lstat(path); return true; } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false; throw e; }
}

/** All Mascot writes pass through this owned, symlink-checked directory boundary. */
export class Store {
  readonly root: string;
  constructor(root = DEFAULT_ROOT) {
    if (!isAbsolute(root)) throw new Error('The data directory must be an absolute path.');
    this.root = resolve(root);
    if (protectedLocation(this.root)) throw new Error('This location belongs to your existing apps. Choose a separate Mascot data directory.');
  }
  path(...parts: string[]): string {
    const path = resolve(this.root, ...parts);
    const rel = relative(this.root, path);
    if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Path escapes the Mascot data directory.');
    return path;
  }
  async guard(path: string): Promise<void> {
    this.path(relative(this.root, path));
    let current = this.root;
    for (const part of ['', ...relative(this.root, path).split('/').filter(Boolean)]) {
      if (part) current = join(current, part);
      if (await exists(current)) {
        const stat = await lstat(current);
        if (stat.isSymbolicLink()) throw new Error('Mascot refuses symbolic links inside its data directory.');
      }
    }
  }
  async owned(create = false): Promise<boolean> {
    // /tmp and /var are legitimate macOS aliases, but an ancestor symlink must
    // never redirect a custom data root into a protected application directory.
    let ancestor = this.root;
    while (!(await exists(ancestor))) ancestor = dirname(ancestor);
    const canonical = resolve(await realpath(ancestor), relative(ancestor, this.root));
    if (protectedLocation(canonical)) throw new Error('The data directory resolves into an existing application location.');
    await this.guard(this.root);
    if (!(await exists(this.root))) {
      if (!create) return false;
      await mkdir(this.root, { mode: 0o700, recursive: true });
    }
    const marker = this.path(MARKER);
    await this.guard(marker);
    if (!(await exists(marker))) {
      const entries = await readdir(this.root);
      if (!create || entries.length) throw new Error('This folder is not owned by Mascot. Existing files will not be adopted or changed.');
      await writeFile(marker, JSON.stringify({ owner: 'clawcoon', version: 1 }), { flag: 'wx', mode: 0o600 });
      await chmod(this.root, 0o700);
    }
    let value;
    try { value = JSON.parse(await readFile(marker, 'utf8')); } catch { throw new Error('The Mascot ownership marker is invalid. No existing file was changed.'); }
    if (value.owner !== 'clawcoon' || value.version !== 1) throw new Error('Invalid Mascot ownership marker.');
    return true;
  }
  async directory(...parts: string[]): Promise<string> {
    await this.owned(true);
    const path = this.path(...parts);
    await this.guard(path);
    await mkdir(path, { recursive: true, mode: 0o700 });
    return path;
  }
  async write(path: string, value: unknown): Promise<void> {
    await this.writeBytes(path, Buffer.from(JSON.stringify(value, null, 2) + '\n'));
  }
  async writeBytes(path: string, content: Uint8Array): Promise<void> {
    await this.owned(true);
    await this.guard(path);
    await this.directory(relative(this.root, dirname(path)));
    const temp = path + '.' + randomUUID() + '.tmp';
    await writeFile(temp, content, { mode: 0o600, flag: 'wx' });
    try { await this.guard(path); await rename(temp, path); } finally { await rm(temp, { force: true }); }
  }
  async read(path: string): Promise<unknown> {
    await this.owned(); await this.guard(path);
    try { return JSON.parse(await readFile(path, 'utf8')); }
    catch { throw new Error('A Mascot data file is missing or invalid JSON. It was left unchanged.'); }
  }
  async list(): Promise<Account[]> {
    if (!(await this.owned())) return [];
    const path = this.path('accounts.json');
    if (!(await exists(path))) return [];
    return Registry.parse(await this.read(path)).accounts;
  }
  async account(id: string): Promise<Account> {
    AccountId.parse(id);
    const account = (await this.list()).find(a => a.id === id);
    if (!account) throw new Error('Account not found.');
    return account;
  }
  async mutate(change: (accounts: Account[]) => Account[]): Promise<Account[]> {
    await this.owned(true);
    const lock = this.path('.accounts-lock');
    await this.guard(lock);
    try { await mkdir(lock, { mode: 0o700 }); } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'EEXIST') throw new Error('Another Mascot action is updating accounts. Try again shortly.');
      throw e;
    }
    try {
      const accounts = change(await this.list());
      await this.write(this.path('accounts.json'), Registry.parse({ version: 1, accounts }));
      return accounts;
    } finally { await rm(lock, { recursive: true }); }
  }
  async add(name: string): Promise<Account> {
    const account = Account.parse({ id: randomUUID(), name, createdAt: new Date().toISOString() });
    await this.mutate(accounts => {
      if (accounts.some(a => a.name.toLowerCase() === account.name.toLowerCase())) throw new Error('An account with this name already exists.');
      return [...accounts, account];
    });
    return account;
  }
  async rename(id: string, name: string): Promise<void> {
    await this.account(id);
    name = Account.shape.name.parse(name);
    await this.mutate(accounts => {
      if (accounts.some(a => a.id !== id && a.name.toLowerCase() === name.toLowerCase())) throw new Error('An account with this name already exists.');
      return accounts.map(a => a.id === id ? { ...a, name } : a);
    });
  }
  async remove(id: string): Promise<void> {
    await this.account(id);
    await this.mutate(accounts => accounts.filter(a => a.id !== id));
    // Deliberately keep the profile, sessions, and editor data. No logout, revocation or deletion.
  }
}
