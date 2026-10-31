import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { chmod, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const temp = await mkdtemp(join(tmpdir(), 'mascot-cli-smoke-'));
const root = join(temp, 'data');
const executable = resolve('dist/mascot.mjs');
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
  const fake = join(temp, 'offline-claude');
  await writeFile(fake, '#!' + process.execPath + '\nconsole.log(JSON.stringify({directory:process.env.CLAUDE_CONFIG_DIR, leaked:!!process.env.ANTHROPIC_API_KEY, args:process.argv.slice(2)}));\n');
  await chmod(fake, 0o700);
  const launched = JSON.parse(execFileSync(process.execPath, [executable, '--data-dir', root, '--claude', fake, 'run', account.id, temp], { encoding: 'utf8', env: { ...process.env, ANTHROPIC_API_KEY: 'synthetic-test-only' } }));
  assert.equal(launched.directory, join(root, 'accounts', account.id, 'claude'));
  assert.equal(launched.leaked, false);
  assert.deepEqual(launched.args, []);
  assert.equal(invoke(['accounts', 'remove', account.id]).profileDataKept, true);
  assert.deepEqual(invoke(['accounts', 'list']), []);
  console.log('CLI smoke passed: registry, handoffs and direct terminal routing with an offline fake executable; no login or model request.');
} finally { await rm(temp, { recursive: true, force: true }); }
