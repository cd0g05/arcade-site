import { eq } from 'drizzle-orm';
import {
  handle,
  hasBotKey,
  jsonBody,
  requireSession,
  resolveDiscordId,
  notFound,
  HttpError,
} from '@/lib/api-auth';
import { ScoreSubmitRequestSchema } from '@/lib/api-schemas';
import { handlePreflight } from '@/lib/cors';
import { db } from '@/lib/db/client';
import { bounties, games, users } from '@/lib/db/schema';
import { evaluateScoreSubmission } from '@/lib/achievements';
import { dayBucket, submitDailyScore } from '@/lib/leaderboard';
import type { AwardResult } from '@/lib/ledger';

/**
 * POST /api/scores/submit — tasks.md id:43.
 *
 * The one route accepting either auth mode. The two paths differ in *who they trust to
 * name the user*: a session request is always the session's own user (a `userId` in the
 * body is ignored, so a logged-in user cannot submit scores as someone else), while a
 * service-key request must name its subject, since the bot acts on behalf of Discord users.
 */
/**
 * Opens the "bounty awaiting Carter's input" state (FR-6.3).
 *
 * Partition 2's `computeDailyLeaderboard()` documents a bounty row that "can exist with a
 * null amount — created when Carter posts a score, filled in when he answers the bot's
 * prompt", but nothing created that row: this is its writer, and it is what makes
 * `GET /api/bounty/pending` answerable at all.
 *
 * Admin-only because FR-6.3's bounty is specifically Carter's score to beat. The insert is
 * ON CONFLICT DO NOTHING so a re-submitted score never clears an amount he already set.
 */
async function openPendingBountyIfAdmin(userId: string, gameId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user?.isAdmin) return;

  await db
    .insert(bounties)
    .values({ gameId, gameDate: dayBucket(), amount: null })
    .onConflictDoNothing({ target: [bounties.gameId, bounties.gameDate] });
}

export async function POST(req: Request) {
  return handle(req, async () => {
    const isBot = hasBotKey(req);
    const body = ScoreSubmitRequestSchema.parse(await jsonBody(req));

    let userId: string;
    if (isBot) {
      if (body.discordId) {
        userId = (await resolveDiscordId(body.discordId)).id;
      } else if (body.userId) {
        // Checked rather than trusted: a well-formed but unknown uuid would otherwise
        // surface as a foreign-key violation on the ledger write, i.e. a 500 for what is
        // really a bad request.
        const [user] = await db.select().from(users).where(eq(users.id, body.userId));
        if (!user) throw notFound('unknown_user');
        userId = user.id;
      } else {
        throw new HttpError(400, { error: 'discord_id_or_user_id_required' });
      }
    } else {
      ({ userId } = await requireSession());
    }

    // evaluateScoreSubmission() tolerates an unknown game (it falls back to the slug as a
    // display name), so the roster check has to happen here for the contract's 400.
    const [game] = await db.select().from(games).where(eq(games.id, body.gameId));
    if (!game) throw new HttpError(400, { error: 'unknown_game' });

    const awards: AwardResult[] = [];

    // Daily participation first, so its award reads before achievement awards in the
    // response — matching the order the UX toasts them.
    if (body.isDailySubmission) {
      awards.push(
        ...(await submitDailyScore({
          userId,
          gameId: body.gameId,
          score: body.score,
          submittedVia: isBot ? 'bot' : 'site',
        })),
      );
      await openPendingBountyIfAdmin(userId, body.gameId);
    }

    awards.push(
      ...(await evaluateScoreSubmission({
        userId,
        gameId: body.gameId,
        score: body.score,
        isDailySubmission: body.isDailySubmission,
      })),
    );

    return Response.json({ recorded: true, awards });
  });
}

export const OPTIONS = handlePreflight;
