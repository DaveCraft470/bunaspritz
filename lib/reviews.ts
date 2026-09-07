import { supabase } from '@/lib/supabase';

export type Review = {
  id: string;
  eventId: string;
  reviewerId: string;
  reviewerName: string;
  reviewerUsername: string;
  rating: number;
  comment: string;
  createdAt: string;
};

export type ReviewSummary = { average: number; count: number };

export type ReviewableEvent = { eventId: string; title: string };

export type GivenReview = {
  id: string;
  eventId: string;
  subjectId: string;
  subjectName: string;
  subjectUsername: string;
  rating: number;
  comment: string;
  createdAt: string;
};

export type PendingReview = {
  eventId: string;
  eventTitle: string;
  subjectId: string;
  subjectName: string;
  subjectUsername: string;
  subjectAvatarUrl: string | null;
};

type ReviewRow = {
  id: string;
  event_id: string;
  reviewer_id: string;
  rating: number;
  comment: string;
  created_at: string;
  profiles: { name: string; username: string } | null;
};

export async function getReviews(subjectId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('id, event_id, reviewer_id, rating, comment, created_at, profiles!reviews_reviewer_id_fkey(name, username)')
    .eq('subject_id', subjectId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return (data as unknown as ReviewRow[]).map((row) => ({
    id: row.id,
    eventId: row.event_id,
    reviewerId: row.reviewer_id,
    reviewerName: row.profiles?.name ?? '',
    reviewerUsername: row.profiles?.username ?? '',
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at,
  }));
}

export async function getReviewSummary(subjectId: string): Promise<ReviewSummary> {
  const { data } = await supabase.from('reviews').select('rating').eq('subject_id', subjectId);
  if (!data || data.length === 0) return { average: 0, count: 0 };
  const total = data.reduce((sum, row) => sum + row.rating, 0);
  return { average: total / data.length, count: data.length };
}

// Events the signed-in user shared a spritz with subjectId on and can still
// leave a review for — enforced server-side by can_review (co-attendance +
// a few hours' time gate), see supabase/migrations/*_add_reviews.sql.
export async function getReviewableEvents(subjectId: string): Promise<ReviewableEvent[]> {
  const { data, error } = await supabase.rpc('reviewable_events', { p_subject_id: subjectId });
  if (error || !data) return [];
  return data.map((row: { event_id: string; title: string }) => ({ eventId: row.event_id, title: row.title }));
}

type GivenReviewRow = {
  id: string;
  event_id: string;
  subject_id: string;
  rating: number;
  comment: string;
  created_at: string;
  profiles: { name: string; username: string } | null;
};

// Reviews the caller has given to others ("Trimise").
export async function getReviewsGiven(reviewerId: string): Promise<GivenReview[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('id, event_id, subject_id, rating, comment, created_at, profiles!reviews_subject_id_fkey(name, username)')
    .eq('reviewer_id', reviewerId)
    .order('created_at', { ascending: false });

  if (error || !data) return [];
  return (data as unknown as GivenReviewRow[]).map((row) => ({
    id: row.id,
    eventId: row.event_id,
    subjectId: row.subject_id,
    subjectName: row.profiles?.name ?? '',
    subjectUsername: row.profiles?.username ?? '',
    rating: row.rating,
    comment: row.comment,
    createdAt: row.created_at,
  }));
}

// Every (event, co-attendee) pair the caller can currently review, across
// all of their events — the "De acordat" queue. See reviewable_pending_for_me
// in supabase/migrations for the exact eligibility rules (shared attendance,
// past the time gate, not already reviewed or dismissed).
export async function getReviewablePending(): Promise<PendingReview[]> {
  const { data, error } = await supabase.rpc('reviewable_pending_for_me');
  if (error || !data) return [];
  return (data as any[]).map((row) => ({
    eventId: row.event_id,
    eventTitle: row.event_title,
    subjectId: row.subject_id,
    subjectName: row.subject_name ?? '',
    subjectUsername: row.subject_username ?? '',
    subjectAvatarUrl: row.subject_avatar_url,
  }));
}

// Dismissing a pending review just hides it from the queue — it's not a
// review (no rating recorded) and doesn't block reviewing the same person
// from a different shared event later.
export async function dismissReviewable(reviewerId: string, eventId: string, subjectId: string): Promise<boolean> {
  const { error } = await supabase
    .from('review_dismissals')
    .insert({ reviewer_id: reviewerId, event_id: eventId, subject_id: subjectId });
  return !error;
}

export async function submitReview(
  eventId: string,
  reviewerId: string,
  subjectId: string,
  rating: number,
  comment: string
): Promise<boolean> {
  const { error } = await supabase
    .from('reviews')
    .insert({ event_id: eventId, reviewer_id: reviewerId, subject_id: subjectId, rating, comment: comment.trim() });
  return !error;
}
