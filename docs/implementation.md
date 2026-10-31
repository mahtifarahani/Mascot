# Mascot 0.2.0 implementation report

Date: 2026-10-31.

## Result

Mascot selects Claude accounts in the existing official Claude Code panel, or launches official Claude directly in a terminal. Editor selection, isolated editor setup, installers and new editor windows are absent from the current UI and CLI. Legacy account folders, ownership markers and internal IDs are retained. The earlier design is archived in `implementation-0.1.md`.

## Profile switching

`src/core/binding.ts` changes only the CLAUDE_CONFIG_DIR entry of the official extension environment setting and disables continueAfterReload. Other environment entries are preserved. A per-settings-scope lock prevents overlapping changes. A private backup stores only the original directory pointer and whether the environment setting existed. Write failures attempt rollback; ineffective managed settings block switching. Active credential/provider overrides are refused rather than copied or replaced. Restoring the old pointer deliberately leaves interrupted-turn continuation disabled.

The settings port uses the native global Configuration API. The environment setting is machine-scoped and the continuation flag application-scoped in the inspected official manifest. Other windows sharing user settings can therefore be affected. The native confirmation asks users to stop/close existing chats and background tools before reloading the current window. Mascot cannot inspect or stop their running tools. A one-time pending intent opens official Claude after reload; it never submits a prompt or retries on later startups.

`src/core/service.ts` prepares only an owned account's Claude settings and verifies its marker. It preserves existing profile paths and credentials, seeds autoInstallIdeExtension:false and refuses profile auth/provider environment overrides. Legacy editor setup helpers remain for compatibility/regression coverage; no current production request or CLI command routes to them.

`src/extension/extension.ts` opens the registered official chat command in the same window. Terminal actions use the official bundled executable directly, strict child environment and no login shell. `src/cli.ts` runs an installed official executable with inherited terminal IO. Neither path installs an editor or extension. No default Claude directory, shell startup file, token or Keychain item is accessed by Mascot.

## Safety and data

Store retains private permissions, ownership, path/symlink guards and registry locking. Existing data stays under ~/.mascot; account profiles are accounts/<uuid>/claude, handoffs are handoffs/<uuid>.json, and pointer backups are bindings/<settings-scope-hash>.json. Remove deletes only the label. Trust and local-workspace checks precede extension mutations/process actions. Child diagnostics are sanitized; the interactive CLI intentionally connects official Claude's IO to the user's terminal.

Refresh reads local metadata only. Sign-in checks are explicit official auth status calls with a selected config directory; only allowlisted metadata is shown. Selected profile and verified sign-in are distinct. Usage remains in official Claude. Handoffs open a reviewed local reference without automatic prompt submission. Profile separation does not isolate a shared worktree.

## Validation

Type checks, 35 unit/regression tests, CLI smoke, build/package and packaged-extension smoke are required. The packaged smoke uses real temporary VS Code settings and the bundled React webview, with a clearly marked offline official-extension fixture. It checks native config-pointer switching/restoration, replay suppression and official command routing. It does not validate real authentication, Keychain behavior, live reload recovery or subscription entitlements. Those checks remain manual and must not be represented as automated proof.

The official documentation currently supports absolute CLAUDE_CONFIG_DIR in extension environmentVariables and directory-specific macOS Keychain entries: [extension settings](https://code.claude.com/docs/en/vs-code#extension-settings), [credential management](https://code.claude.com/docs/en/authentication#credential-management). Installed-version behavior must be verified manually without touching default credentials. No guarantee against account enforcement is made.

## Completed validation and local deployment

All 35 tests, TypeScript, build/package, direct-terminal CLI smoke and the packaged extension smoke passed. The terminal smoke used a fake executable and checked the selected directory, empty argv and filtering of a synthetic API key. Forty synthetic layout combinations across widths 220–900px had no horizontal overflow; the 320px account panel was visually inspected. Mascot 0.2.0 was installed into the user's existing Cursor under their explicit request and its registry version was verified. No real account login or selection was performed; official Claude and Claude Desktop were not updated.
