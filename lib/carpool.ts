import { supabase } from '@/lib/supabase';
import { freshChannel } from '@/lib/realtime';

// "Am mașină" / "Caut transport" — riders and drivers coordinate themselves
// via each other's note + the event's existing group chat and meetup point
// (see lib/meetupPoint.ts); there's no in-app matching/booking engine here.
export type CarpoolOffer = { eventId: string; driverId: string; seatsAvailable: number; note: string; createdAt: string };
export type CarpoolRequest = { eventId: string; userId: string; note: string; createdAt: string };

function mapOffer(row: { event_id: string; driver_id: string; seats_available: number; note: string; created_at: string }): CarpoolOffer {
  return { eventId: row.event_id, driverId: row.driver_id, seatsAvailable: row.seats_available, note: row.note, createdAt: row.created_at };
}

function mapRequest(row: { event_id: string; user_id: string; note: string; created_at: string }): CarpoolRequest {
  return { eventId: row.event_id, userId: row.user_id, note: row.note, createdAt: row.created_at };
}

export async function getCarpoolOffers(eventId: string): Promise<CarpoolOffer[]> {
  const { data, error } = await supabase
    .from('event_carpool_offers')
    .select('event_id, driver_id, seats_available, note, created_at')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('[carpool] getCarpoolOffers failed', error);
    return [];
  }
  return data.map(mapOffer);
}

export async function offerCarpoolSeats(eventId: string, driverId: string, seats: number, note: string): Promise<boolean> {
  const { error } = await supabase
    .from('event_carpool_offers')
    .upsert({ event_id: eventId, driver_id: driverId, seats_available: seats, note }, { onConflict: 'event_id,driver_id' });
  if (error) console.error('[carpool] offerCarpoolSeats failed', error);
  return !error;
}

export async function removeCarpoolOffer(eventId: string, driverId: string): Promise<boolean> {
  const { error } = await supabase.from('event_carpool_offers').delete().eq('event_id', eventId).eq('driver_id', driverId);
  if (error) console.error('[carpool] removeCarpoolOffer failed', error);
  return !error;
}

export async function getCarpoolRequests(eventId: string): Promise<CarpoolRequest[]> {
  const { data, error } = await supabase
    .from('event_carpool_requests')
    .select('event_id, user_id, note, created_at')
    .eq('event_id', eventId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('[carpool] getCarpoolRequests failed', error);
    return [];
  }
  return data.map(mapRequest);
}

export async function requestCarpoolSeat(eventId: string, userId: string, note: string): Promise<boolean> {
  const { error } = await supabase.from('event_carpool_requests').upsert({ event_id: eventId, user_id: userId, note }, { onConflict: 'event_id,user_id' });
  if (error) console.error('[carpool] requestCarpoolSeat failed', error);
  return !error;
}

export async function removeCarpoolRequest(eventId: string, userId: string): Promise<boolean> {
  const { error } = await supabase.from('event_carpool_requests').delete().eq('event_id', eventId).eq('user_id', userId);
  if (error) console.error('[carpool] removeCarpoolRequest failed', error);
  return !error;
}

export function subscribeToCarpool(eventId: string, onChange: () => void) {
  const channel = freshChannel(`carpool-${eventId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'event_carpool_offers', filter: `event_id=eq.${eventId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'event_carpool_requests', filter: `event_id=eq.${eventId}` }, onChange)
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
