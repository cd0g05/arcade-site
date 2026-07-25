/**
 * Service-to-service auth for the Discord bot (FR-6.1/6.2) — a static API key compared in
 * constant time, not a user session. Applied only to bot-relevant routes
 * (scores/submit, bounty/*, users/by-discord-id).
 *
 * Deliberately kept out of lib/auth.ts: this shares no machinery with Auth.js, and pulling
 * `next-auth` in just to compare two strings made the check untestable outside a Next.js
 * runtime (`next-auth` fails to resolve `next/server` under a plain node test env).
 */

/**
 * Constant-time comparison. A plain `===` leaks key material through timing — it returns
 * on the first differing byte, so response time correlates with how many leading bytes an
 * attacker guessed right, making the key brute-forceable one byte at a time.
 *
 * The length check is not constant-time, but key length is not the secret.
 */
export function isValidBotApiKey(providedKey: string | null): boolean {
  const expected = process.env.BOT_API_KEY;
  if (!expected || !providedKey) return false;
  if (providedKey.length !== expected.length) return false;

  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= providedKey.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}
