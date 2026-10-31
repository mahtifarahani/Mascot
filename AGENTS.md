# Mascot

Read `README.md`, `docs/implementation.md` and `docs/manual-validation.md` before changing behavior.

## Product boundary

Mascot is a local account switcher for **official Claude Code chat**. It has no replacement chat, model API client, subscription proxy, quota rotation, or remote service. The product identity is Mascot. The public namespace is Mascot and the extension ID is Mascot.mascot. Commands, environment keys, ownership metadata and executables use Mascot naming. Keep account configuration paths stable; never rename credential namespaces.

## Non-negotiable isolation

- Never write to Claude Desktop or existing `~/.claude` / `~/.claude.json`. Explicit account switching may update only the CLAUDE_CONFIG_DIR entry in official `claudeCode.environmentVariables` and `claudeCode.continueAfterReload` through the native configuration API. Preserve unrelated settings. Normal extension installation requires explicit user authorization.
- Never read, copy, print, revoke, refresh, or migrate account tokens. Official Claude owns login and its directory-specific credentials.
- Managed writes go through `Store` ownership/path/symlink checks. Current product entrypoints must not launch or install editor environments. Retained legacy launch helpers must explicitly specify BOTH user-data and extensions directories.
- No installers, auth probes, model calls or launches during detection/polling. Setup and auth metadata checks require user actions.
- No automatic logout or recursive account cleanup. Remove only the registry entry.
- Preserve trust checks, configured provider policies, interrupted-turn safeguards, and no-shell process execution. Never forward raw child stdout/stderr to the webview or errors.
- Test only with temporary directories and fake account data. Do not log into real accounts or install into existing apps during automated tests.
- A separate account environment does not isolate a shared project worktree. Never claim it does.

## Development

`pnpm install`; `pnpm check`; `pnpm test:cli`; `pnpm package`; `pnpm test:extension --packaged`.

The extension test starts installed VS Code with temporary user-data/extensions directories and an offline fake Claude extension. `artifacts/mascot-0.2.2.vsix` is the installable package; there is no bootstrap installation flow. Update the implementation report when behavior or validation changes. Do not overwrite unrelated local changes, including `.vscode` settings.
