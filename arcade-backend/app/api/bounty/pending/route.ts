import { and, eq, isNull } from 'drizzle-orm';
import { handle, requireBotKey } from '@/lib/api-auth';
import { BountyPendingQuerySchema } from '@/lib/api-schemas';
import { handlePreflight } from '@/lib/cors';
import { db } from '@/lib/db/client';
import { bounties } from '@/lib/db/schema';
import { dayBucket } from '@/lib/leaderboard';

/**
 * GET /api/bounty/pending?gameId=&date= — tasks.md id:44. Auth: service API key only.
 *
 * "Pending" means *awaiting Carter's input* (PRD FR-6.1), not "an unclaimed bounty exists":
 * a row with a null `amount`, opened when he posts his own daily score and filled in when
 * he answers the bot's DM prompt. Once `amount` is set the bounty is no longer pending —
 * the bot has its number and posts the public "Beat Carter's score" message.
 */
export async function GET(req: Request) {
  return handle(req, async () => {
    requireBotKey(req);

    const url = new URL(req.url);
    const query = BountyPendingQuerySchema.parse({
      gameId: url.searchParams.get('gameId') ?? undefined,
      date: url.searchParams.get('date') ?? undefined,
    });
    const gameDate = query.date ?? dayBucket();

    const [row] = await db
      .select()
      .from(bounties)
      .where(
        and(
          eq(bounties.gameId, query.gameId),
          eq(bounties.gameDate, gameDate),
          isNull(bounties.amount),
        ),
      );

    if (!row) return Response.json({ pending: false });
    return Response.json({ pending: true, gameId: query.gameId, gameDate });
  });
}

export const OPTIONS = handlePreflight;
