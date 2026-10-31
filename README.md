# Mascot

A local Claude account switcher. Choose an account for **official Claude Code in the same window**, or run official Claude directly in a terminal. No separate editor environment or editor login is required.

Mascot is an independent companion. It has no replacement chat, model API client, subscription proxy, token importer or automatic quota rotation.

## Download and install

- [Open VSX](https://open-vsx.org/extension/Mascot/mascot) — install `Mascot.mascot` from a compatible editor's extension registry.
- [GitHub Releases](https://github.com/mahtifarahani/Mascot/releases/latest) — release notes, VSIX packages and checksums.
- [Download VSIX v0.2.2](https://github.com/mahtifarahani/Mascot/releases/download/v0.2.2/mascot-0.2.2.vsix) — direct download for manual installation.

For manual installation, open the editor's Command Palette, run **Extensions: Install from VSIX…** and select the downloaded file. Install the official Claude Code extension separately. This preview is validated on macOS Apple Silicon.

## Use

After installation, open Mascot and add account labels. Local builds produce `artifacts/mascot-0.2.2.vsix`.

1. Select a label and click **Use account**.
2. Stop and close existing Claude chats and background tools. Confirm **Switch and reload**.
3. The same window reloads and opens official Claude. Complete its official subscription login once for this profile.
4. Verify the actual identity in official Claude. A label or selected profile is not proof of sign-in. **Check sign-in** requests metadata explicitly; **Check usage** copies `/usage` for you to submit in Claude.
5. Select another label to switch again. **Use previous Claude profile** restores the original profile pointer.

**Open terminal** runs official Claude directly with the chosen profile. It does not change existing terminals, shell startup files or the selected chat profile. The standalone CLI also works without opening an editor.

## What changes

Each account has a stable Claude configuration directory under `~/.mascot/accounts/<uuid>/claude`. Mascot sets its absolute path in the official extension's `claudeCode.environmentVariables`. It preserves other entries and sets `claudeCode.continueAfterReload` to false to avoid replaying an interrupted step with another identity. These are user settings: other windows sharing them can be affected. Stop old sessions first; running tools cannot be hot-swapped.

The previous config-directory pointer is saved privately, without copying environment secrets or credentials. Restoring keeps automatic continuation disabled. Mascot does not read or modify Claude Desktop, the existing `~/.claude` or `~/.claude.json`, Keychain items or account tokens. Official Claude owns login and credential storage. Old Mascot editor environments are retained but no longer opened or installed by the current UI/CLI.

This uses the documented [official extension environment setting](https://code.claude.com/docs/en/vs-code#extension-settings) and [directory-specific credential storage](https://code.claude.com/docs/en/authentication#credential-management). Real-account behavior must still be checked manually on the installed Claude version; Mascot does not guarantee immunity from account enforcement. Configured provider policies are not bypassed.

## CLI

Node.js 22+, macOS Apple Silicon for this preview:

```sh
node dist/mascot.mjs accounts add "Personal"
node dist/mascot.mjs accounts list
node dist/mascot.mjs prepare ACCOUNT_UUID
node dist/mascot.mjs run ACCOUNT_UUID /absolute/project
node dist/mascot.mjs status ACCOUNT_UUID
```

`--claude /absolute/executable` selects an installed official binary. Otherwise Mascot looks for an installed Claude executable. Nothing is downloaded. `--data-dir /absolute/empty/directory` chooses a private root. Removing an account deletes only its registry entry, with no logout or file cleanup.

## Handoffs

Save a task summary with optional file references, branch, commit and changed file names. Review it before sharing across personal and organizational accounts. Open it with the chosen profile and manually paste the reference into official Claude. No transcript, live tools, permissions or hidden context is migrated; no prompt is automatically submitted. Profiles share project files: stop other writers or use separate worktrees.

## Development

```sh
pnpm install
pnpm check
pnpm test:cli
pnpm package
pnpm test:extension --packaged
```

Tests use temporary roots and fake data. The packaged extension test runs the real UI and settings API in temporary editor directories with an offline fake Claude extension. It tests switch/restore and same-window command routing, without real login or model requests. No automated test installs into normal apps.

See [implementation](docs/implementation.md) and [manual validation](docs/manual-validation.md). The product uses the supplied orange raccoon identity, named Mascot; all current product identifiers use Mascot.

## Registry identity

Releases use version tags: GitHub Actions builds the VSIX and publishes stable versions to Open VSX once the publishing secret is configured. Ordinary code pushes do not release an update. See [publishing](docs/release.md).

The Open VSX publisher namespace is `Mascot`; the extension ID is `Mascot.mascot`. Disable earlier preview extensions before installing this build to avoid duplicate account managers. Existing account config paths remain unchanged; no sign-ins are copied or migrated.
