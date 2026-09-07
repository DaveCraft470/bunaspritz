import { MAPBOX_ACCESS_TOKEN } from '@/constants/mapbox';

export type TravelEstimates = { walkingMinutes: number | null; drivingMinutes: number | null };

type Coords = { lat: number; lng: number };

async function fetchDuration(profile: 'walking' | 'driving', from: Coords, to: Coords): Promise<number | null> {
  try {
    const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false&access_token=${MAPBOX_ACCESS_TOKEN}`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const json = await response.json();
    const seconds = json?.routes?.[0]?.duration;
    if (typeof seconds !== 'number') return null;
    return Math.round(seconds / 60);
  } catch {
    return null;
  }
}

// Walking and driving in parallel — either can independently fail (e.g. no
// walkable route found) without taking the other down; a null field just
// means that profile's estimate isn't shown, not an error state.
export async function getTravelEstimates(from: Coords, to: Coords): Promise<TravelEstimates> {
  const [walkingMinutes, drivingMinutes] = await Promise.all([
    fetchDuration('walking', from, to),
    fetchDuration('driving', from, to),
  ]);
  return { walkingMinutes, drivingMinutes };
}
