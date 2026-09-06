# Stories backend handoff

The current Stories implementation is local and in-memory only.

A backend replacement should provide:

- `stories` table with author, media path, visibility, optional event and location, created/expiry timestamps;
- private/public media storage with upload and deletion rules;
- `story_viewers` table or equivalent view tracking;
- RLS enforcing public vs friends-only visibility and author-only deletion;
- expiry filtering at repository/query level;
- event relation validation and cleanup when an event is removed;
- bulk queries for active stories, friends, event stories and map stories.

The UI can keep the existing `StoriesContext` contract while replacing `lib/stories.ts` with a backend repository.
