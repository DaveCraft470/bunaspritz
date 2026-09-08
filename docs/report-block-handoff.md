# Report / Block / Safety — backend handoff

> **2026-09-08 update:** Both gaps this doc originally called out are now
> closed. Blocking moved to a real backend earlier (see `lib/social.ts`'s
> `blockUser`/`unblockUser`, not `lib/blocks.ts` — that file is dead).
> Reporting moved to a real backend this session: `public.reports` table +
> RLS (`supabase/migrations/20260908170000_add_reports_and_suspension.sql`),
> `lib/reports.ts` rewritten to hit Supabase instead of an in-memory array.
> The rest of this doc is a historical record of the original frontend-only
> build, kept for context — don't treat its "not persisted yet" framing as
> current.

Frontend-only implementation. Everything described here lives in memory
(`lib/reports.ts`, `lib/blocks.ts`) and resets on reload — nothing is
persisted to Supabase yet.

## Frontend components created/updated

- `lib/blocks.ts` — new local block store (mirrors `lib/reports.ts`'s
  `useSyncExternalStore` pattern). Exposes `blockUser`, `unblockUser`,
  `isBlocked`, `isBlockedEitherWay`, `getBlockedIds`, `useBlocks`.
- `lib/reports.ts` — unchanged data model, now the single place reports are
  created (see below); already had `USER_REPORT_REASONS` / `EVENT_REPORT_REASONS`.
- `components/social/ReportModal.tsx` — rewritten to own the whole report
  flow: reason picker, free-text reason for "Alt motiv", duplicate check
  (`hasActiveReport`), loading state, success state, and calls `addReport`
  itself. Callers just pass target/reporter info.
- `components/social/SafetyMenu.tsx` — new reusable "⋯" bottom sheet
  (Blochează/Deblochează, Raportează, Anulează, plus any extra actions a
  screen wants) used instead of one-off menus per screen.
- `app/user/[id].tsx` — "Opțiuni de siguranță" button opens `SafetyMenu`
  with block toggle + report; social action row (friend request, message)
  and review submission are hidden while the profile is blocked, replaced
  by a blocked-state banner. Own profile never renders these actions.
- `app/friends.tsx` — per-row "…" now opens `SafetyMenu` (notification
  prefs, block/unblock, report, remove friend); blocked users are filtered
  out of the rendered friend list.
- `app/search.tsx` — blocked users are filtered out of search results.
- `app/messages.tsx` — blocked friends are filtered out of the "PRIETENI"
  thread list; if a conversation with a blocked friend is already open, the
  composer is replaced with a "blocked" notice instead of deleting any
  messages.
- `app/event/[id].tsx` — "Raportează evenimentul" already existed; now uses
  the same centralized `ReportModal`.

## Data model — Report (already exists, unchanged)

```ts
type Report = {
  id: string;
  reporterId: string;
  reporterLabel: string;
  targetType: 'user' | 'event';
  targetId: string;
  targetLabel: string;
  reason: string;        // one of USER_REPORT_REASONS / EVENT_REPORT_REASONS
  description: string;   // only populated for the free-text "Alt motiv" reason
  createdAt: string;
  status: 'new' | 'reviewing' | 'resolved' | 'dismissed';
};
```

## Data model — Block (new, frontend-only)

```ts
type BlockedUser = {
  id: string;
  blockerId: string;   // who initiated the block
  blockedId: string;   // who got blocked
  blockedLabel: string; // display label, e.g. "@username"
  createdAt: string;
};
```

## What needs to be connected to Supabase

- **`reports` table**: columns matching the `Report` type above
  (`reporter_id`, `target_type`, `target_id`, `reason`, `description`,
  `status`, `created_at`). Replace `addReport`/`hasActiveReport` in
  `lib/reports.ts` with real inserts/selects; `admin-reports.tsx` already
  reads from the same local store and can be pointed at the table with
  minimal changes.
- **`blocks` table**: `blocker_id`, `blocked_id`, `created_at`, unique on
  `(blocker_id, blocked_id)`. Replace `blockUser`/`unblockUser`/`isBlocked`/
  `getBlockedIds` in `lib/blocks.ts` with real inserts/deletes/selects.
- Friend requests, follows, and direct messages should all check the block
  table server-side (see RLS below) so a blocked pair can't interact even
  by hitting the API directly, not just via hidden UI.

## What needs RLS protection

- `reports`: insert-only for the reporter (`reporter_id = auth.uid()`);
  select/update restricted to admin/moderator roles only (matches the
  existing `admin-reports.tsx`/`admin-users.tsx` admin-only pattern).
- `blocks`: insert/delete only where `blocker_id = auth.uid()`; a user
  should never be able to see or remove another user's block rows.
- `friend_requests`, `follows`, `messages`: policies (or a trigger) should
  reject rows between two users where a `blocks` row exists in either
  direction, so blocking can't be bypassed by calling Supabase directly.

## What needs to be done server-side

- RPC or trigger to auto-reject/cancel any pending friend request when a
  block is created between the two users.
- Optional: a moderation queue/notification when a report is created
  (e.g. Slack/email webhook via an Edge Function), separate from the
  admin dashboard's own polling.
- Rate limiting / abuse prevention on report and block creation.
