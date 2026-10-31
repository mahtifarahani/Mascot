import * as vscode from 'vscode';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { Store } from '../core/store';
import { Service } from '../core/service';
import { Binding } from '../core/binding';
import { createClaudeSettingsPort } from './extension';

export async function run(): Promise<void> {
  const root = process.env.CLAWCOON_TEST_ROOT;
  assert.ok(root, 'An explicit temporary test root is required.');
  const own = vscode.extensions.getExtension('clawcoon.clawcoon');
  assert.ok(own, 'Development extension was discovered.');
  await own.activate();
  const commands = await vscode.commands.getCommands(true);
  assert.ok(commands.includes('clawcoon.open'));
  assert.ok(commands.includes('clawcoon.openClaude'));
  const official = vscode.extensions.getExtension('anthropic.claude-code');
  assert.ok(official?.packageJSON.mascotTestFixture, 'Only the fake, offline Claude extension may be present in this smoke environment.');
  const store = new Store(root);
  assert.deepEqual(await store.list(), []);
  const account = await store.add('Smoke account');
  assert.equal((await store.account(account.id)).name, 'Smoke account');
  await vscode.commands.executeCommand('clawcoon.open');
  await own.exports.waitForPanelReady();
  const service = new Service(store, '/unused');
  await service.prepareProfile(account.id);
  const binding = new Binding(store, createClaudeSettingsPort(), 'native-smoke');
  await binding.use(account.id);
  assert.equal(vscode.workspace.getConfiguration('claudeCode').get<{ name: string; value: string }[]>('environmentVariables')?.find(v => v.name === 'CLAUDE_CONFIG_DIR')?.value, service.profilePath(account.id));
  assert.equal(vscode.workspace.getConfiguration('claudeCode').get('continueAfterReload'), false);
  await vscode.commands.executeCommand('clawcoon.openClaude');
  assert.equal(official.exports.openCount(), 1, 'The command routes to the official panel API, not an editor launcher.');
  await binding.restore();
  assert.equal(vscode.workspace.getConfiguration('claudeCode').inspect('environmentVariables')?.globalValue, undefined);
  await own.exports.refresh();
  assert.deepEqual((await readdir(root)).sort(), ['.clawcoon-owned.json', 'accounts', 'accounts.json', 'bindings']);
  console.log('CLAWCOON_EXTENSION_SMOKE_PASSED: packaged UI, native settings switch/restore, same-window command routing; offline fake Claude only.');
}
