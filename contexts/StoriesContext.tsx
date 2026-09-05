import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';

import { useUser } from '@/contexts/UserContext';
import { getFriends } from '@/lib/friendRequests';
import {
  createStory,
  deleteStory,
  getActiveStories,
  getStoriesForEvent,
  getStoriesForFriends,
  markStoryViewed,
  subscribeToStories,
  type Story,
} from '@/lib/stories';

type StoriesContextValue = {
  stories: Story[];
  friendsStories: Story[];
  mapStories: Story[];
  getEventStories: (eventId: string) => Story[];
  create: typeof createStory;
  markViewed: (storyId: string) => void;
  remove: (storyId: string) => boolean;
};

const StoriesContext = createContext<StoriesContextValue | null>(null);

export function StoriesProvider({ children }: PropsWithChildren) {
  const { user } = useUser();
  const [version, setVersion] = useState(0);
  const [friendIds, setFriendIds] = useState<string[]>([]);

  useEffect(() => {
    if (!user) {
      setFriendIds([]);
      return;
    }
    getFriends(user.id).then((friends) => setFriendIds(friends.map((friend) => friend.id)));
  }, [user?.id, version]);

  useEffect(() => subscribeToStories(() => setVersion((current) => current + 1)), []);

  const value = useMemo<StoriesContextValue>(() => {
    const userId = user?.id ?? '';
    const allowedIds = new Set([userId, ...friendIds]);
    const visible = getActiveStories().filter((story) => story.visibility === 'public' || allowedIds.has(story.userId));
    const friendVisible = userId ? getStoriesForFriends(userId, friendIds).filter((story) => story.visibility === 'public' || allowedIds.has(story.userId)) : [];
    return {
      stories: visible,
      friendsStories: friendVisible.filter((story) => story.userId !== userId),
      mapStories: visible.filter((story) => !!story.location || !!story.eventId),
      getEventStories: (eventId) => {
        const allowedIds = new Set([userId, ...friendIds]);
        return getStoriesForEvent(eventId).filter((story) => story.visibility === 'public' || allowedIds.has(story.userId));
      },
      create: createStory,
      markViewed: (storyId) => userId && markStoryViewed(storyId, userId),
      remove: (storyId) => (userId ? deleteStory(storyId, userId) : false),
    };
  }, [friendIds, user?.id, version]);

  return <StoriesContext.Provider value={value}>{children}</StoriesContext.Provider>;
}

export function useStories() {
  const context = useContext(StoriesContext);
  if (!context) throw new Error('useStories must be used within a StoriesProvider');
  return context;
}
