# Publishing Mascot

The GitHub remote is https://github.com/mahtifarahani/Mascot. `.github/workflows/release.yml` builds a universal VSIX on macOS, validates the tag against `package.json` and the dated changelog, runs `pnpm check` and `pnpm test:cli`, packages the extension and uploads the VSIX plus `SHA256SUMS` to GitHub Releases. Runtime support is still the macOS Apple Silicon preview; universal packaging is not proof of other-platform validation.

Stable tags also publish to Open VSX as `Mascot.mascot` using the repository secret `OVSX_PAT`. Prerelease tags containing `-` stay on GitHub. VS Code Marketplace publication is manual, matching CatHouse's distribution model; this workflow does not publish there. Open VSX installs in Cursor can receive normal registry updates subject to the editor's update settings.

## Cut a release

1. Increase `package.json` version and add a nonempty dated `## [X.Y.Z] - YYYY-MM-DD` section in `docs/CHANGELOG.md`. Update the documented artifact paths for the new version.
2. Run `pnpm check`, `pnpm test:cli`, `pnpm package`, and `pnpm test:extension --packaged` locally. The editor smoke test uses temporary editor directories and fake Claude, never normal installations or accounts.
3. Run `node scripts/release-notes.mjs vX.Y.Z`.
4. Commit, push `main`, then create and push a new tag: `git tag vX.Y.Z` followed by `git push origin vX.Y.Z`.
5. Verify the GitHub Actions run, GitHub Release assets and the public Open VSX version.

A normal branch push does not release an extension. Never move an existing tag or reuse a published version. The existing 0.2.1 registry upload predates this workflow and the later local panel changes; the next published build needs a new version.

The Release workflow's manual dispatch accepts an existing tag for retry. It retains existing GitHub Release assets and skips already-published registry versions. No tokens are printed or committed. Installer, login, account switching and real model calls are not part of release CI.

The Open VSX CLI is pinned to 1.2.0 and launched with `npm exec --yes --ignore-scripts --package=ovsx@1.2.0 -- ovsx`. It uploads an already-built VSIX using the environment token; native signing/keychain dependency build scripts are unnecessary and disabled. `pnpm dlx` under pnpm 12 rejected those ignored transitive builds in the initial 0.2.2 run, after GitHub Release creation had succeeded. Retry via manual dispatch from the updated main workflow without moving the existing version tag.

## Registry configuration

On 2026-10-31 Chrome showed Mascot.mascot 0.2.1 as Public. Namespace Mascot is unverified; the current account cannot register an Open VSX trusted publisher for it, because trusted publishing requires namespace ownership. CatHouse already has an OIDC registration, although its checked-in release workflow still uses OVSX_PAT. Mascot therefore uses the same token-based workflow currently present in CatHouse. The user-supplied publishing token was stored through Chrome in GitHub Actions as OVSX_PAT; GitHub confirmed the secret was added. Namespace ownership verification and Marketplace publication are separate tasks.

## Verified release

Release v0.2.2 was created by GitHub Actions and the corrected manual-dispatch run [41193801211](https://github.com/mahtifarahani/Mascot/actions/runs/41193801211) completed with Success, including Open VSX publishing. The [GitHub Release](https://github.com/mahtifarahani/Mascot/releases/tag/v0.2.2) provides mascot-0.2.2.vsix and SHA256SUMS. Local validation passed TypeScript, 37 regression tests, CLI smoke and the packaged offline extension smoke. No real account login, account switch or normal editor installation was performed for publication.

Open VSX owner settings verified Mascot.mascot latest version 0.2.2 with Status Public, listing both 0.2.2 and the retained 0.2.1. The uploader log confirms Published Mascot.mascot v0.2.2. Namespace verification remains separate from this successful publication.
