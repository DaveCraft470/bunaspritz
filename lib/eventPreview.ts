import type { SpritzEvent } from '@/constants/events';
import type * as ImagePicker from 'expo-image-picker';
import type { EventDrink } from '@/lib/drinks';
import type { SongCatalogItem } from '@/lib/music';

export type EventPreviewDraft = {
  mode: 'create' | 'edit';
  eventId?: string;
  title: string;
  detail: string;
  genre: string;
  emoji: string;
  color: string;
  startsAt: string | null;
  entryFeeRon: number | null;
  drinksPriceRon: number | null;
  maxParticipants: number | null;
  lng: number | null;
  lat: number | null;
  locationIsRented: boolean | null;
  rentalProofAttached: boolean;
  rentalProofAsset?: ImagePicker.ImagePickerAsset | null;
  drinks: EventDrink[];
  songs: SongCatalogItem[];
  visibility: 'public' | 'private';
  approvalMode: 'instant' | 'manual';
  isOutdoor?: boolean;
};

let draft: EventPreviewDraft | null = null;

export function setEventPreviewDraft(next: EventPreviewDraft) {
  draft = next;
}

export function getEventPreviewDraft() {
  return draft;
}

export function clearEventPreviewDraft() {
  draft = null;
}

export function previewDraftFromEvent(event: SpritzEvent): EventPreviewDraft {
  return {
    mode: 'edit',
    eventId: event.id,
    title: event.title,
    detail: event.detail,
    genre: event.genre,
    emoji: event.emoji,
    color: event.color,
    startsAt: event.startsAt,
    entryFeeRon: event.entryFeeRon,
    drinksPriceRon: event.drinksPriceRon,
    maxParticipants: event.maxParticipants,
    lng: event.lng,
    lat: event.lat,
    locationIsRented: event.locationIsRented,
    rentalProofAttached: !!event.rentalProofPath,
    drinks: [],
    songs: [],
    visibility: event.visibility,
    approvalMode: event.approvalMode,
    isOutdoor: event.isOutdoor,
  };
}

// Duplicate Event: same field mapping as previewDraftFromEvent, but
// mode: 'create' (no eventId) so new-event.tsx inserts a fresh event
// instead of editing the original — and a past start time resets to null
// (form defaults to "now") rather than pre-filling an already-past date.
export function duplicateDraftFromEvent(event: SpritzEvent): EventPreviewDraft {
  const startsAt = event.startsAt && new Date(event.startsAt).getTime() > Date.now() ? event.startsAt : null;
  return { ...previewDraftFromEvent(event), mode: 'create', eventId: undefined, startsAt, rentalProofAttached: false };
}
