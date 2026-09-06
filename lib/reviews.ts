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
