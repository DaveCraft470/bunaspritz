import { supabase } from '@/lib/supabase';
import { freshChannel } from '@/lib/realtime';
import { getProfiles } from '@/lib/social';

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
  // A resolved signed URL, ready to render directly — see hydrate() below.
  // Re-fetched on every getActiveStories()/getStoriesForEvent() call, so a
  // long-lived viewing session (past the 1-hour signed-URL TTL) would need
  // its own refresh, same trade-off ImageBubble documents for chat media.
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

const STORY_BUCKET = 'stories';
const SIGNED_URL_TTL_SECONDS = 60 * 60;

type DbStory = {
  id: string;
  user_id: string;
  media_path: string;
  media_type: StoryMediaType;
  text: string | null;
  visibility: StoryVisibility;
  event_id: string | null;
  latitude: number | null;
  longitude: number | null;
  location_label: string | null;
  created_at: string;
  expires_at: string;
};

const STORY_COLUMNS =
  'id, user_id, media_path, media_type, text, visibility, event_id, latitude, longitude, location_label, created_at, expires_at';

async function getViewersByStory(storyIds: string[]): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (!storyIds.length) return map;
  const { data } = await supabase.from('story_views').select('story_id, viewer_id').in('story_id', storyIds);
  (data ?? []).forEach((row) => {
    const list = map.get(row.story_id) ?? [];
    list.push(row.viewer_id);
    map.set(row.story_id, list);
  });
  return map;
}

// RLS on both `stories` and the storage bucket already restrict what comes
// back to what's actually visible to the caller (public / own / friends'
// friends-only), so this just resolves each row into something the
// existing UI (StoryViewer, StoryBubble, StoriesRow) can render as-is.
async function hydrate(rows: DbStory[]): Promise<Story[]> {
  if (!rows.length) return [];

  const [signedUrls, authorProfiles, viewersByStory] = await Promise.all([
    Promise.all(rows.map((row) => supabase.storage.from(STORY_BUCKET).createSignedUrl(row.media_path, SIGNED_URL_TTL_SECONDS))),
    getProfiles([...new Set(rows.map((row) => row.user_id))]),
    getViewersByStory(rows.map((row) => row.id)),
  ]);

  const authorsById = new Map(authorProfiles.map((profile) => [profile.id, profile]));

  return rows.map((row, index) => {
    const author = authorsById.get(row.user_id);
    return {
      id: row.id,
      userId: row.user_id,
      mediaUri: signedUrls[index].data?.signedUrl ?? '',
      type: row.media_type,
      text: row.text ?? undefined,
      visibility: row.visibility,
      eventId: row.event_id ?? undefined,
      location:
        row.latitude != null && row.longitude != null
          ? { latitude: row.latitude, longitude: row.longitude, label: row.location_label ?? undefined }
          : undefined,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      viewers: viewersByStory.get(row.id) ?? [],
      authorName: author?.name,
      authorAvatarUri: author?.avatar_url,
    };
  });
}

export function isStoryExpired(story: Story, now = Date.now()) {
  return new Date(story.expiresAt).getTime() <= now;
}

// Every row RLS returns is already unexpired and visible to the caller —
// StoriesContext does the "is this from a friend / does it have an event"
// grouping client-side over this one list instead of separate queries.
export async function getActiveStories(): Promise<Story[]> {
  const { data, error } = await supabase.from('stories').select(STORY_COLUMNS).order('created_at', { ascending: false });
  if (error || !data) return [];
  return hydrate(data);
}

export async function getStoriesForEvent(eventId: string): Promise<Story[]> {
  const { data, error } = await supabase
    .from('stories')
    .select(STORY_COLUMNS)
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return hydrate(data);
}

export async function createStory(input: {
  userId: string;
  localUri: string;
  extension: string;
  contentType: string;
  type?: StoryMediaType;
  text?: string;
  visibility: StoryVisibility;
  eventId?: string;
  location?: StoryLocation;
}): Promise<Story | null> {
  if (!input.userId || !input.localUri.trim()) return null;

  const bytes = await (await fetch(input.localUri)).arrayBuffer();
  if (bytes.byteLength === 0) return null;

  const path = `${input.userId}/${Date.now()}-${Math.random().toString(36).slice(2)}${input.extension}`;
  const { error: uploadError } = await supabase.storage.from(STORY_BUCKET).upload(path, bytes, { contentType: input.contentType });
  if (uploadError) return null;

  const { data, error } = await supabase
    .from('stories')
    .insert({
      user_id: input.userId,
      media_path: path,
      media_type: input.type ?? 'image',
      text: input.text?.trim() || null,
      visibility: input.visibility,
      event_id: input.eventId ?? null,
      latitude: input.location?.latitude ?? null,
      longitude: input.location?.longitude ?? null,
      location_label: input.location?.label ?? null,
    })
    .select(STORY_COLUMNS)
    .single();

  if (error || !data) {
    await supabase.storage.from(STORY_BUCKET).remove([path]);
    return null;
  }

  const [hydrated] = await hydrate([data]);
  return hydrated ?? null;
}

export async function markStoryViewed(storyId: string, viewerId: string): Promise<void> {
  if (!viewerId) return;
  await supabase
    .from('story_views')
    .upsert({ story_id: storyId, viewer_id: viewerId }, { onConflict: 'story_id,viewer_id', ignoreDuplicates: true });
}

export async function deleteStory(storyId: string, userId: string): Promise<boolean> {
  const { data: existing } = await supabase
    .from('stories')
    .select('media_path')
    .eq('id', storyId)
    .eq('user_id', userId)
    .maybeSingle();

  const { error } = await supabase.from('stories').delete().eq('id', storyId).eq('user_id', userId);
  if (error) return false;

  if (existing?.media_path) await supabase.storage.from(STORY_BUCKET).remove([existing.media_path]);
  return true;
}

export function subscribeToStories(listener: () => void) {
  const channel = freshChannel('stories-all')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'stories' }, listener)
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
