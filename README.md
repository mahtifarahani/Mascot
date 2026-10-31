# Mascot

A separate home for every Claude Code account. Mascot manages manually selected accounts and local handoffs; your conversations remain in **Anthropic’s official Claude Code extension**.

Mascot does not use the Claude API, proxy subscription requests, read tokens, or rotate accounts after a usage limit. It is an independent companion, not an Anthropic product. It does not promise immunity from account enforcement.

## Isolation comes first

- Every account gets its own Claude configuration, editor user-data directory, and editor extensions directory under `~/.mascot`.
- Mascot never installs into your normal editor or changes Claude Desktop, `~/.claude`, `~/.claude.json`, or existing credentials. Install the initial Mascot VSIX yourself in the editor where you want its account picker.
- There is no automatic login, logout, token import, revocation, update, or cleanup of account data. Sign in yourself inside official Claude in the new window. To choose another browser account, use the official login flow without signing out of your existing Claude apps.
- Setup is explicit. It installs the official extension and a packaged Mascot companion only in the selected account’s extension directory. Automatic editor/extension updates and interrupted-turn continuation are disabled in these new environments.
- The original editor’s settings, themes, plugins, and Claude memories are not copied into the new environments. Configure them separately as needed.
- Authentication metadata is read only when you request it, using the official CLI bundled in the **isolated** official extension. Mascot requires that CLI to report the expected config directory. It never reads the Keychain or credentials files itself.
- Independent account folders do not isolate project files: stop tools in the old window before continuing the same project in another account, or use separate worktrees.

## Requirements

macOS Apple Silicon, Node.js 22+ for the CLI, and Cursor or VS Code in `/Applications`. Use local, trusted folders. Remote workspaces, Windows, Linux, automatic quota failover, shared OAuth credentials, and embedded replacement chat are outside this release.

## Build and package

```sh
pnpm install
pnpm check
pnpm package
```

Install `artifacts/mascot-0.1.6.vsix` using **Extensions → … → Install from VSIX**. This full package contains the small companion installer needed to prepare separate account environments. Nothing is installed or launched by the build or package commands.

1. Open Mascot in the Activity Bar and add an account label.
2. Mascot detects the current editor and displays **Running in Cursor** or **Running in VS Code**. Click **Set up account** and confirm the isolated installation.
3. Click **Open account**, choose a project, and stop other tools editing it.
4. In the new window, use Mascot’s **Open Claude** button. Complete official Claude’s onboarding and sign-in using that account’s subscription.
5. Check the actual account in official Claude. **Check usage** copies `/usage` for you to paste and submit there. No usage polling or model request is sent by Mascot.

The official extension’s login and usage UI remains the authority. A successful setup is not proof of a successful sign-in. The companion refuses to target the original editor’s Claude panel.

## CLI

```sh
node dist/clawcoon.mjs --help
node dist/clawcoon.mjs accounts add "Personal"
node dist/clawcoon.mjs accounts list
node dist/clawcoon.mjs setup ACCOUNT_UUID --editor cursor
node dist/clawcoon.mjs open ACCOUNT_UUID /absolute/project --editor cursor
node dist/clawcoon.mjs status ACCOUNT_UUID --editor cursor
```

Account IDs are UUIDs printed by `accounts list`. `--data-dir /absolute/empty/directory` chooses another private root; Mascot refuses to adopt a nonempty unowned directory and refuses symlinks inside its managed root. `accounts remove ID` removes only the registry entry: sessions, credentials and editor data are retained and no logout occurs. Close that account’s windows before removing it. There is deliberately no destructive cleanup command.

## Handoffs

Write a short task summary in **Handoffs**. Mascot adds the project path, branch, commit and changed file names using read-only Git commands. Optional reference files are recorded as paths; their contents are not copied. The JSON package is stored privately and opened in the destination account’s editor. Paste the reference prompt into official Claude yourself.

Handoffs are task context, not session migration. They do not transfer hidden reasoning, live tools, temporary permissions, account entitlements or secrets. Review the package before moving work across personal and organizational accounts. If a limit has already been reached, write the summary yourself or attach an existing official export; Mascot does not make a model call to summarize it.

## Validation and limits

`pnpm test` uses temporary directories and fake process runners, covering isolation, symlink rejection, setup/launch argv, credential environment filtering, metadata validation and handoffs. `pnpm test:cli` exercises the built CLI in a temporary root. After packaging, `pnpm test:extension --packaged` installs the actual VSIX and launches its code in an Extension Development Host using temporary editor directories with no official Claude extension, login or model call. The test never installs into your normal editor.

Real multi-account login and the official extension’s Keychain behavior must be verified manually before relying on this preview. No real-account login is part of automated testing. Corporate managed settings are not overridden; incompatible configurations should be handled through your administrator, not bypassed.

See [the implementation report](docs/implementation.md), [the smoke-test checklist](docs/manual-validation.md), and [the original research](docs/research/2026-10-31-account-switching.md).

Brand direction: the supplied raccoon identity (the original Clawcoon reference), now named Mascot, with an orange raccoon mark, charcoal surfaces and warm neutrals. The included SVG is an implementation approximation of that reference. The interface also follows the editor’s light, dark and high-contrast themes.
