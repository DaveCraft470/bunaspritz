import { File } from 'expo-file-system';

import { supabase } from '@/lib/supabase';
import { SpritzEvent } from '@/constants/events';

const RENTAL_PROOF_BUCKET = 'rental-proofs';

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
  starts_at: string | null;
  entry_fee_ron: number | null;
  drinks_price_ron: number | null;
  max_participants: number | null;
  location_is_rented: boolean | null;
  rental_proof_path: string | null;
};

const EVENT_COLUMNS =
  'id, host_id, title, detail, emoji, color, lng, lat, genre, starts_at, entry_fee_ron, drinks_price_ron, max_participants, location_is_rented, rental_proof_path';

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
    startsAt: row.starts_at,
    entryFeeRon: row.entry_fee_ron,
    drinksPriceRon: row.drinks_price_ron,
    maxParticipants: row.max_participants,
    locationIsRented: row.location_is_rented,
    rentalProofPath: row.rental_proof_path,
  };
}

// Uploaded before the event exists (its path doesn't need the event id —
// same idiom as message media), so createEvent can just point at it in the
// same insert. The bucket is private and host-only (see the migration):
// this is a personal record for the host, not a public exhibit.
export async function uploadRentalProof(
  hostId: string,
  localUri: string,
  extension: string,
  contentType: string
): Promise<string | null> {
  const file = new File(localUri);
  const bytes = await file.arrayBuffer();
  if (bytes.byteLength === 0) return null;

  const path = `${hostId}/${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`;
  const { error } = await supabase.storage.from(RENTAL_PROOF_BUCKET).upload(path, bytes, { contentType });
  if (error) return null;

  return path;
}

// Cleans up an uploaded-but-orphaned proof — e.g. the event insert that was
// supposed to point at it failed. Same idiom as sendMediaMessage's cleanup
// in lib/messaging.ts; best-effort, a failed delete just leaves one file.
export async function removeRentalProof(path: string): Promise<void> {
  await supabase.storage.from(RENTAL_PROOF_BUCKET).remove([path]);
}

// A privacy-safe count — never identities, so it's accurate regardless of
// anyone's hide_activity_from setting (unlike fetchAttendees, which reads
// visible_event_attendees and can undercount for a given viewer).
export async function getEventAttendeeCount(eventId: string): Promise<number> {
  const { data, error } = await supabase.rpc('event_attendee_count', { p_event_id: eventId });
  if (error || data === null) return 0;
  return data;
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
    .insert({
      host_id: hostId,
      title: fields.title,
      detail: fields.detail,
      emoji: fields.emoji,
      color: fields.color,
      lng: fields.lng,
      lat: fields.lat,
      genre: fields.genre,
      starts_at: fields.startsAt,
      entry_fee_ron: fields.entryFeeRon,
      drinks_price_ron: fields.drinksPriceRon,
      max_participants: fields.maxParticipants,
      location_is_rented: fields.locationIsRented,
      rental_proof_path: fields.rentalProofPath,
    })
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

export type EventAttendee = { userId: string; name: string; username: string; avatarUrl: string | null };

// Reads visible_event_attendees (not the raw table) so hide_activity_from is
// respected — the viewer never even receives a hidden attendee's row.
export async function fetchAttendees(eventId: string): Promise<EventAttendee[]> {
  const { data: rows } = await supabase.from('visible_event_attendees').select('user_id').eq('event_id', eventId);
  const userIds = (rows ?? []).map((row) => row.user_id);
  if (!userIds.length) return [];

  const { data: profiles } = await supabase.from('profiles').select('id, name, username, avatar_url').in('id', userIds);
  return (profiles ?? []).map((p) => ({ userId: p.id, name: p.name, username: p.username, avatarUrl: p.avatar_url }));
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

// joinEvent's "hosting an event auto-joins you as an attendee" means the
// raw event_attendees count double-counts hosted events — subtract them out
// so "Evenimente" reflects only spritzuri the user attended as a guest.
export async function getUserEventStats(userId: string): Promise<{ attended: number; hosted: number }> {
  const [attendedRows, hostedRows] = await Promise.all([
    supabase.from('event_attendees').select('event_id', { count: 'exact', head: true }).eq('user_id', userId),
    supabase.from('events').select('id', { count: 'exact', head: true }).eq('host_id', userId),
  ]);
  const hosted = hostedRows.count ?? 0;
  return { attended: Math.max((attendedRows.count ?? 0) - hosted, 0), hosted };
}

export async function joinEvent(eventId: string, userId: string): Promise<boolean> {
  const { error } = await supabase.from('event_attendees').insert({ event_id: eventId, user_id: userId });
  if (error) return false;

  // Best-effort — a failed push shouldn't undo an already-recorded join.
  supabase.functions.invoke('notify-join', { body: { eventId } }).catch(() => {});

  return true;
}
