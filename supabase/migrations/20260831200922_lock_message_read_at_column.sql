-- Same gap as the profiles.verified fix: "recipients can mark messages read"
-- is a row-level policy only (recipient_id = auth.uid()), with no column
-- restriction — so a recipient could currently rewrite the sender's text,
-- sender_id, or created_at on any message addressed to them, not just flip
-- read_at. Only now (read receipts / unread counts) does the app actually
-- exercise this UPDATE path, so this is the right moment to close it.
revoke update on public.messages from authenticated;
grant update (read_at) on public.messages to authenticated;
