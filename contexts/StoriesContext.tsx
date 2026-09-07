import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { useUser } from '@/contexts/UserContext';
import {
  createStory,
  deleteStory,
  getActiveStories,
  markStoryViewed,
  subscribeToStories,
  type Story,
} from '@/lib/stories';

type StoriesContextValue = {
  stories: Story[];
  friendsStories: Story[];
  mapStories: Story[];
  getEventStories: (eventId: string) => Story[];
  create: (input: Parameters<typeof createStory>[0]) => Promise<Story | null>;
  markViewed: (storyId: string) => void;
  remove: (storyId: string) => Promise<boolean>;
};

const StoriesContext = createContext<StoriesContextValue | null>(null);

export function StoriesProvider({ children }: PropsWithChildren) {
  const { user } = useUser();
  const [stories, setStories] = useState<Story[]>([]);

  // RLS on the stories table already restricts what comes back to what's
  // visible to this user (public, their own, or friends' friends-only
  // posts) — no client-side visibility filtering needed on top of this.
  const refresh = useCallback(async () => {
    setStories(await getActiveStories());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => subscribeToStories(refresh), [refresh]);

  const value = useMemo<StoriesContextValue>(() => {
    const userId = user?.id ?? '';
    return {
      stories,
      friendsStories: stories.filter((story) => story.userId !== userId),
      mapStories: stories.filter((story) => !!story.eventId),
      getEventStories: (eventId) => stories.filter((story) => story.eventId === eventId),
      create: async (input) => {
        const story = await createStory(input);
        if (story) refresh();
        return story;
      },
      markViewed: (storyId) => {
        if (userId) markStoryViewed(storyId, userId);
      },
      remove: async (storyId) => {
        if (!userId) return false;
        const ok = await deleteStory(storyId, userId);
        if (ok) refresh();
        return ok;
      },
    };
  }, [stories, user?.id, refresh]);

  return <StoriesContext.Provider value={value}>{children}</StoriesContext.Provider>;
}

export function useStories() {
  const context = useContext(StoriesContext);
  if (!context) throw new Error('useStories must be used within a StoriesProvider');
  return context;
}
