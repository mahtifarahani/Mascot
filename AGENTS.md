# Mascot

Read `README.md`, `docs/implementation.md` and `docs/manual-validation.md` before changing behavior.

## Product boundary

Mascot is a local account/environment manager for **official Claude Code chat**. It has no replacement chat, model API client, subscription proxy, quota rotation, or remote service. The product identity is Mascot. Keep legacy internal extension IDs, ownership markers, and environment variable names stable so existing isolated accounts remain compatible.

## Non-negotiable isolation

- Never write to Claude Desktop, existing `~/.claude` / `~/.claude.json`, normal editor user data, or normal editor extension directories.
- Never read, copy, print, revoke, refresh, or migrate account tokens. Official Claude owns login and its directory-specific credentials.
- Managed writes go through `Store` ownership/path/symlink checks. Keep all editor launcher commands explicit about BOTH user-data and extensions directories; never fall back to the normal editor.
- No installers, auth probes, model calls or launches during detection/polling. Setup and auth metadata checks require user actions.
- No automatic logout or recursive account cleanup. Remove only the registry entry.
- Preserve trust checks, configured provider policies, interrupted-turn safeguards, and no-shell process execution. Never forward raw child stdout/stderr to the webview or errors.
- Test only with temporary directories and fake account data. Do not log into real accounts or install into existing apps during automated tests.
- A separate account environment does not isolate a shared project worktree. Never claim it does.

## Development

`pnpm install`; `pnpm check`; `pnpm test:cli`; `pnpm package`; `pnpm test:extension --packaged`.

The extension test starts installed VS Code with temporary user-data/extensions directories and no official Claude extension. `artifacts/mascot-0.1.6.vsix` is the installable full package; the bootstrap VSIX is an implementation detail. Update the implementation report when behavior or validation changes. Do not overwrite unrelated local changes, including `.vscode` settings.
