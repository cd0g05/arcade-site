import { and, desc, eq } from 'drizzle-orm';
import { db } from './db/client';
import { bounties, dailyLeaderboardEntries, games } from './db/schema';
import {
  DAILY_PARTICIPATION_AWARD,
  settleTopScoreAward,
  writeTransaction,
  type AwardResult,
} from './ledger';

/**
 * Daily-game leaderboard logic (PRD FR-3.3).
 *
 * Three rules, all of which the tests pin down:
 *  1. Any submission earns the participation award (+5), unconditionally.
 *  2. A top-score award requires 2+ *distinct* submitters for that game/day — a solo
 *     player cannot farm the top-score bonus by being the only entrant.
 *  3. The top-score amount comes from that day's bounty if Carter set one, otherwise
 *     `games.default_top_score_award`.
 */

/**
 * The day bucket a submission belongs to, as `YYYY-MM-DD`.
 *
 * PRD FR-3.3 specifies a midnight cutoff. `date` columns carry no timezone, so the bucket
 * is derived once here and passed around as a string, rather than letting each call site
 * re-derive it and risk two different notions of "today" in one request.
 */
export function dayBucket(at: Date = new Date()): string {
  const y = at.getFullYear();
  const m = String(at.getMonth() + 1).padStart(2, '0');
  const d = String(at.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export interface SubmitDailyScoreInput {
  userId: string;
  gameId: string;
  score: number;
  submittedVia: 'site' | 'bot';
  /** Defaults to today's bucket; injectable so tests can exercise specific days. */
  gameDate?: string;
}

/**
 * Records a daily-game score and pays the participation award.
 *
 * Deliberately does NOT settle the top-score award: the winner is only knowable once the
 * day's submissions are in, so that is `computeDailyLeaderboard()`'s job. Splitting them
 * keeps this path cheap on the request hot path.
 */
export async function submitDailyScore(
  input: SubmitDailyScoreInput,
): Promise<AwardResult[]> {
  const gameDate = input.gameDate ?? dayBucket();

  await db.insert(dailyLeaderboardEntries).values({
    userId: input.userId,
    gameId: input.gameId,
    score: input.score,
    submittedVia: input.submittedVia,
    gameDate,
  });

  const [game] = await db.select().from(games).where(eq(games.id, input.gameId));
  const gameName = game?.displayName ?? input.gameId;
  const reason = `Daily Submission: ${gameName}`;

  await writeTransaction({
    userId: input.userId,
    amount: DAILY_PARTICIPATION_AWARD,
    reason,
    source: 'daily_submission',
  });

  return [{ amount: DAILY_PARTICIPATION_AWARD, reason, source: 'daily_submission' }];
}

export interface DailyLeaderboardRow {
  userId: string;
  score: number;
  submittedVia: 'site' | 'bot';
}

export interface DailyLeaderboardResult {
  gameId: string;
  gameDate: string;
  /** Best entry per user, highest score first. */
  standings: DailyLeaderboardRow[];
  distinctSubmitters: number;
  /** Null when the 2+-submitter gate is not met. */
  topScorerUserId: string | null;
  /** The award that would be paid to the top scorer, or null when gated. */
  topScoreAward: number | null;
  /** True when the amount came from a bounty rather than the game default. */
  fromBounty: boolean;
}

/**
 * Computes the standings for one game/day and who (if anyone) has earned the top-score
 * award. Read-only — call `settleDailyTopScore()` to actually pay it.
 */
export async function computeDailyLeaderboard(
  gameId: string,
  gameDate: string = dayBucket(),
): Promise<DailyLeaderboardResult> {
  const entries = await db
    .select()
    .from(dailyLeaderboardEntries)
    .where(
      and(
        eq(dailyLeaderboardEntries.gameId, gameId),
        eq(dailyLeaderboardEntries.gameDate, gameDate),
      ),
    )
    .orderBy(desc(dailyLeaderboardEntries.score));

  // A user may submit several times a day; only their best counts toward standings.
  const bestByUser = new Map<string, DailyLeaderboardRow>();
  for (const entry of entries) {
    const current = bestByUser.get(entry.userId);
    if (!current || entry.score > current.score) {
      bestByUser.set(entry.userId, {
        userId: entry.userId,
        score: entry.score,
        submittedVia: entry.submittedVia,
      });
    }
  }

  const standings = [...bestByUser.values()].sort((a, b) => b.score - a.score);
  const distinctSubmitters = standings.length;

  // FR-3.3: no top-score award unless at least two different people played.
  if (distinctSubmitters < 2) {
    return {
      gameId,
      gameDate,
      standings,
      distinctSubmitters,
      topScorerUserId: null,
      topScoreAward: null,
      fromBounty: false,
    };
  }

  const [bounty] = await db
    .select()
    .from(bounties)
    .where(and(eq(bounties.gameId, gameId), eq(bounties.gameDate, gameDate)));

  const [game] = await db.select().from(games).where(eq(games.id, gameId));

  // A bounty row can exist with a null amount — created when Carter posts a score, filled
  // in when he answers the bot's prompt. Only a set amount overrides the default.
  const fromBounty = bounty?.amount != null;
  const topScoreAward = fromBounty
    ? bounty.amount!
    : (game?.defaultTopScoreAward ?? 10);

  return {
    gameId,
    gameDate,
    standings,
    distinctSubmitters,
    topScorerUserId: standings[0].userId,
    topScoreAward,
    fromBounty,
  };
}

/**
 * Pays the top-score award for a game/day, at most once.
 *
 * IMPORTANT — call this only once the day is closed. Because settlement is deliberately
 * one-shot, whoever leads at the moment of the first successful call keeps the award even
 * if someone posts a better score later that day. That is the correct trade-off for FR-3.3
 * (settlement is a day-end action) but it means the caller owns the timing: a mid-day
 * settle would hand the award to a non-final winner with no way to re-settle.
 *
 * Idempotency comes from the `daily_top_score_settlements` primary key (ADR-3's
 * constraint-first approach), applied uniformly to both the bounty and default-award
 * cases. When a bounty is involved the `bounties.claimed_by_user_id` column is also filled
 * in — but that is bookkeeping for the bot's `GET /api/bounty/pending` view, not the
 * idempotency guard.
 */
export async function settleDailyTopScore(
  gameId: string,
  gameDate: string = dayBucket(),
): Promise<AwardResult | null> {
  const result = await computeDailyLeaderboard(gameId, gameDate);
  if (!result.topScorerUserId || result.topScoreAward == null) return null;

  const [game] = await db.select().from(games).where(eq(games.id, gameId));
  const gameName = game?.displayName ?? gameId;
  const reason = result.fromBounty
    ? `Bounty: ${gameName}`
    : `Top Score: ${gameName}`;
  const source = result.fromBounty ? 'bounty' : 'daily_submission';

  const { settled } = await settleTopScoreAward({
    userId: result.topScorerUserId,
    gameId,
    gameDate,
    amount: result.topScoreAward,
    reason,
    source,
    fromBounty: result.fromBounty,
  });
  if (!settled) return null; // already settled

  if (result.fromBounty) {
    // Bookkeeping for the bot's pending-bounty view. Safe to run after settlement: the
    // settlement row above already guarantees we only get here once.
    await db
      .update(bounties)
      .set({ claimedByUserId: result.topScorerUserId })
      .where(and(eq(bounties.gameId, gameId), eq(bounties.gameDate, gameDate)));
  }

  return { amount: result.topScoreAward, reason, source };
}
