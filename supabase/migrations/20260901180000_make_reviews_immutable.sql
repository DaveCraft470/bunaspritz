-- The "retract only your own review" DELETE policy combined with the
-- (event_id, reviewer_id, subject_id) unique constraint let a reviewer
-- delete-and-resubmit at will — can_review's time gate only checks
-- joined_at, which never changes, so nothing stopped cycling a rating
-- (or harassing via repeated delete/repost) after the fact. Reviews are
-- immutable once posted instead — no delete, no update, matching how most
-- review platforms treat a "you get one shot, make it count" model.
drop policy "retract only your own review" on public.reviews;
