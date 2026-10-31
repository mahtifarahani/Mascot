import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { Binding, type EnvEntry, type SettingsPort, type SettingsState } from '../src/core/binding';
import { Store } from '../src/core/store';
import { Service } from '../src/core/service';
import { Request } from '../src/protocol';

let directory: string;
let store: Store;
beforeEach(async () => { directory = await mkdtemp('/tmp/mb-'); store = new Store(join(directory, 'data')); });
afterEach(async () => { await rm(directory, { recursive: true, force: true }); });

class FakeSettings implements SettingsPort {
  globalVariables?: EnvEntry[];
  globalContinue?: boolean;
  inheritedAuthOverride = false;
  policyDirectory?: string;
  failNext = false;
  read(): SettingsState {
    return {
      globalVariables: this.globalVariables,
      effectiveVariables: this.policyDirectory ? [{ name: 'CLAUDE_CONFIG_DIR', value: this.policyDirectory }] : this.globalVariables ?? [],
      globalContinue: this.globalContinue, effectiveContinue: this.globalContinue ?? true,
      inheritedAuthOverride: this.inheritedAuthOverride,
    };
  }
  async variables(value: EnvEntry[] | undefined) {
    if (this.failNext) { this.failNext = false; throw new Error('write failed'); }
    this.globalVariables = value;
  }
  async continueAfterReload(value: boolean | undefined) { this.globalContinue = value; }
}

describe('same-window Claude profile selection', () => {
  it('changes only the Claude profile pointer, disables automatic replay, and stores no env secrets', async () => {
    const account = await store.add('Personal');
    const port = new FakeSettings();
    port.globalVariables = [{ name: 'CUSTOM_SETTING', value: 'untouched' }, { name: 'CUSTOM_TOKEN', value: 'synthetic-secret-not-for-backup' }];
    const binding = new Binding(store, port, 'host-profile-A');
    await binding.use(account.id);
    expect(port.globalVariables).toContainEqual({ name: 'CLAUDE_CONFIG_DIR', value: store.path('accounts', account.id, 'claude') });
    expect(port.globalVariables).toContainEqual({ name: 'CUSTOM_SETTING', value: 'untouched' });
    expect(port.globalContinue).toBe(false);
    expect(await readFile(binding.backupPath, 'utf8')).not.toContain('synthetic-secret-not-for-backup');
    expect(await readFile(binding.backupPath, 'utf8')).not.toContain('CUSTOM_TOKEN');
  });
  it('restores the original profile after multiple switches while preserving unrelated changes', async () => {
    const a = await store.add('A'); const b = await store.add('B');
    const port = new FakeSettings(); port.globalVariables = [{ name: 'CLAUDE_CONFIG_DIR', value: '/original-claude' }];
    const binding = new Binding(store, port, 'host-profile-A');
    await binding.use(a.id); await binding.use(b.id);
    port.globalVariables!.push({ name: 'NEW_SETTING', value: 'keep' });
    await binding.restore();
    expect(port.globalVariables).toEqual([{ name: 'NEW_SETTING', value: 'keep' }, { name: 'CLAUDE_CONFIG_DIR', value: '/original-claude' }]);
    expect(port.globalContinue).toBe(false);
  });
  it('restores an originally absent pointer without inventing a global config value', async () => {
    const a = await store.add('A'); const port = new FakeSettings();
    const binding = new Binding(store, port, 'host-profile-A');
    await binding.use(a.id); await binding.restore();
    expect(port.globalVariables).toBeUndefined();
  });
  it('rolls back both settings if a profile write fails', async () => {
    const a = await store.add('A'); const port = new FakeSettings();
    port.globalVariables = [{ name: 'EXISTING', value: 'keep' }]; port.failNext = true;
    await expect(new Binding(store, port, 'A').use(a.id)).rejects.toThrow('Previous settings were restored');
    expect(port.globalVariables).toEqual([{ name: 'EXISTING', value: 'keep' }]);
    expect(port.globalContinue).toBeUndefined();
  });
  it('does not bypass an effective managed profile setting', async () => {
    const a = await store.add('A'); const port = new FakeSettings(); port.policyDirectory = '/managed';
    await expect(new Binding(store, port, 'A').use(a.id)).rejects.toThrow('Previous settings were restored');
    expect(port.globalVariables).toBeUndefined();
    expect(port.read().effectiveVariables).toEqual([{ name: 'CLAUDE_CONFIG_DIR', value: '/managed' }]);
  });
  it('refuses provider/credential overrides before changing settings or creating a backup', async () => {
    const a = await store.add('A'); const port = new FakeSettings();
    port.globalVariables = [{ name: 'ANTHROPIC_API_KEY', value: 'synthetic-secret' }];
    const binding = new Binding(store, port, 'A');
    await expect(binding.use(a.id)).rejects.toThrow('override is active');
    expect(port.globalContinue).toBeUndefined();
    expect(await binding.canRestore()).toBe(false);
  });
  it('uses independent backups for different settings scopes', async () => {
    const port = new FakeSettings();
    expect(new Binding(store, port, 'profile-A').backupPath).not.toBe(new Binding(store, port, 'profile-B').backupPath);
  });
  it('prepares only a Claude profile without creating editor data or invoking installers', async () => {
    const a = await store.add('A');
    const service = new Service(store, '/unused', async () => { throw new Error('No process should be started.'); });
    await service.prepareProfile(a.id);
    expect(await readdir(store.path('accounts', a.id))).toEqual(expect.arrayContaining(['claude', 'claude-prepared.json']));
    expect(await readdir(store.path('accounts', a.id))).not.toContain('editors');
    expect(await readdir(store.root)).not.toContain('e');
  });
  it('rejects old editor provisioning messages and accepts account selection', () => {
    const id = '11111111-1111-4111-8111-111111111111';
    for (const type of ['setup', 'launch', 'editor']) expect(Request.safeParse({ type, id, editor: 'cursor' }).success).toBe(false);
    expect(Request.safeParse({ type: 'switch', id }).success).toBe(true);
    expect(Request.safeParse({ type: 'terminal', id }).success).toBe(true);
  });
});
