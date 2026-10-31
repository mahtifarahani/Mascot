# Mascot 0.1.6 implementation report

Date: 2026-10-31. Repository: `/Users/mahdifarahani/Projects/Mascot`.

## Implemented outcome

Mascot is a VS Code/Cursor companion with a branded account panel, a standalone CLI, separate official Claude Code environments and local handoffs. Chat is not implemented or intercepted: a command opens the official extension’s chat inside the selected isolated environment. No inference API, OAuth handler, subscription gateway or automatic quota fallback exists in the code.

The final product decision replaces the original R&D suggestion of a custom chat/SDK frontend. Usage remains in the official `/usage` dialog. The supplied raccoon/orange/charcoal brand is represented by repo-native SVG assets, a generated PNG icon, and editor-theme-aware styling. The reference image in Downloads was not changed.

## Layout and contracts

- `src/core/store.ts`: owned private root, UUID identities, private atomic writes, symlink/traversal checks, exclusive registry mutation and non-destructive removal.
- `src/core/service.ts`: per-account/per-editor paths, initial settings, safety verification, scoped installation/launch, official auth metadata allowlist, Git metadata and handoff packages.
- `src/core/process.ts`: argv-based child processes, bounded command output, generic diagnostic errors and child-only environment allowlisting.
- `src/protocol.ts`: zod-validated webview requests, account/setup/auth/handoff models and snapshots.
- `src/extension/extension.ts`: trust checks, setup confirmations, current-window identity validation, official commands, clipboard actions and React webview hosting with a restrictive CSP.
- `src/webview`: Accounts and Handoffs screens, detected Cursor/VS Code context, setup state, account rename/removal, official chat/usage actions, theme support and reduced motion.
- `src/cli.ts`: `accounts list/add/rename/remove`, `setup`, `open`, `status`, `handoff create/list/open`. Run `node dist/clawcoon.mjs --help` for syntax.

The host sends only normalized models to the webview. The webview sends validated intents; it cannot supply executable paths, arbitrary configuration paths or shell commands. Mutation and process actions require a trusted local workspace. Model prompts are never automatically submitted.

## Disk layout

```text
~/.mascot/
  .clawcoon-owned.json
  accounts.json
  accounts/<uuid>/
    claude-prepared.json
    claude/settings.json
    editors/<cursor|vscode>/
      prepared.json
      extensions/
  e/<base64url-uuid>/<c|v>/u/User/settings.json
  handoffs/<uuid>.json
```

The root is claimed only when absent or empty. Existing foreign files are not adopted. The marker, managed files, and all directories inside the root are checked for symbolic links. An ancestor alias that resolves into protected application locations is rejected before creation. Registry writes use a lock directory and atomic rename; a concurrent update fails with a retry message rather than overwriting another account. An interrupted registry action can leave `.accounts-lock`; manually inspect it only after closing Mascot processes. There is no automatic stale-lock deletion.

Files created by Mascot use mode 0600 and owned directories mode 0700. There is no account data cleanup API. Removing an account preserves its files, credentials and official sessions, and performs no logout. Handoffs preserve references as paths instead of copying source file contents.

## Editor and account isolation

Every launch and installation names both `--user-data-dir` and `--extensions-dir`. The default editor paths are the standard Cursor and VS Code launchers under `/Applications`. `HOME` is preserved, never redirected; account separation uses the documented `CLAUDE_CONFIG_DIR` mechanism, not a fake system home.

Fresh editor settings set the absolute Claude directory, clear inherited API/provider credential overrides for the official Claude child, select graphical chat, disable interrupted-turn continuation and disable editor/extension automatic updates. The account’s Claude settings disable automatic IDE extension installation. Existing normal editor settings are never rewritten. Managed settings are verified before launch; modified safety values block execution instead of being silently repaired.

Fresh environments contain no copies of existing editor settings, Claude memory, plugins or account credentials. Official login stays inside official Claude. [Anthropic’s credential management documentation](https://code.claude.com/docs/en/authentication#credential-management) states that a custom config directory also selects its own macOS Keychain entry. Mascot itself never reads or modifies Keychain entries or `.credentials.json`.

The companion only opens official chat when its global storage path matches the selected managed editor environment and that account’s settings verify. It refuses to target the normal editor’s Claude panel. The public command ID currently used is `claude-vscode.editor.open`, checked for availability at runtime. A missing command produces a manual Command Palette instruction, not a private API fallback.

User-installed corporate policy, Claude Code’s own tools, and edits to shared project files are outside this directory isolation boundary. These are not OS sandboxes. The app warns before continuing the same project in another window and cannot inspect or stop the official extension’s live tools.

## Installation packaging

All runtime dependencies are bundled. The full release VSIX contains a smaller bootstrap VSIX with the companion code. Setup installs official `anthropic.claude-code` and this companion only into the target account’s extension directory. After successful installation, it places a copy of the bootstrap archive in the newly installed companion’s owned folder, so that account window can prepare another account without recursively nesting archives.

Initial automated validation performed no publish action, Marketplace upload, GitHub push, install into the original editor, or real-account sign-in. The later user-requested local Mascot installation is recorded below.

## Validation performed

- `pnpm check`: TypeScript checks, 19 isolation/integration tests, and extension/CLI/webview/icon builds passed.
- `pnpm test:cli`: exercised the built CLI’s account CRUD and handoff creation/listing in a temporary root; no setup, login or model call.
- `pnpm package`: produced the bootstrap and full VSIX archives with only bundled runtime files, assets, README and license.
- `pnpm test:extension --packaged`: installed the full VSIX into temporary editor/extension directories and loaded its actual packaged code in a VS Code Extension Development Host. Activation, command registration, account registry operations and the actual React webview’s startup handshake passed. Official Claude was deliberately absent; no login or model call was possible through it.
- The generated icon was visually inspected. Full light/dark/high-contrast panel visual review remains a manual check.

Tests cover empty-root reads, foreign-root refusal, symlinked roots/files/ancestors, private permissions, registry contention, metadata-only removal, account/editor separation, literal shell characters in project paths, missing installer handling, launch refusal after settings changes, safe diagnostic messages, isolated auth directory validation, bootstrapping subsequent accounts, environment filtering and handoff metadata without transcript-content copying.

The installed official extension’s manifest was inspected read-only at version 2.1.310 to confirm the environment setting and registered open command. The standalone CLI version observed during research was 2.1.283. Native execution is supported only for macOS Apple Silicon in this preview; the smoke test used the locally installed VS Code app. Real multi-account login/refresh/logout behavior, account subscriptions and Cursor’s end-to-end installer path have not been exercised.

## Remaining manual acceptance

Use `manual-validation.md`. In particular, confirm both fresh profiles are signed out before first login, then verify the account identity and usage inside official Claude. Never interpret a ready installation as a verified sign-in or assume the original Claude app is isolated without checking its unchanged state. There is no promise of zero account enforcement risk.

## Mascot branding update (0.1.1)

The display name, Activity Bar/view names, command labels, panel header/footer, window title, CLI help and diagnostics now say Mascot. The existing raccoon SVGs and PNG icon are unchanged. The public package is `artifacts/mascot-0.1.1.vsix`; packaging derives its version from the manifest. The CLI also exposes `mascot` while keeping the previous alias.

The internal extension identity `clawcoon.clawcoon`, command IDs, config directory, ownership marker and environment keys are retained for account compatibility. No migration, login, installation into an existing editor or account change is needed for this branding update. The release version is incremented so editors can upgrade an installed preview.

## Sidebar layout correction (0.1.2)

Reset the editor webview’s default body padding and reduced the app gutters to 10px (8px below 260px, 14px above 560px). Removed the centered 760px content cap. Card padding is reduced; heading actions stack below 420px, account badges simplify below 320px, and status fields stack below 260px. Flexible columns, long account names, paths and action labels wrap without forcing the panel wider. No account, installer or authentication behavior changed.

Validation: the bundled React view was rendered with synthetic account/handoff data in an isolated headless Chromium profile at widths 220, 240, 280, 320, 360, 420, 560 and 900px. Accounts (including long names), Handoffs and the empty state had no horizontal overflow in all 24 combinations; computed body padding was zero. The 240px and 320px account screenshots were visually inspected. Captures are local build artifacts under `artifacts/layout/`. TypeScript, build and the packaged-extension smoke check passed.

## Automatic editor detection (0.1.3)

The extension now derives its editor exclusively from `vscode.env.appName` and displays a read-only Running in label. The Open with selector, editor-change webview request and stored-selection lookup were removed. Setup, metadata checks and launches use the detected host; old saved selections cannot redirect operations to another editor. Unknown editor distributions are rejected rather than treated as VS Code. The standalone CLI keeps its explicit `--editor` option because it has no editor host context. Existing internal IDs and account paths are unchanged.

Validation for 0.1.3: TypeScript, all 22 tests and the packaged-extension smoke test passed. Three new checks cover host identity, refusal of unsupported editor distributions, and rejection of editor-change messages. During this build pnpm enforced its release-age policy; the lockfile was regenerated under that policy (including Rollup 4.66.0 instead of the rejected 4.67.2). Project-local build approvals allow esbuild/sharp and deny unused keytar/signing install scripts; no global policy was relaxed.

## Simplified interface (0.1.4)

Replaced the large headings, preview badge, repeated isolation copy, duplicate account card and official-chat explanation card with a compact header, Accounts/Handoffs tabs, simple account rows and one primary action. The detected editor is shown below the brand. The current account offers Open Claude and a secondary usage link; other accounts offer setup or Open account. Sign-in checks, rename/removal, folder paths and detailed setup state remain accessible under the collapsed Account details section. Handoffs now show saved items first; the form opens only on New, with goal/next-step fields collapsed. Native setup confirmations and all isolation/permission logic remain unchanged.

Validation for 0.1.4: TypeScript, all 22 tests, build/package, and the packaged-extension smoke test passed. Visual layout checks used synthetic account data at eight widths from 220 to 900px, covering account rows, expanded details, saved handoffs, the handoff form and the empty state (40 combinations, no horizontal overflow). Narrow account/empty/form screenshots and the three-account 320px preview were inspected. The preview is `artifacts/layout/mascot-compact-320.png`; it contains example data only.

## Official publisher recognition fix (0.1.5)

The real official Claude Code manifest declares publisher `Anthropic`, while its extension ID and directory use lowercase `anthropic.claude-code`. The original exact-case manifest comparison incorrectly reported a missing official extension after a successful installation. Extension ID matching now normalizes case for directory candidates and manifest identity, retaining the exact ID check. Test fixtures now use the real publisher casing; a regression check confirms detection does not invoke an installer or auth probe. This corrects installation recognition without altering any account credential, sign-in or Claude configuration.

## macOS editor IPC path correction (0.1.6)

A real Cursor launch exposed `listen EINVAL` because the original account/editor user-data path exceeded the macOS Unix socket pathname limit. Editor user data now uses `~/.mascot/e/<lossless-base64url-UUID>/<c|v>/u`, with a pathname budget checked before preparation and launch. Claude config directories and their Keychain namespaces, extension directories, ownership IDs and environment keys are unchanged. Setup recognizes legacy prepared markers as needing the short editor layout, creates fresh isolated editor settings at the new path, and retains the old editor data intact without copying credentials. The compact UI offers setup for a legacy layout even if its extensions are already installed. Existing official extensions are left alone when retrying setup; only the Mascot companion is installed/updated.

## User-requested Cursor repair and deployment

The user explicitly requested installation into their existing Cursor. Only the Mascot extension was updated there to 0.1.6 using explicit Cursor user-data and extension paths; the normal official Claude extension stayed at 2.1.310. The selected isolated account was prepared with the short editor path and updated companion, keeping its already installed official Claude 2.1.316 unchanged. The scoped Cursor process started and its real Unix IPC socket existed at a 72-byte path. The original long editor data was retained, and the Claude config/credential namespace did not move. Native Cursor inspection visibly confirmed the new compact panel, Running in Cursor, and the prepared account as Ready to open, with no missing-extension error. No sign-in, token access, logout, model request or Claude Desktop change was performed.

Validation: TypeScript, all 26 tests, build/package and the packaged-extension smoke check passed. Regression coverage includes actual publisher casing, idempotent setup without reinstalling official Claude, short unique editor paths and non-destructive legacy-layout preparation.
