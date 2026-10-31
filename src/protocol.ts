import { z } from 'zod';

export const AccountId = z.string().uuid();
export const Editor = z.enum(['cursor', 'vscode']);
export type Editor = z.infer<typeof Editor>;
export const Account = z.object({ id: AccountId, name: z.string().trim().min(1).max(60), createdAt: z.string().datetime() });
export type Account = z.infer<typeof Account>;
export const HandoffDraft = z.object({
  title: z.string().trim().min(1).max(120), goal: z.string().max(10000),
  summary: z.string().max(30000), next: z.string().max(10000),
});
export type HandoffDraft = z.infer<typeof HandoffDraft>;
export type Handoff = HandoffDraft & { id: string; createdAt: string; accountId: string; workspace: string; branch: string; commit: string; changes: string[]; references: string[] };
export type AuthStatus = { state: 'unknown' | 'signed-out' | 'signed-in' | 'unavailable'; email?: string; method?: string; checkedAt?: string; message?: string };
export type SetupStatus = { editor: Editor; available: boolean; prepared: boolean; officialInstalled: boolean; companionInstalled: boolean; configDir: string; dataDir: string; extensionsDir: string };
export type AccountView = Account & { profileReady: boolean; configDir: string; auth: AuthStatus; current: boolean };
export type Snapshot = { accounts: AccountView[]; handoffs: Handoff[]; root: string; workspace?: string; trusted: boolean; officialAvailable: boolean; canRestore: boolean; busy?: string; notice?: string; error?: string };

export const Request = z.discriminatedUnion('type', [
  z.object({ type: z.literal('refresh') }),
  z.object({ type: z.literal('add'), name: Account.shape.name }),
  z.object({ type: z.literal('rename'), id: AccountId, name: Account.shape.name }),
  z.object({ type: z.literal('remove'), id: AccountId }),
  z.object({ type: z.literal('switch'), id: AccountId }),
  z.object({ type: z.literal('restore') }),
  z.object({ type: z.literal('terminal'), id: AccountId }),
  z.object({ type: z.literal('auth'), id: AccountId }),
  z.object({ type: z.literal('claude') }),
  z.object({ type: z.literal('usage') }),
  z.object({ type: z.literal('handoff'), id: AccountId, draft: HandoffDraft }),
  z.object({ type: z.literal('open-handoff'), id: AccountId }),
]);
export type Request = z.infer<typeof Request>;
