import { PublicUser } from '@/contexts/auth';

// Development-only switch. This is not authorization and must be replaced by
// a backend role/RLS check before an admin panel is enabled in production.
export const DEV_ADMIN_ACCESS_ENABLED = true;

export function isAdminAccessEnabled(user: PublicUser | null): boolean {
  return __DEV__ && DEV_ADMIN_ACCESS_ENABLED && user !== null;
}
