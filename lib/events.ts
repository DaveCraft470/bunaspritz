import { supabase } from '@/lib/supabase';
import { SpritzEvent } from '@/constants/events';

const RENTAL_PROOF_BUCKET = 'rental-proofs';
const CHECKIN_PHOTO_BUCKET = 'checkin-photos';

// Mirrors check_in_to_event's v_max_distance_m in the migration — this copy
// only ever gates whether the client's button is enabled; the server-side
// value is the one that actually can't be bypassed.
export const CHECK_IN_MAX_DISTANCE_METERS = 200;

type EventRow = {
  id: string;
  host_id: string | null;
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
  visibility: 'public' | 'private';
  approval_mode: 'instant' | 'manual';
  source: 'host' | 'scraper';
  source_url: string | null;
  is_outdoor: boolean;
  publish_at: string | null;
};

const EVENT_COLUMNS =
  'id, host_id, title, detail, emoji, color, lng, lat, genre, starts_at, entry_fee_ron, drinks_price_ron, max_participants, location_is_rented, rental_proof_path, visibility, approval_mode, source, source_url, is_outdoor, publish_at';

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
    visibility: row.visibility,
    approvalMode: row.approval_mode,
    source: row.source,
    sourceUrl: row.source_url,
    isOutdoor: row.is_outdoor,
    publishAt: row.publish_at,
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
  // expo-file-system's File class is a no-op stub on the web build (it only
  // warns "not supported on web") — fetch() reads both file:// (native) and
  // blob:/data: (web) uris the same way, so it works everywhere without a
  // platform branch (see lib/messaging.ts's sendMediaMessage for the same fix).
  const bytes = await (await fetch(localUri)).arrayBuffer();
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

// A live camera shot taken to confirm attendance — private to the uploader
// (see the migration's checkin-photos bucket policies), same fetch/upload
// idiom as uploadRentalProof.
export async function uploadCheckInPhoto(
  userId: string,
  eventId: string,
  localUri: string,
  extension: string,
  contentType: string
): Promise<string | null> {
  const bytes = await (await fetch(localUri)).arrayBuffer();
  if (bytes.byteLength === 0) return null;

  const path = `${userId}/${eventId}-${Date.now()}${extension}`;
  const { error } = await supabase.storage.from(CHECKIN_PHOTO_BUCKET).upload(path, bytes, { contentType });
  if (error) return null;

  return path;
}

export type AttendanceStatus = { checkedIn: boolean; method: 'photo' | 'paid' | null };

// Reads the caller's own event_attendees row directly — allowed by the
// existing "see only your own attendance row directly" policy, no RPC needed
// for a read. checked_in_at/check_in_method can only ever be *written* via
// check_in_to_event (or, eventually, a payment webhook) — see the migration.
export async function getMyAttendance(eventId: string, userId: string): Promise<AttendanceStatus> {
  const { data } = await supabase
    .from('event_attendees')
    .select('checked_in_at, check_in_method')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle();

  return { checkedIn: !!data?.checked_in_at, method: (data?.check_in_method as 'photo' | 'paid' | null) ?? null };
}

const CHECK_IN_ERROR_MESSAGES: Record<string, string> = {
  'not joined': 'Trebuie să confirmi mai întâi participarea la eveniment.',
  'already checked in': 'Participarea ta e deja confirmată.',
  'too far from event location': 'Ești prea departe de locația evenimentului ca să confirmi.',
  'event not found': 'Evenimentul nu mai există.',
};

// The one and only way check_in_photo_path/checked_in_at get set for the
// 'photo' path — check_in_to_event (the migration) re-validates distance and
// join status server-side, since the client-side distance check (used only
// to enable/disable the button) can't be trusted on its own.
export async function checkInToEvent(
  eventId: string,
  lat: number,
  lng: number,
  photoPath: string
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.rpc('check_in_to_event', {
    p_event_id: eventId,
    p_lat: lat,
    p_lng: lng,
    p_photo_path: photoPath,
  });
  if (!error) return { ok: true };

  const message = CHECK_IN_ERROR_MESSAGES[error.message] ?? 'Nu am putut confirma participarea. Încearcă din nou.';
  return { ok: false, error: message };
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
  if (error) throw error;
  return data.map(mapEvent);
}

export async function createEvent(
  hostId: string,
  fields: Omit<SpritzEvent, 'id' | 'hostId' | 'source' | 'sourceUrl'>
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
      visibility: fields.visibility,
      approval_mode: fields.approvalMode,
      is_outdoor: fields.isOutdoor,
      publish_at: fields.publishAt,
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

export async function updateEvent(
  eventId: string,
  hostId: string,
  fields: Omit<SpritzEvent, 'id' | 'hostId' | 'source' | 'sourceUrl'>
): Promise<SpritzEvent | null> {
  const { data, error } = await supabase
    .from('events')
    .update({
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
      visibility: fields.visibility,
      approval_mode: fields.approvalMode,
      is_outdoor: fields.isOutdoor,
      publish_at: fields.publishAt,
    })
    .eq('id', eventId)
    .eq('host_id', hostId)
    .select(EVENT_COLUMNS)
    .single();

  if (error || !data) return null;
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

// A host cancelling their own event (deleteEvent) only ever updated that
// host's own local list — everyone else who already had the map/list loaded
// kept seeing the stale pin/entry until they manually pulled to refresh.
// payload.old only carries the primary key without REPLICA IDENTITY FULL on
// this table, which is exactly (and only) what's needed here.
export function subscribeToDeletedEvents(onDelete: (eventId: string) => void) {
  const channel = supabase
    .channel('events-deletes')
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'events' }, (payload) => {
      onDelete((payload.old as { id: string }).id);
    })
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export type EventAttendee = { userId: string; name: string; username: string; avatarUrl: string | null; goingAlone: boolean };

// Reads visible_event_attendees (not the raw table) so hide_activity_from is
// respected — the viewer never even receives a hidden attendee's row.
export async function fetchAttendees(eventId: string): Promise<EventAttendee[]> {
  const { data: rows } = await supabase.from('visible_event_attendees').select('user_id, going_alone').eq('event_id', eventId);
  const userIds = (rows ?? []).map((row) => row.user_id);
  if (!userIds.length) return [];
  const goingAloneByUserId = new Map((rows ?? []).map((row) => [row.user_id, row.going_alone]));

  const { data: profiles } = await supabase.from('profiles').select('id, name, username, avatar_url').in('id', userIds);
  return (profiles ?? []).map((p) => ({
    userId: p.id,
    name: p.name,
    username: p.username,
    avatarUrl: p.avatar_url,
    goingAlone: !!goingAloneByUserId.get(p.id),
  }));
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

export async function getUserJoinedEventIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from('event_attendees').select('event_id').eq('user_id', userId);
  if (error) throw error;
  return data.map((row) => row.event_id);
}

// "Evenimente" now reflects confirmed attendance (checked_in_at set), not
// just having joined — see check_in_to_event. joinEvent's "hosting an event
// auto-joins you as an attendee" row never gets a check-in of its own, so it
// no longer needs subtracting out of this count the way it used to.
export async function getUserEventStats(userId: string): Promise<{ attended: number; hosted: number }> {
  const [attendedRows, hostedRows] = await Promise.all([
    supabase
      .from('event_attendees')
      .select('event_id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .not('checked_in_at', 'is', null),
    supabase.from('events').select('id', { count: 'exact', head: true }).eq('host_id', userId),
  ]);
  return { attended: attendedRows.count ?? 0, hosted: hostedRows.count ?? 0 };
}

// Most-recently-checked-in-to events first — used to narrow the new-story
// event picker to events the user actually attended, not just any event.
export async function getRecentAttendedEventIds(userId: string, limit: number): Promise<string[]> {
  const { data } = await supabase
    .from('event_attendees')
    .select('event_id')
    .eq('user_id', userId)
    .not('checked_in_at', 'is', null)
    .order('checked_in_at', { ascending: false })
    .limit(limit);
  return (data ?? []).map((row) => row.event_id);
}

// "Merg singur" — a per-attendance flag, only settable on your own row (no
// general UPDATE policy on event_attendees exists; see set_going_alone).
export async function getGoingAlone(eventId: string, userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('event_attendees')
    .select('going_alone')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle();
  return !!data?.going_alone;
}

export async function setGoingAlone(eventId: string, value: boolean): Promise<boolean> {
  const { error } = await supabase.rpc('set_going_alone', { p_event_id: eventId, p_value: value });
  return !error;
}

export async function joinEvent(eventId: string, userId: string): Promise<boolean> {
  const { error } = await supabase.from('event_attendees').insert({ event_id: eventId, user_id: userId });
  if (error) return false;

  // Best-effort — a failed push shouldn't undo an already-recorded join.
  supabase.functions.invoke('notify-join', { body: { eventId } }).catch(() => {});

  return true;
}

// The DB has always allowed this ("leave as yourself" in the init
// migration), but nothing in the app ever called it — meaning a filled
// event's spot could never free up once someone joined and changed their
// mind, which max_participants (this session) turned from a minor gap into
// a real one. Not for hosts — leaving your own event would desync it from
// event_attendees while the event itself still exists; gate that in the UI.
export async function leaveEvent(eventId: string, userId: string): Promise<boolean> {
  const { error } = await supabase.from('event_attendees').delete().eq('event_id', eventId).eq('user_id', userId);
  return !error;
}

// "hosts delete their own events" (init migration) already allowed this —
// event_attendees and reviews both reference events with `on delete
// cascade`, so attendees/reviews for a cancelled event clean up on their
// own. rental_proof_path doesn't (it's just a text column pointing at
// private storage), so it needs its own best-effort cleanup first — same
// idiom as removeRentalProof's own doc comment about orphaned uploads.
export async function deleteEvent(eventId: string, hostId: string, rentalProofPath: string | null): Promise<boolean> {
  const { error } = await supabase.from('events').delete().eq('id', eventId).eq('host_id', hostId);
  if (error) return false;
  if (rentalProofPath) await removeRentalProof(rentalProofPath);
  return true;
}

// Admin moderation delete — bypasses the "hosts delete their own events" RLS
// policy via the admin_delete_event() RPC, which re-checks is_admin()
// server-side (the client-side gate in lib/admin.ts is UI-only).
export async function adminDeleteEvent(eventId: string, rentalProofPath: string | null): Promise<boolean> {
  const { error } = await supabase.rpc('admin_delete_event', { p_event_id: eventId });
  if (error) return false;
  if (rentalProofPath) await removeRentalProof(rentalProofPath);
  return true;
}

// ==================================================== event_join_requests ==
// Only meaningful for approval_mode: 'manual' events — joinEvent() above
// still handles instant-approval joins directly, unchanged.
export type JoinRequestStatus = 'none' | 'pending' | 'accepted' | 'rejected';

export async function getJoinRequestStatus(eventId: string, userId: string): Promise<JoinRequestStatus> {
  const { data } = await supabase
    .from('event_join_requests')
    .select('status')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .maybeSingle();
  return (data?.status as JoinRequestStatus | undefined) ?? 'none';
}

export async function requestToJoinEvent(eventId: string, userId: string): Promise<boolean> {
  const { error } = await supabase.from('event_join_requests').insert({ event_id: eventId, user_id: userId });

  if (error) {
    // The unique (event_id, user_id) constraint means a second insert after
    // a rejection always conflicts — fall back to resetting that same row
    // back to pending instead, which the "requester can ask again after a
    // rejection" RLS policy allows only when it was actually rejected (a
    // still-pending or already-accepted row is left untouched: 0 rows
    // updated, no error, and requestToJoinEvent correctly reports failure).
    const { data, error: retryError } = await supabase
      .from('event_join_requests')
      .update({ status: 'pending', responded_at: null })
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .eq('status', 'rejected')
      .select('id');
    if (retryError || !data?.length) return false;
  }

  // Best-effort — a failed push shouldn't undo an already-recorded request.
  supabase.functions.invoke('notify-join-request', { body: { eventId } }).catch(() => {});
  return true;
}

// Only a still-pending request can be withdrawn (see the DELETE policy) —
// once the host has responded there's no "un-asking", it's up to the host.
export async function cancelJoinRequest(eventId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('event_join_requests')
    .delete()
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .eq('status', 'pending');
  return !error;
}

export type HostJoinRequest = {
  id: string;
  eventId: string;
  eventTitle: string;
  userId: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  createdAt: string;
};

// `events!inner(...)` both pulls in the event's title and restricts the
// outer rows to ones for events this host actually owns — the "host sees
// join requests for their own events" RLS policy would let a plain select
// return the caller's own outgoing requests too (its OR'd sibling policy),
// which this join filters back out.
export async function getHostJoinRequests(hostId: string): Promise<HostJoinRequest[]> {
  const { data: rows } = await supabase
    .from('event_join_requests')
    .select('id, event_id, user_id, created_at, events!inner(title, host_id)')
    .eq('status', 'pending')
    .eq('events.host_id', hostId)
    .order('created_at', { ascending: false });
  if (!rows?.length) return [];

  const userIds = rows.map((row) => row.user_id);
  const { data: profiles } = await supabase.from('profiles').select('id, name, username, avatar_url').in('id', userIds);
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  return rows.map((row) => {
    const profile = profileById.get(row.user_id);
    const event = row.events as unknown as { title: string };
    return {
      id: row.id,
      eventId: row.event_id,
      eventTitle: event.title,
      userId: row.user_id,
      name: profile?.name ?? '',
      username: profile?.username ?? '',
      avatarUrl: profile?.avatar_url ?? null,
      createdAt: row.created_at,
    };
  });
}

export async function respondToJoinRequest(requestId: string, approve: boolean): Promise<boolean> {
  const { error } = await supabase.rpc('respond_join_request', { p_request_id: requestId, p_approve: approve });
  if (error) return false;

  // Best-effort — the request's status has already changed either way.
  supabase.functions.invoke('notify-join-response', { body: { requestId } }).catch(() => {});
  return true;
}
