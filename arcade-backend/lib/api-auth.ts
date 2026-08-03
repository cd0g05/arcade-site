/**
 * Route-level auth + error mapping for the HTTP layer (tasks.md id:40).
 *
 * Two independent auth modes, per tech-design.md "Security":
 *   - user session  — Auth.js cookie, verified server-side per request
 *   - service key   — static `BOT_API_KEY` in an `Authorization` header, constant-time
 *                     compared (the comparison itself lives in lib/auth.ts)
 *
 * `/api/scores/submit` is the one route that accepts either.
 */
import { eq } from 'drizzle-orm';
import { ZodError } from 'zod';
import { auth } from './auth';
import { isValidBotApiKey } from './bot-key';
import { db } from './db/client';
import { users } from './db/schema';
import { corsHeaders } from './cors';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(typeof body === 'object' && body && 'error' in body ? String(body.error) : 'error');
    this.name = 'HttpError';
  }
}

export const unauthorized = () => new HttpError(401, { error: 'unauthorized' });
export const notFound = (error = 'not_found') => new HttpError(404, { error });

/**
 * Extracts the key from `Authorization: Bearer <key>` (also tolerating a bare key, since
 * the bot is written separately and the contract doc is the only thing keeping the two
 * sides in sync).
 */
function extractKey(req: Request): string | null {
  const header = req.headers.get('authorization');
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1] : header;
}

/** True when the request carries a valid service API key. */
export function hasBotKey(req: Request): boolean {
  return isValidBotApiKey(extractKey(req));
}

/** Throws 401 unless the request carries a valid service API key. Bot-only routes. */
export function requireBotKey(req: Request): void {
  if (!hasBotKey(req)) throw unauthorized();
}

export interface SessionUser {
  userId: string;
  isAdmin: boolean;
}

/** Throws 401 unless a valid user session is present. */
export async function requireSession(): Promise<SessionUser> {
  const session = await auth();
  const user = session?.user as { id?: string; isAdmin?: boolean } | undefined;
  if (!user?.id) throw unauthorized();
  return { userId: user.id, isAdmin: user.isAdmin ?? false };
}

/**
 * Resolves a Discord ID to a linked account, or throws 404.
 * The bot knows its users by Discord ID only; linking is optional (schema: nullable
 * `users.discord_id`), so "no linked account" is an expected outcome, not an error state.
 */
export async function resolveDiscordId(discordId: string) {
  const [user] = await db.select().from(users).where(eq(users.discordId, discordId));
  if (!user) throw notFound('unknown_discord_id');
  return user;
}

/**
 * Vercel cron auth for `/api/cron/settle-daily` (tasks.md id:53).
 * Vercel sends `Authorization: Bearer $CRON_SECRET`; the service API key is also accepted
 * so the settle can be triggered manually during testing without a second credential.
 */
export function requireCronAuth(req: Request): void {
  const provided = extractKey(req);
  const secret = process.env.CRON_SECRET;
  if (secret && provided && provided.length === secret.length) {
    let mismatch = 0;
    for (let i = 0; i < secret.length; i++) {
      mismatch |= provided.charCodeAt(i) ^ secret.charCodeAt(i);
    }
    if (mismatch === 0) return;
  }
  if (hasBotKey(req)) return;
  throw unauthorized();
}

/**
 * Single error boundary for every route (tech-design.md "Error Handling Pattern").
 *
 * ZodError -> 400, typed HttpError -> its own status, anything else -> logged 500. Domain
 * errors from lib/ (InsufficientBalanceError, UnknownGameError, ...) are mapped by their
 * own handlers before reaching here, since their status codes are route-specific.
 */
export async function handle(
  req: Request,
  fn: () => Promise<Response>,
): Promise<Response> {
  const headers = corsHeaders(req.headers.get('origin'));
  try {
    const res = await fn();
    for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
    return res;
  } catch (e) {
    if (e instanceof ZodError) {
      return Response.json(
        { error: 'invalid_request', issues: e.issues },
        { status: 400, headers },
      );
    }
    if (e instanceof HttpError) {
      return Response.json(e.body, { status: e.status, headers });
    }
    // Never swallowed: unmapped failures are logged and surfaced as an opaque 500 so no
    // internal detail leaks to the caller.
    console.error('[api] unhandled error', e);
    return Response.json({ error: 'internal_error' }, { status: 500, headers });
  }
}

/** Parses a JSON body, turning a malformed one into a 400 rather than a 500. */
export async function jsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, { error: 'invalid_json' });
  }
}
