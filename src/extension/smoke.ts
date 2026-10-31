import * as vscode from 'vscode';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { Store } from '../core/store';

export async function run(): Promise<void> {
  const root = process.env.CLAWCOON_TEST_ROOT;
  assert.ok(root, 'An explicit temporary test root is required.');
  const own = vscode.extensions.getExtension('clawcoon.clawcoon');
  assert.ok(own, 'Development extension was discovered.');
  await own.activate();
  const commands = await vscode.commands.getCommands(true);
  assert.ok(commands.includes('clawcoon.open'));
  assert.ok(commands.includes('clawcoon.openClaude'));
  assert.ok(!vscode.extensions.getExtension('anthropic.claude-code'), 'Official Claude is deliberately not installed in this smoke environment.');
  const store = new Store(root);
  assert.deepEqual(await store.list(), []);
  const account = await store.add('Smoke account');
  assert.equal((await store.account(account.id)).name, 'Smoke account');
  await vscode.commands.executeCommand('clawcoon.open');
  await own.exports.waitForPanelReady();
  await own.exports.refresh();
  assert.deepEqual((await readdir(root)).sort(), ['.clawcoon-owned.json', 'accounts.json']);
  console.log('CLAWCOON_EXTENSION_SMOKE_PASSED: activation, commands, sidebar, private registry; no official Claude login or launch.');
}
