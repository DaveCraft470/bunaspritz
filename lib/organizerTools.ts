import { supabase } from '@/lib/supabase';
import { SpritzEvent } from '@/constants/events';
import { createEvent } from '@/lib/events';
import type { EventPreviewDraft } from '@/lib/eventPreview';

// ================================================== organizer reputation ===
export type OrganizerReputation = { score: number; hostedCount: number; avgRating: number; checkinRate: number };

export async function getOrganizerReputation(hostId: string): Promise<OrganizerReputation | null> {
  const { data, error } = await supabase.rpc('get_organizer_reputation', { p_host_id: hostId });
  const row = data?.[0];
  if (error || !row) return null;
  return { score: row.score, hostedCount: row.hosted_count, avgRating: row.avg_rating, checkinRate: row.checkin_rate };
}

// ======================================================= event analytics ===
export type EventAnalytics = {
  viewCount: number;
  saveCount: number;
  joinCount: number;
  checkinCount: number;
  saveToJoinCount: number;
};

export async function getEventAnalytics(eventId: string): Promise<EventAnalytics | null> {
  const { data, error } = await supabase.rpc('get_event_analytics', { p_event_id: eventId });
  const row = data?.[0];
  if (error || !row) return null;
  return {
    viewCount: row.view_count,
    saveCount: row.save_count,
    joinCount: row.join_count,
    checkinCount: row.checkin_count,
    saveToJoinCount: row.save_to_join_count,
  };
}

// ======================================================== event templates ==
export type EventTemplate = {
  id: string;
  name: string;
  title: string;
  detail: string;
  emoji: string;
  color: string;
  genre: string;
  entryFeeRon: number | null;
  drinksPriceRon: number | null;
  maxParticipants: number | null;
  visibility: 'public' | 'private';
  approvalMode: 'instant' | 'manual';
};

type TemplateRow = {
  id: string;
  name: string;
  title: string;
  detail: string;
  emoji: string;
  color: string;
  genre: string;
  entry_fee_ron: number | null;
  drinks_price_ron: number | null;
  max_participants: number | null;
  visibility: 'public' | 'private';
  approval_mode: 'instant' | 'manual';
};

function mapTemplate(row: TemplateRow): EventTemplate {
  return {
    id: row.id,
    name: row.name,
    title: row.title,
    detail: row.detail,
    emoji: row.emoji,
    color: row.color,
    genre: row.genre,
    entryFeeRon: row.entry_fee_ron,
    drinksPriceRon: row.drinks_price_ron,
    maxParticipants: row.max_participants,
    visibility: row.visibility,
    approvalMode: row.approval_mode,
  };
}

const TEMPLATE_COLUMNS = 'id, name, title, detail, emoji, color, genre, entry_fee_ron, drinks_price_ron, max_participants, visibility, approval_mode';

export async function getEventTemplates(hostId: string): Promise<EventTemplate[]> {
  const { data, error } = await supabase.from('event_templates').select(TEMPLATE_COLUMNS).eq('host_id', hostId).order('created_at', { ascending: false });
  if (error) return [];
  return data.map(mapTemplate);
}

export async function saveEventTemplate(hostId: string, name: string, event: SpritzEvent): Promise<boolean> {
  const { error } = await supabase.from('event_templates').insert({
    host_id: hostId,
    name,
    title: event.title,
    detail: event.detail,
    emoji: event.emoji,
    color: event.color,
    genre: event.genre,
    entry_fee_ron: event.entryFeeRon,
    drinks_price_ron: event.drinksPriceRon,
    max_participants: event.maxParticipants,
    visibility: event.visibility,
    approval_mode: event.approvalMode,
  });
  return !error;
}

export async function deleteEventTemplate(templateId: string): Promise<boolean> {
  const { error } = await supabase.from('event_templates').delete().eq('id', templateId);
  return !error;
}

// A template has no location/time — new-event.tsx's own defaults (current
// device location, next free hour) fill those in, same as starting from
// scratch. mode: 'create' so it hydrates into a fresh event, same idiom as
// duplicateDraftFromEvent.
export function draftFromTemplate(template: EventTemplate): EventPreviewDraft {
  return {
    mode: 'create',
    title: template.title,
    detail: template.detail,
    genre: template.genre,
    emoji: template.emoji,
    color: template.color,
    startsAt: null,
    entryFeeRon: template.entryFeeRon,
    drinksPriceRon: template.drinksPriceRon,
    maxParticipants: template.maxParticipants,
    lng: null,
    lat: null,
    locationIsRented: null,
    rentalProofAttached: false,
    drinks: [],
    songs: [],
    visibility: template.visibility,
    approvalMode: template.approvalMode,
  };
}

// ======================================================== recurring events ==
// Just calls createEvent() again per occurrence — same insert path and RLS
// as any other event creation, no new schema/RPC needed. Best-effort: if one
// occurrence fails to insert, the rest still get attempted so a host doesn't
// lose an otherwise-successful batch over one bad night.
export async function createRecurringEvents(
  hostId: string,
  baseFields: Omit<SpritzEvent, 'id' | 'hostId' | 'source' | 'sourceUrl'>,
  occurrences: number,
  intervalDays: number,
): Promise<number> {
  if (!baseFields.startsAt || occurrences < 1) return 0;
  const baseStart = new Date(baseFields.startsAt);
  let created = 0;
  for (let i = 0; i < occurrences; i++) {
    const startsAt = new Date(baseStart);
    startsAt.setDate(startsAt.getDate() + intervalDays * i);
    const result = await createEvent(hostId, { ...baseFields, startsAt: startsAt.toISOString() });
    if (result) created += 1;
  }
  return created;
}
