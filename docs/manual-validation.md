# Preview acceptance checklist

Do this only when you intend to create and sign in to new, isolated Claude Code environments. Automated tests do not perform these actions.

## Build evidence

```sh
pnpm check
pnpm test:cli
pnpm package
pnpm test:extension --packaged
```

The final command installs only Mascot in temporary directories; it never installs official Claude, uses existing editor directories or signs in. Temporary test directories are removed after execution.

## First-account setup

1. Note the visible account in your existing Claude Desktop and editor. Do not sign out, export credentials or change its settings.
2. Install `artifacts/mascot-0.1.6.vsix` through the intended editor’s Install from VSIX action. Open Mascot and add a label such as Personal.
3. Verify the detected editor shown in Running in and inspect the isolated paths. They must all belong to this account under `~/.mascot`.
4. Click Set up account and approve installation there. Before opening chat, open Account details and request Check sign-in. A fresh environment should be signed out or explicitly unverified. If it unexpectedly shows your existing account before login, stop and investigate; do not log out or attempt to replace it.
5. Open the account window with a harmless test project. Complete login using the official Claude UI. Choose the correct browser account without logging out of your existing Claude apps.
6. Check the account identity in official Claude and in Mascot’s requested sign-in metadata. Use Check usage, paste `/usage` and submit yourself. No extra API key should be needed.
7. Check your original Claude Desktop and editor again. Their accounts and configuration should remain unchanged.

## Second account and handoff

1. Add a second label and prepare/open its separate environment. Confirm it starts independently, before signing in. The first account’s identity should remain unchanged.
2. Use separate harmless test folders to test concurrent windows. Do not run two writers against the same worktree.
3. Create a handoff with a title, goal, progress and next step. Optionally choose an existing official export as a reference. Review the saved file for private or organizational information.
4. Stop the first account’s tools before choosing Open on the handoff and selecting the second account. The new editor should show the handoff file; nothing should be submitted to Claude automatically.
5. Paste the copied reference prompt into official Claude manually. Verify that branch, commit, changed file names and the next step match the current project.
6. Close and reopen the editor environment. It should preserve its own sign-in without automatically continuing an interrupted turn.

## Failure and visual checks

- Missing editor or extension: show an actionable setup message and never open the normal editor’s Claude session as a fallback.
- Untrusted/remote workspace: account data may be viewed; mutation and process actions remain blocked.
- Changed isolation settings: launch must fail without repairing or overwriting the changed file.
- Limit or auth error: the app must not switch accounts, retry using another identity or enable paid overage.
- Remove from list: no files or credentials should be deleted and no logout should occur. Close the removed account’s windows first.
- Review the Accounts empty state, multiple accounts, setup errors and Handoffs at narrow sidebar widths and in Light, Dark and High Contrast editor themes. Check keyboard focus and reduced motion.

This is a companion for the official extension, not a guarantee against account suspension and not a sandbox for Claude’s actions in your selected project.
