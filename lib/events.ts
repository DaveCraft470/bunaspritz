import { supabase } from '@/lib/supabase';
import { SpritzEvent } from '@/constants/events';

type EventRow = {
  id: string;
  host_id: string;
  title: string;
  detail: string;
  emoji: string;
  color: string;
  lng: number;
  lat: number;
  genre: string;
};

const EVENT_COLUMNS = 'id, host_id, title, detail, emoji, color, lng, lat, genre';

function mapEvent(row: EventRow): SpritzEvent {
  return {
    id: row.id,
    hostId: row.host_id,
    title: row.title,
    detail: row.detail,
    emoji: row.emoji,
    color: row.color,
    lng: row.lng,
    lat: row.lat,
    genre: row.genre,
  };
}

export async function fetchEvents(): Promise<SpritzEvent[]> {
  const { data, error } = await supabase.from('events').select(EVENT_COLUMNS).order('created_at', { ascending: true });
  if (error) return [];
  return data.map(mapEvent);
}

export async function createEvent(
  hostId: string,
  fields: Omit<SpritzEvent, 'id' | 'hostId'>
): Promise<SpritzEvent | null> {
  const { data, error } = await supabase
    .from('events')
    .insert({ host_id: hostId, ...fields })
    .select(EVENT_COLUMNS)
    .single();

  if (error || !data) return null;

  // Hosting counts as attending your own event, matching the old behavior
  // where a freshly-created event always started with the host in it.
  await supabase.from('event_attendees').insert({ event_id: data.id, user_id: hostId });

  // Best-effort — a failed push shouldn't undo an already-published event.
  supabase.functions.invoke('notify-new-event', { body: { eventId: data.id } }).catch(() => {});

  return mapEvent(data);
}

export function subscribeToNewEvents(onInsert: (event: SpritzEvent) => void) {
  const channel = supabase
    .channel('events-inserts')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'events' }, (payload) => {
      onInsert(mapEvent(payload.new as EventRow));
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export type EventAttendee = { userId: string; name: string; username: string };

// Reads visible_event_attendees (not the raw table) so hide_activity_from is
// respected — the viewer never even receives a hidden attendee's row.
export async function fetchAttendees(eventId: string): Promise<EventAttendee[]> {
  const { data: rows } = await supabase.from('visible_event_attendees').select('user_id').eq('event_id', eventId);
  const userIds = (rows ?? []).map((row) => row.user_id);
  if (!userIds.length) return [];

  const { data: profiles } = await supabase.from('profiles').select('id, name, username').in('id', userIds);
  return (profiles ?? []).map((p) => ({ userId: p.id, name: p.name, username: p.username }));
}

export async function hasJoined(eventId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('event_attendees')
    .select('event_id')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}

export async function joinEvent(eventId: string, userId: string): Promise<boolean> {
  const { error } = await supabase.from('event_attendees').insert({ event_id: eventId, user_id: userId });
  if (error) return false;

  // Best-effort — a failed push shouldn't undo an already-recorded join.
  supabase.functions.invoke('notify-join', { body: { eventId } }).catch(() => {});

  return true;
}
