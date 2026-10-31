# Mascot 0.2.2 implementation report

## Account safety documentation

README now explains that the absence of replacement chat, model API calls, subscription proxying, token handling, automatic quota rotation and automatic handoff submission is intentional to reduce account risk. It explicitly avoids promising protection from account restrictions or bans or claiming Anthropic approval. This is a documentation-only clarification; runtime behavior is unchanged. Validation: reviewed against the documented product boundaries and checked with `git diff --check`.

## Release automation

Added `.github/workflows/release.yml`, `scripts/release-notes.mjs`, a dated changelog and `docs/release.md`. A matching version tag builds and checks the extension, creates a GitHub Release with VSIX/checksums, and publishes stable versions to Open VSX using OVSX_PAT. Prereleases stay on GitHub and Marketplace remains manual. This does not change runtime or account behavior. Chrome shows the existing registry version as Public, but the Mascot namespace remains unverified and cannot yet use trusted publishing. Secret setup and an end-to-end release remain pending; no successful registry CI publication is claimed.

Local verification passed: TypeScript, all 35 regression tests, CLI smoke, package build, and packaged extension smoke using temporary directories/offline fake Claude. Temporary-fixture release guard checks passed for a matching version, mismatched version, invalid ref, empty notes and changelog section boundaries. No tag was created and no existing registry version was replaced.

Date: 2026-10-31.

## Result

Mascot selects Claude accounts in the existing official Claude Code panel, or launches official Claude directly in a terminal. Editor selection, isolated editor setup, installers and new editor windows are absent from the current UI and CLI. Existing account config folders are retained. All current extension, command, environment, executable and ownership identifiers use Mascot.

## Profile switching

`src/core/binding.ts` changes only the CLAUDE_CONFIG_DIR entry of the official extension environment setting and disables continueAfterReload. Other environment entries are preserved. A per-settings-scope lock prevents overlapping changes. A private backup stores only the original directory pointer and whether the environment setting existed. Write failures attempt rollback; ineffective managed settings block switching. Active credential/provider overrides are refused rather than copied or replaced. Restoring the old pointer deliberately leaves interrupted-turn continuation disabled.

The settings port uses the native global Configuration API. The environment setting is machine-scoped and the continuation flag application-scoped in the inspected official manifest. Other windows sharing user settings can therefore be affected. The native confirmation asks users to stop/close existing chats and background tools before reloading the current window. Mascot cannot inspect or stop their running tools. A one-time pending intent opens official Claude after reload; it never submits a prompt or retries on later startups.

`src/core/service.ts` prepares only an owned account's Claude settings and verifies its marker. It preserves existing profile paths and credentials, seeds autoInstallIdeExtension:false and refuses profile auth/provider environment overrides. Editor setup helpers remain for regression coverage; no current production request or CLI command routes to them.

`src/extension/extension.ts` opens the registered official chat command in the same window. Terminal actions use the official bundled executable directly, strict child environment and no login shell. `src/cli.ts` runs an installed official executable with inherited terminal IO. Neither path installs an editor or extension. No default Claude directory, shell startup file, token or Keychain item is accessed by Mascot.

## Safety and data

Store retains private permissions, ownership, path/symlink guards and registry locking. Existing data stays under ~/.mascot; account profiles are accounts/<uuid>/claude, handoffs are handoffs/<uuid>.json, and pointer backups are bindings/<settings-scope-hash>.json. Remove deletes only the label. Trust and local-workspace checks precede extension mutations/process actions. Child diagnostics are sanitized; the interactive CLI intentionally connects official Claude's IO to the user's terminal.

Refresh reads local metadata only. Sign-in checks are explicit official auth status calls with a selected config directory; only allowlisted metadata is shown. Selected profile and verified sign-in are distinct. Usage remains in official Claude. Handoffs open a reviewed local reference without automatic prompt submission. Profile separation does not isolate a shared worktree.

## Validation

Type checks, 35 unit/regression tests, CLI smoke, build/package and packaged-extension smoke are required. The packaged smoke uses real temporary VS Code settings and the bundled React webview, with a clearly marked offline official-extension fixture. It checks native config-pointer switching/restoration, replay suppression and official command routing. It does not validate real authentication, Keychain behavior, live reload recovery or subscription entitlements. Those checks remain manual and must not be represented as automated proof.

The official documentation currently supports absolute CLAUDE_CONFIG_DIR in extension environmentVariables and directory-specific macOS Keychain entries: [extension settings](https://code.claude.com/docs/en/vs-code#extension-settings), [credential management](https://code.claude.com/docs/en/authentication#credential-management). Installed-version behavior must be verified manually without touching default credentials. No guarantee against account enforcement is made.

## Completed validation and local deployment

All 35 tests, TypeScript, build/package, direct-terminal CLI smoke and the packaged extension smoke passed. The terminal smoke used a fake executable and checked the selected directory, empty argv and filtering of a synthetic API key. Forty synthetic layout combinations across widths 220–900px had no horizontal overflow; the 320px account panel was visually inspected. Mascot 0.2.1 was installed into the user's existing Cursor under their explicit request and its registry version was verified. No real account login or selection was performed; official Claude and Claude Desktop were not updated.

## Publication naming

The user selected namespace Mascot and requested removal of the old product name throughout current project files. Public identity is Mascot.mascot, version 0.2.1. Runtime command/view/env names, ownership marker and CLI artifact use Mascot. The previous implementation archive was removed from the current tree. Historical Git commits are retained. Account configuration paths do not change. The earlier registry upload remains inactive and is not the intended public release. Previous preview extensions must be disabled before installing the new identity.

The local owned-root marker was renamed after checking it with the previous Store, writing the new marker through that Store, and verifying unchanged account records with the current Store. A fake temporary-root rehearsal passed first. Both local account records and all config directories were preserved; no credential file was read. Mascot.mascot 0.2.1 replaced the earlier preview in the normal editor registry under the user's installation request.

Open VSX namespace Mascot was created under the user account. The incorrectly named initial registry version was permanently removed after explicit user confirmation; registry UI reports Deleted/REMOVED. Mascot.mascot 0.2.1 was uploaded successfully through Chrome after the user enabled local-file access. Open VSX accepted the package and queued it for review; public activation is pending registry processing. No ownership-claim message has been submitted.

## Panel UI/UX pass

The sidebar panel (`src/webview`) now shows a per-account status dot and chip (signed in, signed out, not checked, check failed); only an explicit sign-in check can say Signed in, and a selected profile is labelled as unverified. The selected account has one action card (Use account / Open Claude, Terminal, Check sign-in, Usage) with a reload hint. Rename, folder and Remove sit under More. Accounts use a radio group with arrow-key navigation, the tabs use tablist semantics, and Escape closes forms. Notices and errors are dismissible, per-action busy messages replace "Working…", a missing official extension is a top-level warning, and the empty state explains the three setup steps. A newly added account is selected automatically, a saved handoff closes and clears its form, and the tab, selection and handoff draft survive panel hides and reloads through webview state (the panel only stores local form text, never credentials). Light, dark and high-contrast themes use VS Code colour tokens; text is at least 11px. No request, permission or isolation behavior changed. Checked at 300px in a local harness with dark/light tokens; the packaged smoke test and the 35 unit tests still pass. Real-editor theme and screen-reader checks remain manual.

The last explicit Check sign-in result per account (state, email, method, time; no tokens) is remembered in the extension's global state so a window reload after switching does not reset every account to Not checked. It is never refreshed automatically: refresh, reload and switching still perform no auth probe, and the panel shows when each result was last checked. Removing a label forgets its remembered result.

A status bar item (bottom left) shows `Claude: <label>` for the account whose profile the official extension is currently set to use, or `default profile` when no Mascot profile is selected. It is derived from the same local setting and registry as the panel, updates when that setting changes, opens Mascot on click, and never probes auth. The tooltip says the sign-in is unverified unless an explicit check was remembered. Each account has one colour derived from its id (`src/palette.ts`), used for the panel avatar and the status bar text, so it stays the same when the list changes. The status bar uses text colour only and adjusts lightness for light and dark themes.

## Automated release preparation 0.2.2

Version 0.2.2 includes the committed panel and status bar changes, preserving account paths and the Mascot.mascot identity. This is the first new version intended for the tag-based publishing workflow; 0.2.1 is already published and must not be reused. GitHub confirmed OVSX_PAT was added through Chrome. Local TypeScript, 37 regression tests, CLI smoke, VSIX packaging, packaged extension smoke and release-note validation passed for 0.2.2. GitHub Actions run 41193801211 completed successfully: tag validation, dependency installation, checks, packaging, GitHub Release handling and Open VSX upload all passed. GitHub Release v0.2.2 contains the VSIX and SHA256SUMS. No normal editor installation is part of this release task.

Initial CI run 41193651665 passed validation, install, checks, CLI smoke, packaging, checksums and GitHub Release creation. The Open VSX step failed before contacting the registry: pnpm 12 dlx rejected ignored native dependency builds. The workflow now runs the pinned uploader through npm exec with lifecycle scripts disabled; existing VSIX files require no native signing/keychain helpers. Manual dispatch retries the existing tag with the corrected workflow and retains its GitHub Release.

The corrected uploader was checked locally with `npm exec --yes --ignore-scripts --package=ovsx@1.2.0 -- ovsx --version` (1.2.0). Manual workflow dispatch on main retried v0.2.2 successfully without moving the tag or replacing existing GitHub assets. Normal branch pushes still do not publish; future releases require new matching version tags.

Open VSX owner settings verified Mascot.mascot latest version 0.2.2 with Status Public, listing both 0.2.2 and the retained 0.2.1. The uploader log confirms Published Mascot.mascot v0.2.2. Namespace verification remains separate from this successful publication.
