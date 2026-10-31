import { createHash } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import { z } from 'zod';
import { AccountId } from '../protocol';
import { CLEARED_CLAUDE_ENV } from './process';
import { exists, Store } from './store';

export type EnvEntry = { name: string; value: string };
export type SettingsState = {
  globalVariables?: EnvEntry[];
  effectiveVariables: EnvEntry[];
  globalContinue?: boolean;
  effectiveContinue: boolean;
  inheritedAuthOverride: boolean;
};
export interface SettingsPort {
  read(): SettingsState;
  variables(value: EnvEntry[] | undefined): Promise<void>;
  continueAfterReload(value: boolean | undefined): Promise<void>;
}
const Backup = z.object({ version: z.literal(1), originalDirectory: z.string().nullable(), variablesDefined: z.boolean() });

export function withConfigDirectory(entries: EnvEntry[] | undefined, directory: string | null, keepEmpty = true): EnvEntry[] | undefined {
  const result = (entries ?? []).filter(entry => entry.name !== 'CLAUDE_CONFIG_DIR');
  if (directory !== null) result.push({ name: 'CLAUDE_CONFIG_DIR', value: directory });
  return result.length || keepEmpty ? result : undefined;
}

/** Changes only the official Claude extension's profile pointer and replay safeguard. */
export class Binding {
  readonly backupPath: string;
  constructor(readonly store: Store, readonly port: SettingsPort, scope: string) {
    this.backupPath = store.path('bindings', createHash('sha256').update(scope).digest('hex') + '.json');
  }
  async canRestore(): Promise<boolean> {
    if (!(await this.store.owned())) return false;
    await this.store.guard(this.backupPath);
    return exists(this.backupPath);
  }
  private checkOverrides(state: SettingsState): void {
    if (state.inheritedAuthOverride || state.effectiveVariables.some(v => CLEARED_CLAUDE_ENV.includes(v.name) && !!v.value)) {
      throw new Error('A credential or provider override is active. Remove it through official Claude settings before switching subscription accounts. Mascot will not copy or replace it.');
    }
  }
  private async apply(directory: string | null, keepEmpty: boolean): Promise<void> {
    const before = this.port.read();
    this.checkOverrides(before);
    try {
      await this.port.continueAfterReload(false);
      await this.port.variables(withConfigDirectory(before.globalVariables, directory, keepEmpty));
      const after = this.port.read();
      this.checkOverrides(after);
      const config = after.effectiveVariables.filter(v => v.name === 'CLAUDE_CONFIG_DIR');
      if (after.effectiveContinue || (directory === null ? config.length !== 0 : config.length !== 1 || config[0].value !== directory)) {
        throw new Error('A managed or workspace setting prevents the selected Claude profile from taking effect.');
      }
    } catch {
      try { await this.port.variables(before.globalVariables); await this.port.continueAfterReload(before.globalContinue); }
      catch { throw new Error('The Claude setting change failed and could not be fully rolled back. Review Claude settings before continuing.'); }
      throw new Error('The Claude setting change could not be verified. Previous settings were restored.');
    }
  }
  private async exclusive(action: () => Promise<void>): Promise<void> {
    await this.store.directory('bindings');
    const lock = this.backupPath + '.lock';
    await this.store.guard(lock);
    try { await mkdir(lock, { mode: 0o700 }); }
    catch { throw new Error('Another account switch is in progress. Try again when it finishes.'); }
    try { await action(); } finally { await rm(lock, { recursive: true }); }
  }
  private async useLocked(id: string): Promise<void> {
    AccountId.parse(id); await this.store.account(id);
    const directory = this.store.path('accounts', id, 'claude');
    const before = this.port.read();
    this.checkOverrides(before);
    if (!(await this.canRestore())) {
      const originals = (before.globalVariables ?? []).filter(v => v.name === 'CLAUDE_CONFIG_DIR');
      if (originals.length > 1) throw new Error('Duplicate Claude configuration directories are set. Resolve them in official Claude settings first.');
      // Only a non-secret path is retained. Never back up arbitrary env values or tokens.
      await this.store.write(this.backupPath, { version: 1, originalDirectory: originals[0]?.value ?? null, variablesDefined: before.globalVariables !== undefined });
    }
    await this.apply(directory, true);
  }
  async use(id: string): Promise<void> {
    await this.exclusive(() => this.useLocked(id));
  }
  async restore(): Promise<void> {
    await this.exclusive(async () => {
      if (!(await this.canRestore())) throw new Error('There is no previous Claude profile to restore.');
      const backup = Backup.parse(await this.store.read(this.backupPath));
      await this.apply(backup.originalDirectory, backup.variablesDefined);
    });
  }
}
