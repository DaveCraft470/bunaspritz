import { Platform, Share } from 'react-native';
import { SpritzEvent } from '@/constants/events';

// The app.json "scheme" — bunaspritz://event/[id] and bunaspritz://user/[id]
// map straight onto expo-router's file-based routes (app/event/[id].tsx,
// app/user/[id].tsx), no linking config needed beyond the scheme itself.
const APP_SCHEME = 'bunaspritz';

export function buildEventDeepLink(eventId: string): string {
  return `${APP_SCHEME}://event/${eventId}`;
}

export function buildProfileDeepLink(userId: string): string {
  return `${APP_SCHEME}://user/${userId}`;
}

// A public, keyless QR image generator (api.qrserver.com) — same "free,
// no signup" bar as lib/weather.ts's Open-Meteo choice. Renders straight
// into an <Image>, no QR-generation library/native module needed.
export function buildQrCodeUrl(data: string, size = 240): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
}

// Shareable Event Card — react-native's built-in Share API needs no extra
// dependency (unlike an image-based card, which would need a native
// screenshot module this project doesn't have installed). The dialog itself
// is the "card": whatever app the user shares to renders the link's own
// preview.
export async function shareEvent(event: SpritzEvent): Promise<void> {
  const link = buildEventDeepLink(event.id);
  const when = event.startsAt ? new Date(event.startsAt).toLocaleString('ro-RO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
  const message = `${event.emoji} ${event.title}${when ? ` · ${when}` : ''}\n${link}`;
  try {
    await Share.share(Platform.OS === 'ios' ? { message, url: link } : { message });
  } catch {
    // User-cancelled or share sheet unavailable — nothing to recover from.
  }
}

export async function shareProfile(userId: string, name: string): Promise<void> {
  const link = buildProfileDeepLink(userId);
  const message = `${name} pe Spritz\n${link}`;
  try {
    await Share.share(Platform.OS === 'ios' ? { message, url: link } : { message });
  } catch {
    // Same as shareEvent.
  }
}
