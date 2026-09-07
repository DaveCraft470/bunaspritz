import { useSyncExternalStore } from 'react';

// Frontend-only, in-memory block list — mirrors lib/reports.ts's pattern
// (module-level array + useSyncExternalStore) so both "safety" features
// share the same shape and are trivial to swap for a real Supabase table
// later. Nothing here is persisted; it resets on reload.
export type BlockedUser = {
  id: string;
  blockerId: string;
  blockedId: string;
  blockedLabel: string;
  createdAt: string;
};

let blocks: BlockedUser[] = [];
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

// Subscribe to the raw block list — components read it purely to force a
// re-render when it changes; use isBlocked/getBlockedIds for actual lookups.
export function useBlocks() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => blocks,
    () => blocks,
  );
}

export function isBlocked(blockerId: string, blockedId: string): boolean {
  return blocks.some((block) => block.blockerId === blockerId && block.blockedId === blockedId);
}

// True if either side has blocked the other — for UI that should hide an
// interaction regardless of who initiated the block.
export function isBlockedEitherWay(userIdA: string, userIdB: string): boolean {
  return isBlocked(userIdA, userIdB) || isBlocked(userIdB, userIdA);
}

export function getBlockedIds(blockerId: string): Set<string> {
  return new Set(blocks.filter((block) => block.blockerId === blockerId).map((block) => block.blockedId));
}

export function blockUser(blockerId: string, blockedId: string, blockedLabel: string): boolean {
  if (blockerId === blockedId || isBlocked(blockerId, blockedId)) return false;
  blocks = [
    {
      id: `local-block-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      blockerId,
      blockedId,
      blockedLabel,
      createdAt: new Date().toISOString(),
    },
    ...blocks,
  ];
  notify();
  return true;
}

export function unblockUser(blockerId: string, blockedId: string) {
  blocks = blocks.filter((block) => !(block.blockerId === blockerId && block.blockedId === blockedId));
  notify();
}
