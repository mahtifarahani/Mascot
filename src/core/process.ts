import { execFile } from 'node:child_process';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';

export type RunResult = { code: number; stdout: string };
export type Runner = (file: string, args: string[], options: { cwd: string; env: NodeJS.ProcessEnv; timeout?: number }) => Promise<RunResult>;

/** No shell, no stderr forwarding, and no raw command output in errors or diagnostics. */
export const run: Runner = (file, args, options) => new Promise((resolve, reject) => {
  execFile(file, args, { ...options, timeout: options.timeout ?? 20_000, maxBuffer: 2 * 1024 * 1024, encoding: 'utf8' }, (err, stdout) => {
    if (err && (typeof err.code !== 'number' || err.killed)) return reject(new Error(err.killed ? 'The command timed out. No account was changed.' : 'Could not start the required executable.'));
    resolve({ code: err && typeof err.code === 'number' ? err.code : 0, stdout: String(stdout) });
  });
});

// Do not inherit OAuth tokens, API keys, provider overrides, an existing editor IPC socket,
// Electron mode, NODE_OPTIONS, or shell startup hooks from the parent process.
export function isolatedEnv(configDir: string, root: string, accountId: string, source: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  const allowed = ['HOME', 'USER', 'LOGNAME', 'SHELL', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TMPDIR', 'DISPLAY', 'SSH_AUTH_SOCK', '__CF_USER_TEXT_ENCODING', 'HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'NO_PROXY', 'http_proxy', 'https_proxy', 'all_proxy', 'no_proxy', 'SSL_CERT_FILE', 'SSL_CERT_DIR', 'NODE_EXTRA_CA_CERTS'];
  for (const key of allowed) if (source[key]) env[key] = source[key];
  env.PATH = [...new Set([...(source.PATH ?? '').split(delimiter), join(homedir(), '.local/bin'), '/opt/homebrew/bin', '/usr/local/bin', '/usr/bin', '/bin'].filter(Boolean))].join(delimiter);
  env.CLAUDE_CONFIG_DIR = configDir;
  env.MASCOT_ROOT = root;
  env.MASCOT_ACCOUNT_ID = accountId;
  return env;
}

export const CLEARED_CLAUDE_ENV = [
  'ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_BASE_URL',
  'CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_PROFILE', 'CLAUDE_CODE_USE_BEDROCK',
  'CLAUDE_CODE_USE_VERTEX', 'CLAUDE_CODE_USE_FOUNDRY', 'CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST',
];
