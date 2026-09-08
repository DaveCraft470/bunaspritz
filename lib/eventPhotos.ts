import { supabase } from '@/lib/supabase';

const ALBUM_BUCKET = 'event-photos';

export type EventPhoto = { id: string; eventId: string; uploaderId: string; path: string; createdAt: string };

type EventPhotoRow = { id: string; event_id: string; uploader_id: string; path: string; created_at: string };

function mapPhoto(row: EventPhotoRow): EventPhoto {
  return { id: row.id, eventId: row.event_id, uploaderId: row.uploader_id, path: row.path, createdAt: row.created_at };
}

export async function getEventPhotos(eventId: string): Promise<EventPhoto[]> {
  const { data, error } = await supabase
    .from('event_photos')
    .select('id, event_id, uploader_id, path, created_at')
    .eq('event_id', eventId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return data.map(mapPhoto);
}

// Same fetch-then-upload idiom as uploadCheckInPhoto/uploadRentalProof (see
// lib/events.ts) — works for both native file:// and web blob:/data: uris.
// The event id has to lead the path (see the migration's storage policies,
// which read it straight out of storage.foldername(name)).
export async function uploadEventPhoto(
  eventId: string,
  uploaderId: string,
  localUri: string,
  extension: string,
  contentType: string
): Promise<EventPhoto | null> {
  let bytes: ArrayBuffer;
  try {
    bytes = await (await fetch(localUri)).arrayBuffer();
  } catch {
    return null;
  }
  if (bytes.byteLength === 0) return null;

  const path = `${eventId}/${uploaderId}-${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`;
  const { error: uploadError } = await supabase.storage.from(ALBUM_BUCKET).upload(path, bytes, { contentType });
  if (uploadError) return null;

  const { data, error } = await supabase
    .from('event_photos')
    .insert({ event_id: eventId, uploader_id: uploaderId, path })
    .select('id, event_id, uploader_id, path, created_at')
    .single();

  if (error || !data) {
    await supabase.storage.from(ALBUM_BUCKET).remove([path]);
    return null;
  }
  return mapPhoto(data);
}

export async function deleteEventPhoto(photoId: string, path: string): Promise<boolean> {
  const { error } = await supabase.from('event_photos').delete().eq('id', photoId);
  if (error) return false;
  await supabase.storage.from(ALBUM_BUCKET).remove([path]);
  return true;
}

export async function getSignedEventPhotoUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(ALBUM_BUCKET).createSignedUrl(path, 60 * 60);
  if (error || !data) return null;
  return data.signedUrl;
}
