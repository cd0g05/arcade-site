import { auth } from './auth';

export interface AdminSession {
  userId: string;
  displayName: string;
}

/**
 * The `/admin` gate (tasks.md id:60), per the Tech Design Security table.
 *
 * Returns null for anyone who is not an authenticated admin — signed out and signed-in
 * non-admin are deliberately not distinguished to the caller, so the dashboard cannot be
 * used to probe who holds admin. The layout renders a 403 either way.
 *
 * `isAdmin` comes from the Auth.js session callback, which reads it off the `users` row
 * on every request rather than trusting a value baked into a token at sign-in — so
 * revoking admin takes effect on the next request, not the next login.
 */
export async function getAdminSession(): Promise<AdminSession | null> {
  const session = await auth();
  const user = session?.user as
    | { id?: string; isAdmin?: boolean; name?: string }
    | undefined;

  if (!user?.id || !user.isAdmin) return null;
  return { userId: user.id, displayName: user.name ?? 'Admin' };
}
