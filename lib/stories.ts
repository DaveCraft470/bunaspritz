import { File } from 'expo-file-system';

import { supabase } from '@/lib/supabase';

export type StoryMediaType = 'image' | 'video';
export type StoryVisibility = 'public' | 'friends';

export type StoryLocation = {
  latitude: number;
  longitude: number;
  label?: string;
};

export type Story = {
  id: string;
  userId: string;
  mediaUri: string;
  type: StoryMediaType;
  text?: string;
  visibility: StoryVisibility;
  eventId?: string;
  location?: StoryLocation;
  createdAt: string;
  expiresAt: string;
  viewers: string[];
  authorName?: string;
  authorAvatarUri?: string | null;
};

const BUCKET = 'stories';
const SIGNED_URL_TTL_SECONDS = 60 * 60;

const listeners = new Set<() => void>();
let cache: Story[] = [];
let currentUserId: string | null = null;
let channel: ReturnType<typeof supabase.channel> | null = null;

function notify() {
  listeners.forEach((listener) => listener());
}

async function fromRow(row: any): Promise<Story> {
  const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(row.media_path, SIGNED_URL_TTL_SECONDS);
  return {
    id: row.id,
    userId: row.user_id,
    mediaUri: signed?.signedUrl ?? '',
    type: row.media_type,
    text: row.caption || undefined,
    visibility: row.visibility,
    eventId: row.event_id ?? undefined,
    location: row.lat != null && row.lng != null ? { latitude: row.lat, longitude: row.lng } : undefined,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    viewers: row.viewed_by_me && currentUserId ? [currentUserId] : [],
    authorName: row.user_name,
    authorAvatarUri: row.user_avatar_url,
  };
}

async function refresh() {
  if (!currentUserId) {
    cache = [];
    notify();
    return;
  }
  const { data, error } = await supabase.rpc('home_feed_stories');
  if (error || !data) return;
  cache = await Promise.all(data.map(fromRow));
  notify();
}

export function subscribeToStories(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// StoriesProvider calls this whenever the signed-in user changes — the
// getters below read a synchronous cache (matching the mock this replaces)
// that this keeps populated via an initial fetch + realtime subscription.
export function initStories(userId: string | null) {
  if (currentUserId === userId) return;
  currentUserId = userId;

  if (channel) {
    supabase.removeChannel(channel);
    channel = null;
  }
  if (!userId) {
    cache = [];
    notify();
    return;
  }

  refresh();
  channel = supabase
    .channel('stories-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'stories' }, () => refresh())
    .subscribe();
}

export function isStoryExpired(story: Story, now = Date.now()) {
  return new Date(story.expiresAt).getTime() <= now;
}

// Expiry is already enforced server-side (home_feed_stories() only returns
// non-expired rows), so this is just a read of the cache, not a filter.
export function getActiveStories(): Story[] {
  return [...cache].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getStoriesForUser(userId: string) {
  return getActiveStories().filter((story) => story.userId === userId);
}

export function getStoriesForFriends(userId: string, friendIds: string[]) {
  const allowed = new Set([userId, ...friendIds]);
  return getActiveStories().filter((story) => allowed.has(story.userId));
}

export function getStoriesForEvent(eventId: string) {
  return getActiveStories().filter((story) => story.eventId === eventId);
}

export function getStoriesForMap() {
  return getActiveStories().filter((story) => !!story.location || !!story.eventId);
}

export async function createStory(input: {
  userId: string;
  mediaUri: string;
  type?: StoryMediaType;
  text?: string;
  visibility: StoryVisibility;
  eventId?: string;
  location?: StoryLocation;
  authorName?: string;
  authorAvatarUri?: string | null;
}): Promise<Story | null> {
  if (!input.userId || !input.mediaUri.trim()) return null;

  const type = input.type ?? 'image';
  const extension = type === 'video' ? 'mp4' : 'jpg';
  const contentType = type === 'video' ? 'video/mp4' : 'image/jpeg';
  const path = `${input.userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;

  const file = new File(input.mediaUri);
  const bytes = await file.arrayBuffer();
  if (bytes.byteLength === 0) return null;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType });
  if (uploadError) return null;

  const { data, error } = await supabase
    .from('stories')
    .insert({
      user_id: input.userId,
      media_path: path,
      media_type: type,
      caption: input.text?.trim() || '',
      visibility: input.visibility,
      event_id: input.eventId ?? null,
      lat: input.location?.latitude ?? null,
      lng: input.location?.longitude ?? null,
    })
    .select('*')
    .single();

  if (error || !data) {
    await supabase.storage.from(BUCKET).remove([path]);
    return null;
  }

  const story = await fromRow({
    ...data,
    user_name: input.authorName,
    user_avatar_url: input.authorAvatarUri,
    viewed_by_me: false,
  });
  cache = [story, ...cache];
  notify();
  return story;
}

export function markStoryViewed(storyId: string, viewerId: string): void {
  if (!viewerId) return;
  const story = cache.find((item) => item.id === storyId);
  if (!story || story.userId === viewerId || story.viewers.includes(viewerId)) return;
  story.viewers.push(viewerId);
  notify();
  supabase.from('story_views').insert({ story_id: storyId, viewer_id: viewerId }).then(() => {});
}

// Optimistic: removes from the local cache and returns synchronously
// (matching the original mock's contract — StoriesContext's `remove` is
// typed to return a plain boolean), firing the real delete in the
// background. RLS only lets a real owner delete their own row anyway.
export function deleteStory(storyId: string, userId: string): boolean {
  const story = cache.find((item) => item.id === storyId && item.userId === userId);
  if (!story) return false;
  cache = cache.filter((item) => item.id !== storyId);
  notify();
  supabase.from('stories').delete().eq('id', storyId).eq('user_id', userId).then(() => {});
  return true;
}
