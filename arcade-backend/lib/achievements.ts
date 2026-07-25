import { and, eq, sql } from 'drizzle-orm';
import { db } from './db/client';
import { achievements, achievementAwards, games, highScores } from './db/schema';
import { awardAchievement, writeTransaction, type AwardResult } from './ledger';

/**
 * Achievement evaluation (PRD FR-3.1/FR-3.2, ADR-3/ADR-5).
 *
 * This is the single entry point both the site and the Discord bot score-submission
 * paths call — see tech-design.md "Interface Contracts". It is deliberately the only
 * place that reasons about high-score progression, so the two submission paths cannot
 * drift.
 */

export interface EvaluateScoreInput {
  userId: string;
  gameId: string;
  score: number;
  isDailySubmission: boolean;
}

/**
 * Records a score, updates the user's high score, and returns the awards it triggered.
 *
 * Two achievement modes (both configured per-game in the admin builder, FR-5.2):
 *
 * - **threshold**: award once, the first time the score crosses a fixed value.
 * - **interval_gap**: award each time the score exceeds `last_awarded_high_score + gap`.
 *   Per ADR-5 the comparison is against the last *awarded* score, not the current high
 *   score, which is what makes the PRD's worked example correct — after an award at 1000
 *   with gap 100, a 1050 updates the displayed high score but awards nothing, and only
 *   1100 fires the next award.
 *
 * Idempotency is the database's job, not this function's (ADR-3): every award goes through
 * `awardAchievement()`, whose unique `(user_id, achievement_id)` constraint makes a
 * retried submission a no-op. This function may therefore be called twice with identical
 * input — e.g. the bot resending after a timeout — without double-awarding.
 *
 * `isDailySubmission` is accepted for interface parity with the documented contract, but
 * daily-leaderboard awards are `lib/leaderboard.ts`'s responsibility; the score-submission
 * route calls both. It is not used here.
 */
export async function evaluateScoreSubmission(
  input: EvaluateScoreInput,
): Promise<AwardResult[]> {
  const { userId, gameId, score } = input;

  const existing = await db
    .select()
    .from(highScores)
    .where(and(eq(highScores.userId, userId), eq(highScores.gameId, gameId)));
  const prior = existing[0];

  // Only the personal best matters for achievements; a lower score still counts as a
  // play but can never cross a threshold the stored high score has already passed.
  const previousHigh = prior?.currentHighScore ?? 0;
  const lastAwardedHigh = prior?.lastAwardedHighScore ?? 0;
  const isNewPersonalBest = score > previousHigh;

  const configured = await db
    .select()
    .from(achievements)
    .where(and(eq(achievements.gameId, gameId), eq(achievements.active, true)));

  const [game] = await db.select().from(games).where(eq(games.id, gameId));
  const gameName = game?.displayName ?? gameId;

  const awards: AwardResult[] = [];
  // Tracks interval_gap progress across this single evaluation so that one submission
  // clearing several gap multiples at once awards each of them exactly once, and the
  // stored watermark ends up at the highest bar actually cleared.
  let awardedWatermark = lastAwardedHigh;

  for (const achievement of configured) {
    if (achievement.mode === 'threshold') {
      if (score < achievement.value) continue;
      const { awarded } = await awardAchievement({
        userId,
        achievementId: achievement.id,
        amount: achievement.award,
        reason: `High Score: ${gameName}`,
      });
      if (awarded) {
        awards.push({
          amount: achievement.award,
          reason: `High Score: ${gameName}`,
          source: 'achievement',
        });
      }
      continue;
    }

    // interval_gap
    const gap = achievement.value;
    if (gap <= 0) continue; // misconfigured; a zero/negative gap would award unboundedly
    if (score < awardedWatermark + gap) continue;

    // An interval_gap achievement is repeatable, so it cannot rely on the one-row-per
    // (user, achievement) constraint that guards threshold awards. The watermark in
    // high_scores is what prevents re-awarding, and it is advanced below in the same
    // conditional UPDATE that guards against a concurrent duplicate submission.
    const steps = Math.floor((score - awardedWatermark) / gap);
    const newWatermark = awardedWatermark + steps * gap;

    const advanced = await advanceAwardedWatermark({
      userId,
      gameId,
      from: awardedWatermark,
      to: newWatermark,
      hadRow: Boolean(prior),
      currentHighScore: Math.max(score, previousHigh),
    });
    if (!advanced) continue; // a concurrent submission already claimed this interval

    for (let i = 0; i < steps; i++) {
      await writeIntervalGapAward({
        userId,
        amount: achievement.award,
        reason: `High Score: ${gameName}`,
      });
      awards.push({
        amount: achievement.award,
        reason: `High Score: ${gameName}`,
        source: 'achievement',
      });
    }
    awardedWatermark = newWatermark;
  }

  await upsertHighScore({
    userId,
    gameId,
    score,
    isNewPersonalBest,
    previousHigh,
    hadRow: Boolean(prior),
  });

  return awards;
}

/**
 * Advances `high_scores.last_awarded_high_score` from an expected value to a new one,
 * returning false if it no longer held the expected value.
 *
 * This compare-and-set is the concurrency guard for repeatable interval_gap awards: two
 * simultaneous submissions of the same score both compute the same target, but only one
 * UPDATE matches `last_awarded_high_score = from`, so only one proceeds to award.
 */
async function advanceAwardedWatermark(input: {
  userId: string;
  gameId: string;
  from: number;
  to: number;
  hadRow: boolean;
  currentHighScore: number;
}): Promise<boolean> {
  if (!input.hadRow) {
    // No row yet — create it already carrying the new watermark. A concurrent caller
    // racing to do the same loses on the (user_id, game_id) primary key.
    const inserted = await db
      .insert(highScores)
      .values({
        userId: input.userId,
        gameId: input.gameId,
        currentHighScore: input.currentHighScore,
        lastAwardedHighScore: input.to,
      })
      .onConflictDoNothing()
      .returning();
    return inserted.length > 0;
  }

  const updated = await db
    .update(highScores)
    .set({ lastAwardedHighScore: input.to, updatedAt: new Date() })
    .where(
      and(
        eq(highScores.userId, input.userId),
        eq(highScores.gameId, input.gameId),
        eq(highScores.lastAwardedHighScore, input.from),
      ),
    )
    .returning();
  return updated.length > 0;
}

/**
 * Ledger write for a repeatable interval_gap award.
 *
 * Unlike threshold awards this intentionally does NOT insert an `achievement_awards` row:
 * that table's unique `(user_id, achievement_id)` constraint encodes "once ever", which is
 * correct for threshold achievements and wrong for gap achievements that fire repeatedly.
 * The watermark compare-and-set in advanceAwardedWatermark() provides the guarantee here.
 */
async function writeIntervalGapAward(input: {
  userId: string;
  amount: number;
  reason: string;
}): Promise<void> {
  await writeTransaction({
    userId: input.userId,
    amount: input.amount,
    reason: input.reason,
    source: 'achievement',
  });
}

/**
 * Upserts the user's current high score. Never lowers it — a worse score after a personal
 * best is still a play, but the stored best stands. Leaves `last_awarded_high_score`
 * untouched (ADR-5); only an actual award advances that.
 */
async function upsertHighScore(input: {
  userId: string;
  gameId: string;
  score: number;
  isNewPersonalBest: boolean;
  previousHigh: number;
  hadRow: boolean;
}): Promise<void> {
  if (!input.hadRow) {
    await db
      .insert(highScores)
      .values({
        userId: input.userId,
        gameId: input.gameId,
        currentHighScore: input.score,
        lastAwardedHighScore: 0,
      })
      .onConflictDoUpdate({
        target: [highScores.userId, highScores.gameId],
        set: {
          currentHighScore: sql`greatest(${highScores.currentHighScore}, ${input.score})`,
          updatedAt: new Date(),
        },
      });
    return;
  }

  if (!input.isNewPersonalBest) return;

  await db
    .update(highScores)
    .set({
      currentHighScore: sql`greatest(${highScores.currentHighScore}, ${input.score})`,
      updatedAt: new Date(),
    })
    .where(and(eq(highScores.userId, input.userId), eq(highScores.gameId, input.gameId)));
}

/** Reads a user's stored progression for a game. Used by tests and the admin dashboard. */
export async function getHighScore(userId: string, gameId: string) {
  const [row] = await db
    .select()
    .from(highScores)
    .where(and(eq(highScores.userId, userId), eq(highScores.gameId, gameId)));
  return row ?? null;
}

/** Counts granted one-time awards for a user, for assertions and the admin analytics page. */
export async function countAchievementAwards(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(achievementAwards)
    .where(eq(achievementAwards.userId, userId));
  return Number(row?.count ?? 0);
}
