import { supabase } from '@/lib/supabase';
import { freshChannel } from '@/lib/realtime';

export type MeetupPoint = { eventId: string; lat: number; lng: number; label: string; setBy: string; updatedAt: string };

type MeetupPointRow = { event_id: string; lat: number; lng: number; label: string; set_by: string; updated_at: string };

function mapPoint(row: MeetupPointRow): MeetupPoint {
  return { eventId: row.event_id, lat: row.lat, lng: row.lng, label: row.label, setBy: row.set_by, updatedAt: row.updated_at };
}

export async function getMeetupPoint(eventId: string): Promise<MeetupPoint | null> {
  const { data, error } = await supabase
    .from('event_meetup_points')
    .select('event_id, lat, lng, label, set_by, updated_at')
    .eq('event_id', eventId)
    .maybeSingle();
  if (error || !data) return null;
  return mapPoint(data);
}

// Any attendee can set/move the pin — "whoever set it last" (see the
// migration), so this is a plain upsert, not an RPC.
export async function setMeetupPoint(eventId: string, userId: string, lat: number, lng: number, label: string): Promise<boolean> {
  const { error } = await supabase
    .from('event_meetup_points')
    .upsert(
      { event_id: eventId, lat, lng, label, set_by: userId, updated_at: new Date().toISOString() },
      { onConflict: 'event_id' }
    );
  return !error;
}

export function subscribeToMeetupPoint(eventId: string, onChange: (point: MeetupPoint) => void) {
  const channel = freshChannel(`meetup-point-${eventId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'event_meetup_points', filter: `event_id=eq.${eventId}` },
      (payload) => onChange(mapPoint(payload.new as MeetupPointRow))
    )
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
