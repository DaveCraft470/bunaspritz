import { supabase } from '@/lib/supabase';

// Follow Organizer — reuses the `follows` table from the init migration,
// which existed in the schema but was never actually wired up on the
// client (the mutual-friend graph moved to friend_requests/friendships
// instead). One-directional, unlike friendship: following an organizer
// doesn't require them to follow back.
export async function isFollowing(followerId: string, followeeId: string): Promise<boolean> {
  const { data } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('follower_id', followerId)
    .eq('followee_id', followeeId)
    .maybeSingle();
  return !!data;
}

export async function followUser(followerId: string, followeeId: string): Promise<boolean> {
  const { error } = await supabase.from('follows').insert({ follower_id: followerId, followee_id: followeeId });
  if (error && error.code !== '23505') return false;

  // notify-follow re-checks the edge exists server-side before pushing —
  // best-effort, same idiom as every other notify-* invoke in this app.
  supabase.functions.invoke('notify-follow', { body: { followeeId } }).catch(() => {});
  return true;
}

export async function unfollowUser(followerId: string, followeeId: string): Promise<boolean> {
  const { error } = await supabase.from('follows').delete().eq('follower_id', followerId).eq('followee_id', followeeId);
  return !error;
}

export async function getFollowerCount(userId: string): Promise<number> {
  const { count, error } = await supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('followee_id', userId);
  if (error) return 0;
  return count ?? 0;
}
