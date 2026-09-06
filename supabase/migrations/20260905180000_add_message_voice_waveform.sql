-- A compact amplitude profile captured live while recording (see the
-- metering samples already used for the composer's live waveform), stored
-- once at send time so voice bubbles can render a real WhatsApp/iMessage-
-- style static waveform instead of a plain bar.
alter table public.messages
  add column waveform jsonb,
  add constraint messages_waveform_only_for_audio
    check (waveform is null or media_type = 'audio');
