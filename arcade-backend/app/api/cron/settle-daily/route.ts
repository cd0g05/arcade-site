import { and, eq } from 'drizzle-orm';
import { handle, requireCronAuth, HttpError } from '@/lib/api-auth';
import { SettleDailyRequestSchema } from '@/lib/api-schemas';
import { db } from '@/lib/db/client';
import { dailyTopScoreSettlements, games } from '@/lib/db/schema';
import { dayBucket, settleDailyTopScore } from '@/lib/leaderboard';

/**
 * POST /api/cron/settle-daily — tasks.md id:53. Auth: Vercel cron secret or service key.
 *
 * The trigger for the daily top-score award (Builder decision, 2026-07-25). Partition 2
 * left `settleDailyTopScore()` with no caller by design: it is one-shot per game/day by
 * DB constraint, so whoever leads at the first successful call keeps the award. That makes
 * *when* it runs a correctness property, not a scheduling detail — it must run only after
 * the day has closed.
 *
 * Hence the default target is **yesterday**, not today. A cron firing just after midnight
 * settles the day that just ended; passing `gameDate` explicitly is for backfill and tests.
 *
 * Exposed as both GET and POST: Vercel Cron invokes the path with a **GET**, while manual
 * or bot-triggered backfills are more naturally a POST with a body. `gameDate` is read
 * from the query string on GET and the JSON body on POST.
 *
 * No CORS handling: this is never called from a browser.
 */
async function settleDaily(req: Request) {
  return handle(req, async () => {
    requireCronAuth(req);

    const url = new URL(req.url);
    const raw = req.method === 'POST' ? await req.text() : '';

    let parsed: unknown;
    if (raw) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        // Bare JSON.parse would throw a SyntaxError straight past the ZodError branch
        // and surface as a 500 for what is plainly a malformed request.
        throw new HttpError(400, { error: 'invalid_json' });
      }
    } else {
      parsed = { gameDate: url.searchParams.get('gameDate') ?? undefined };
    }
    const body = SettleDailyRequestSchema.parse(parsed);

    // Server-local time, matching lib/leaderboard.ts `dayBucket()` — on Vercel that is
    // UTC, so the cron schedule below is expressed in UTC too and the two agree.
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const gameDate = body.gameDate ?? dayBucket(yesterday);

    const daily = await db.select().from(games).where(eq(games.isDaily, true));

    const results: Array<{
      gameId: string;
      status: 'settled' | 'already_settled' | 'no_award';
      amount?: number;
      reason?: string;
    }> = [];

    // Sequential rather than Promise.all: each neon-http query is its own HTTPS round
    // trip, and the spike measured per-query latency degrading sharply under wide
    // concurrency. The daily roster is small and this runs off the request hot path.
    for (const game of daily) {
      const [existing] = await db
        .select()
        .from(dailyTopScoreSettlements)
        .where(
          and(
            eq(dailyTopScoreSettlements.gameId, game.id),
            eq(dailyTopScoreSettlements.gameDate, gameDate),
          ),
        );

      // Checked up front so a repeat run can report "already settled" distinctly.
      // settleDailyTopScore() returns null for both "already settled" and "nobody
      // qualified", which is the right shape for its callers but too coarse for an
      // operator reading cron output.
      if (existing) {
        results.push({ gameId: game.id, status: 'already_settled' });
        continue;
      }

      const award = await settleDailyTopScore(game.id, gameDate);
      results.push(
        award
          ? {
              gameId: game.id,
              status: 'settled',
              amount: award.amount,
              reason: award.reason,
            }
          : { gameId: game.id, status: 'no_award' },
      );
    }

    return Response.json({ ok: true, gameDate, results });
  });
}

export const GET = settleDaily;
export const POST = settleDaily;
