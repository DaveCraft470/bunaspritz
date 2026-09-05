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

type Listener = () => void;

const stories: Story[] = [];
const listeners = new Set<Listener>();
const STORY_TTL_MS = 24 * 60 * 60 * 1000;

function emit() {
  listeners.forEach((listener) => listener());
}

function activeStories() {
  const now = Date.now();
  return stories.filter((story) => new Date(story.expiresAt).getTime() > now);
}

export function subscribeToStories(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function isStoryExpired(story: Story, now = Date.now()) {
  return new Date(story.expiresAt).getTime() <= now;
}

export function getActiveStories(): Story[] {
  const active = activeStories();
  if (active.length !== stories.length) {
    stories.splice(0, stories.length, ...active);
  }
  return [...active].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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

export function createStory(input: {
  userId: string;
  mediaUri: string;
  type?: StoryMediaType;
  text?: string;
  visibility: StoryVisibility;
  eventId?: string;
  location?: StoryLocation;
  authorName?: string;
  authorAvatarUri?: string | null;
}): Story | null {
  if (!input.userId || !input.mediaUri.trim()) return null;

  const createdAt = new Date();
  const story: Story = {
    id: `story-${createdAt.getTime()}-${Math.random().toString(36).slice(2)}`,
    userId: input.userId,
    mediaUri: input.mediaUri,
    type: input.type ?? 'image',
    text: input.text?.trim() || undefined,
    visibility: input.visibility,
    eventId: input.eventId,
    location: input.location,
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + STORY_TTL_MS).toISOString(),
    viewers: [],
    authorName: input.authorName,
    authorAvatarUri: input.authorAvatarUri,
  };
  stories.unshift(story);
  emit();
  return story;
}

export function markStoryViewed(storyId: string, viewerId: string) {
  if (!viewerId) return;
  const story = stories.find((item) => item.id === storyId);
  if (!story || story.userId === viewerId || story.viewers.includes(viewerId)) return;
  story.viewers.push(viewerId);
  emit();
}

export function deleteStory(storyId: string, userId: string) {
  const index = stories.findIndex((story) => story.id === storyId && story.userId === userId);
  if (index < 0) return false;
  stories.splice(index, 1);
  emit();
  return true;
}
