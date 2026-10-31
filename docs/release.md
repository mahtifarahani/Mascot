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

## Registry configuration

On 2026-10-31 Chrome showed Mascot.mascot 0.2.1 as Public. Namespace Mascot is unverified; the current account cannot register an Open VSX trusted publisher for it, because trusted publishing requires namespace ownership. CatHouse already has an OIDC registration, although its checked-in release workflow still uses OVSX_PAT. Mascot therefore uses the same token-based workflow currently present in CatHouse. A dedicated Open VSX token must be stored in GitHub Actions as OVSX_PAT before stable publishing can succeed. Namespace ownership verification and Marketplace publication are separate tasks.
