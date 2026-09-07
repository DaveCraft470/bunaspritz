import { Platform } from 'react-native';

// Giphy SDK keys are meant to be client-embedded (there's no server-side
// secret involved), so a literal fallback here follows the same idiom as
// lib/supabase.ts's SUPABASE_URL/SUPABASE_ANON_KEY — EXPO_PUBLIC_* still
// overrides it per-environment if the user ever wants to rotate a key
// without a code change.
const GIPHY_KEYS = {
  ios: process.env.EXPO_PUBLIC_GIPHY_KEY_IOS || 'RpiR9EviPsF4fwkukepo2j0aunmkzJM9',
  android: process.env.EXPO_PUBLIC_GIPHY_KEY_ANDROID || 'br5lxJTbrKrxARGRZT757shK8RflEmcZ',
  web: process.env.EXPO_PUBLIC_GIPHY_KEY_WEB || 'dt3FnXgqLi49RT7u6eHiib028wCT1hre',
};

const GIPHY_API_KEY = Platform.select({ ios: GIPHY_KEYS.ios, android: GIPHY_KEYS.android, default: GIPHY_KEYS.web });

const GIPHY_BASE_URL = 'https://api.giphy.com/v1/gifs';

export type GifResult = {
  id: string;
  previewUrl: string;
  fullUrl: string;
};

type GiphyApiImage = { url: string; width: string; height: string };
type GiphyApiGif = { id: string; images: { fixed_width: GiphyApiImage; original: GiphyApiImage } };

function mapGif(gif: GiphyApiGif): GifResult {
  return {
    id: gif.id,
    previewUrl: gif.images.fixed_width.url,
    fullUrl: gif.images.original.url,
  };
}

async function fetchGifs(url: string): Promise<GifResult[]> {
  try {
    const response = await fetch(url);
    if (!response.ok) return [];
    const body = await response.json();
    return ((body.data ?? []) as GiphyApiGif[]).map(mapGif);
  } catch {
    return [];
  }
}

export function getTrendingGifs(limit = 24): Promise<GifResult[]> {
  return fetchGifs(`${GIPHY_BASE_URL}/trending?api_key=${GIPHY_API_KEY}&limit=${limit}&rating=pg-13`);
}

export function searchGifs(query: string, limit = 24): Promise<GifResult[]> {
  if (!query.trim()) return getTrendingGifs(limit);
  return fetchGifs(
    `${GIPHY_BASE_URL}/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=${limit}&rating=pg-13`
  );
}
