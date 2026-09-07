import { supabase } from '@/lib/supabase';

// The 9 confirmed Trofee — criteria and copy fixed by the user. Award-
// checking itself is entirely server-side (see award_badges_for_user() in
// the add_badges migration), triggered off the underlying state change
// (check-in, review, event creation, verification) rather than any client
// call site, so this file is purely the display catalog + a reader.
export type BadgeDefinition = {
  id: string;
  emoji: string;
  title: string;
  description: string;
  howTo: string;
};

export const BADGE_DEFINITIONS: BadgeDefinition[] = [
  {
    id: 'primul_pahar',
    emoji: '🥂',
    title: 'Primul Pahar',
    description: 'Ai participat la primul tău eveniment Spritz.',
    howTo: 'Participă și confirmă prezența (check-in) la primul tău eveniment Spritz.',
  },
  {
    id: 'certified_spritzer_minus15',
    emoji: '🍸',
    title: 'Certified Spritzer -15',
    description: 'Ai mers la primul tău spritz.',
    howTo: 'Mergi la primul tău spritz.',
  },
  {
    id: 'pierdut_prin_oras',
    emoji: '🗺️',
    title: 'Pierdut prin Oraș',
    description: 'Ai confirmat prezența la evenimente în 5 locații diferite.',
    howTo: 'Confirmă prezența (check-in) la evenimente în 5 locații diferite.',
  },
  {
    id: 'inspector_de_spritz',
    emoji: '🕵️',
    title: 'Inspector de Spritz',
    description: 'Ai confirmat prezența la evenimente în 10 locații diferite.',
    howTo: 'Confirmă prezența (check-in) la evenimente în 10 locații diferite.',
  },
  {
    id: 'good_vibes',
    emoji: '✨',
    title: 'Good vibes',
    description: 'Ai primit 10 recenzii pozitive.',
    howTo: 'Primește 10 recenzii pozitive (4 stele sau mai mult) de la alți participanți.',
  },
  {
    id: 'main_character',
    emoji: '🎬',
    title: 'Main Character',
    description: 'Ai fost personajul principal al unui spritz.',
    howTo: 'Primește recenzii pozitive de la 5 persoane sau mai multe de la același eveniment.',
  },
  {
    id: 'project_x',
    emoji: '🚀',
    title: 'project X',
    description: 'Ai găzduit primul tău eveniment.',
    howTo: 'Organizează primul tău eveniment.',
  },
  {
    id: 'spritz_boss',
    emoji: '👑',
    title: 'Spritz Boss',
    description: 'Ai găzduit 10 evenimente.',
    howTo: 'Găzduiește 10 evenimente.',
  },
  {
    id: 'identity_verified',
    emoji: '🛡️',
    title: 'Identity Verified',
    description: 'Identitatea ta a fost verificată.',
    howTo: 'Verifică-ți identitatea și vârsta din Setări → Verificare identitate.',
  },
];

export function getBadgeDefinition(badgeId: string): BadgeDefinition | undefined {
  return BADGE_DEFINITIONS.find((badge) => badge.id === badgeId);
}

export type EarnedBadge = {
  badgeId: string;
  earnedAt: string;
  eventId: string | null;
};

export async function getUserBadges(userId: string): Promise<EarnedBadge[]> {
  const { data } = await supabase.from('user_badges').select('badge_id, earned_at, event_id').eq('user_id', userId);
  return (data ?? []).map((row) => ({ badgeId: row.badge_id, earnedAt: row.earned_at, eventId: row.event_id }));
}
