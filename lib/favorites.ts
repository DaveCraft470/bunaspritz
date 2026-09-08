import { supabase } from '@/lib/supabase';

// Favorite Categories — public (any signed-in user can read another's, used
// for Common Interests + Event Matching), writable only by the owner.
export async function getFavoriteCategories(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from('favorite_categories').select('category').eq('user_id', userId);
  if (error) {
    console.error('[favorites] getFavoriteCategories failed', error);
    return [];
  }
  return data.map((row) => row.category);
}

export async function getFavoriteCategoriesFor(userIds: string[]): Promise<Record<string, string[]>> {
  if (!userIds.length) return {};
  const { data, error } = await supabase.from('favorite_categories').select('user_id, category').in('user_id', userIds);
  if (error) {
    console.error('[favorites] getFavoriteCategoriesFor failed', error);
    return {};
  }
  const result: Record<string, string[]> = {};
  data.forEach((row) => {
    (result[row.user_id] ??= []).push(row.category);
  });
  return result;
}

export async function addFavoriteCategory(userId: string, category: string): Promise<boolean> {
  const { error } = await supabase.from('favorite_categories').insert({ user_id: userId, category });
  if (error && error.code !== '23505') console.error('[favorites] addFavoriteCategory failed', error);
  return !error || error.code === '23505';
}

export async function removeFavoriteCategory(userId: string, category: string): Promise<boolean> {
  const { error } = await supabase.from('favorite_categories').delete().eq('user_id', userId).eq('category', category);
  if (error) console.error('[favorites] removeFavoriteCategory failed', error);
  return !error;
}

// Favorite Locations — private (a saved point can be a home/work address).
export type FavoriteLocation = { id: string; userId: string; label: string; lat: number; lng: number };

export async function getFavoriteLocations(userId: string): Promise<FavoriteLocation[]> {
  const { data, error } = await supabase
    .from('favorite_locations')
    .select('id, user_id, label, lat, lng')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) {
    console.error('[favorites] getFavoriteLocations failed', error);
    return [];
  }
  return data.map((row) => ({ id: row.id, userId: row.user_id, label: row.label, lat: row.lat, lng: row.lng }));
}

export async function addFavoriteLocation(userId: string, label: string, lat: number, lng: number): Promise<boolean> {
  const { error } = await supabase.from('favorite_locations').insert({ user_id: userId, label, lat, lng });
  if (error) console.error('[favorites] addFavoriteLocation failed', error);
  return !error;
}

export async function removeFavoriteLocation(locationId: string): Promise<boolean> {
  const { error } = await supabase.from('favorite_locations').delete().eq('id', locationId);
  if (error) console.error('[favorites] removeFavoriteLocation failed', error);
  return !error;
}
