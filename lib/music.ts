const DEEZER_API_BASE = 'https://api.deezer.com';
const QUERY_CACHE = new Map<string, SongCatalogItem[]>();
const REQUEST_TIMEOUT_MS = 7000;

export type SongCatalogItem = {
  id: string;
  title: string;
  artist: string;
  artists?: string[];
  album?: string;
  coverUrl?: string;
  previewUrl?: string;
  trackUrl?: string;
  durationMs?: number;
  year?: number;
  isExplicit?: boolean;
  source: 'deezer' | 'manual';
};

type DeezerTrack = {
  id?: number;
  title?: string;
  artist?: { name?: string };
  album?: { title?: string; cover_medium?: string; cover_big?: string; cover_xl?: string };
  cover_medium?: string;
  cover_big?: string;
  cover_xl?: string;
  preview?: string;
  link?: string;
  duration?: number;
  explicit_lyrics?: boolean;
  release_date?: string;
};

type DeezerSearchResponse = { data?: DeezerTrack[] };

export async function searchMusic(query: string): Promise<SongCatalogItem[]> {
  const normalized = normalize(query);
  if (normalized.length < 2) return [];
  const cached = QUERY_CACHE.get(normalized);
  if (cached) return cached;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${DEEZER_API_BASE}/search?q=${encodeURIComponent(query.trim())}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Deezer search request failed (${response.status})`);
    const payload = (await response.json()) as DeezerSearchResponse;
    if (!Array.isArray(payload.data)) throw new Error('Deezer search returned invalid results');
    const songs = dedupeSongs(payload.data.map(normalizeDeezerResult).filter((song): song is SongCatalogItem => !!song)).slice(0, 25);
    QUERY_CACHE.set(normalized, songs);
    return songs;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw new Error('Deezer search timed out');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function normalizeDeezerResult(result: DeezerTrack): SongCatalogItem | null {
  const title = result.title?.trim();
  const artist = result.artist?.name?.trim();
  if (!title || result.id == null || !artist) return null;
  return {
    id: String(result.id),
    title,
    artist,
    artists: [artist],
    album: result.album?.title?.trim() || undefined,
    coverUrl: result.album?.cover_xl || result.album?.cover_big || result.album?.cover_medium || result.cover_xl || result.cover_big || result.cover_medium,
    previewUrl: result.preview || undefined,
    trackUrl: result.link || undefined,
    durationMs: typeof result.duration === 'number' ? result.duration * 1000 : undefined,
    year: parseYear(result.release_date),
    isExplicit: result.explicit_lyrics,
    source: 'deezer',
  };
}

export function getMusicCover(song: SongCatalogItem) {
  return song.coverUrl;
}

export function clearMusicSearchCache() {
  QUERY_CACHE.clear();
}

function dedupeSongs(songs: SongCatalogItem[]) {
  const seen = new Set<string>();
  return songs.filter((song) => {
    if (seen.has(song.id)) return false;
    seen.add(song.id);
    return true;
  });
}

function normalize(value: string) {
  return value.toLocaleLowerCase('ro-RO').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}

function parseYear(value?: string | null) {
  const match = String(value ?? '').match(/\d{4}/);
  return match ? Number(match[0]) : undefined;
}

const eventSongs = new Map<string, SongCatalogItem[]>();

export function getEventSongs(eventId: string) {
  return eventSongs.get(eventId) ?? [];
}

export function setEventSongs(eventId: string, songs: SongCatalogItem[]) {
  eventSongs.set(eventId, songs.map((song) => ({ ...song })));
}

export function addManualSong(title: string, artist: string, album?: string): SongCatalogItem | null {
  if (!title.trim() || !artist.trim()) return null;
  return { id: `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`, title: title.trim(), artist: artist.trim(), album: album?.trim() || undefined, source: 'manual' };
}
