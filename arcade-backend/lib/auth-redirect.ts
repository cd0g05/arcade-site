/**
 * auth-redirect.ts — where a user lands after signing in or out.
 *
 * Extracted from the Auth.js config in lib/auth.ts rather than written inline, for the
 * reason recorded in tasks.md id:73: `next-auth` cannot be imported under vitest's node
 * environment at all (it fails to resolve `next/server`), so anything living inside the
 * NextAuth() call is effectively untestable. This is a pure function over two strings.
 */
import { isAllowedOrigin } from './cors';

/**
 * Resolve the post-auth destination.
 *
 * Two things make the Auth.js default wrong for this deployment:
 *
 * 1. Its fallback is `baseUrl`, the host root — but this service is mounted entirely
 *    under `/arcade`, so the root is a 404. Anyone signing in without an explicit
 *    callbackUrl lands on a blank error page.
 * 2. Its same-origin check rejects the arcade site, which is a *different* origin
 *    (arcade.cartercripe.com vs dev.cartercripe.com). Players signing in from the arcade
 *    would be bounced to this host instead of back to the game.
 *
 * Cross-origin returns are allow-listed, never reflected — an unchecked `callbackUrl` is
 * a textbook open redirect, and this one is reachable pre-authentication. The allow-list
 * is the CORS one so there is a single notion of "origins we trust" rather than two that
 * drift apart.
 */
export function resolveRedirect(url: string, baseUrl: string): string {
  const base = new URL(baseUrl);
  // The only surface on this host worth landing on: /arcade is a deliberate stub and
  // /arcade/api/* is not for humans. Non-admins get bounced by the guard, which is the
  // correct answer for them anyway.
  const fallback = new URL('/arcade/admin', base).toString();

  // Relative callback — stays on this host by construction.
  if (url.startsWith('/')) {
    return url === '/' ? fallback : new URL(url, base).toString();
  }

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return fallback;
  }

  if (isAllowedOrigin(target.origin)) return target.toString();

  if (target.origin === base.origin) {
    // Same host, but the root is that 404 again.
    return target.pathname === '/' ? fallback : target.toString();
  }

  return fallback;
}
