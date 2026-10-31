import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const temp = await mkdtemp(join(tmpdir(), 'clawcoon-cli-smoke-'));
const root = join(temp, 'data');
const executable = resolve('dist/clawcoon.mjs');
const invoke = args => JSON.parse(execFileSync(process.execPath, [executable, '--data-dir', root, ...args], { encoding: 'utf8' }));
try {
  assert.deepEqual(invoke(['accounts', 'list']), []);
  assert.deepEqual(await readdir(temp), []);
  const account = invoke(['accounts', 'add', 'Personal']);
  assert.equal(account.name, 'Personal');
  invoke(['accounts', 'rename', account.id, 'Studio']);
  assert.equal(invoke(['accounts', 'list'])[0].name, 'Studio');
  const draft = join(temp, 'draft.json');
  await writeFile(draft, JSON.stringify({ title: 'CLI handoff', goal: 'Test local context', summary: 'No model calls', next: 'Review' }));
  const handoff = invoke(['handoff', 'create', account.id, temp, '--draft', draft]);
  assert.equal(handoff.title, 'CLI handoff');
  assert.equal(invoke(['handoff', 'list'])[0].id, handoff.id);
  assert.equal(invoke(['accounts', 'remove', account.id]).profileDataKept, true);
  assert.deepEqual(invoke(['accounts', 'list']), []);
  console.log('CLI smoke passed: private registry CRUD and handoff create/list; no install, login, editor launch or model request.');
} finally { await rm(temp, { recursive: true, force: true }); }
