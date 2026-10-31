# Preview acceptance checklist

## Automated checks

Run pnpm check, pnpm test:cli, pnpm package and pnpm test:extension --packaged. All use temporary data/fake identities. The extension test uses an offline fake Claude extension and real native settings; no real login, model call or normal app installation occurs.

## Official account workflow (manual)

1. Note the existing Claude Desktop identity. Install Mascot 0.2.0 and ensure official Claude Code is already installed. Use a trusted harmless local project.
2. Add a label, select Use account and read the switch confirmation. Stop/close old Claude chats and background tools before confirming.
3. Verify the same window reloads, a fresh official Claude chat opens, and no editor login or separate editor environment appears. Check the absolute selected profile under Account details.
4. Verify a fresh profile's identity before logging in. If an unexpected existing identity appears, stop and investigate without logging out or replacing credentials.
5. Sign in through official Claude using the intended subscription. Confirm identity in official Claude and request Check sign-in in Mascot. A selected label alone must not say verified signed in.
6. Repeat for a second profile. Switch back and confirm the first identity is preserved. No prompt or interrupted step may resume automatically.
7. Use Check usage and manually submit the copied /usage in official Claude. A limit must never trigger account rotation or a retry.
8. Use previous Claude profile and verify the original pointer returns. Other env entries must remain; continueAfterReload intentionally remains false.
9. Verify Claude Desktop and default Claude config files remain unchanged. Remember global Claude settings can affect other windows sharing that settings profile.

## Terminal and handoff

Open terminal for each label: official Claude must run directly in the selected config, without opening an editor or changing current shell settings. Existing terminals remain as they were. Verify each identity inside Claude. Stop writers before changing accounts on a shared worktree.

Create and review a local handoff, choose another account and manually submit its copied reference. Nothing should be sent automatically. Handoffs are summaries/file references, not session migration.

## Failure and interface

Missing official Claude should show an install instruction, never install automatically. Managed settings or credential/provider overrides should prevent switching. Untrusted/remote contexts should block mutations. Removing an inactive label should retain all files/sign-ins; removing the current chat profile is blocked. Refresh must perform no auth probe, launch or download.

Check Accounts, expanded details, Handoffs and forms at narrow widths and light/dark/high-contrast themes, keyboard focus and reduced motion. Live reload recovery and real account authentication are manual acceptance items, not covered by the offline fixture.
