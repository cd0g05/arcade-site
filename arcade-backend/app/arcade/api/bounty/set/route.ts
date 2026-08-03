import { eq } from 'drizzle-orm';
import { handle, jsonBody, requireBotKey, HttpError } from '@/lib/api-auth';
import { BountySetRequestSchema } from '@/lib/api-schemas';
import { handlePreflight } from '@/lib/cors';
import { db } from '@/lib/db/client';
import { bounties, games } from '@/lib/db/schema';

/**
 * POST /api/bounty/set — tasks.md id:45. Auth: service API key only.
 *
 * No user identity is checked beyond the key: per tech-design.md the bot has already
 * verified this is Carter on the Discord side (FR-6.3's DM flow), so the service key is
 * the whole trust boundary here.
 *
 * Upsert rather than insert, because the pending row usually already exists — it was
 * opened when his score came in via /api/scores/submit.
 */
export async function POST(req: Request) {
  return handle(req, async () => {
    requireBotKey(req);
    const body = BountySetRequestSchema.parse(await jsonBody(req));

    const [game] = await db.select().from(games).where(eq(games.id, body.gameId));
    if (!game) throw new HttpError(400, { error: 'unknown_game' });

    await db
      .insert(bounties)
      .values({ gameId: body.gameId, gameDate: body.gameDate, amount: body.amount })
      .onConflictDoUpdate({
        target: [bounties.gameId, bounties.gameDate],
        set: { amount: body.amount },
      });

    return Response.json({ ok: true });
  });
}

export const OPTIONS = handlePreflight;
