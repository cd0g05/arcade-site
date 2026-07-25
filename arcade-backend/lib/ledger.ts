import { sql, desc, eq } from 'drizzle-orm';
import { db } from './db/client';
import { transactions } from './db/schema';

export type TransactionSource =
  | 'login'
  | 'high_score'
  | 'achievement'
  | 'riddle'
  | 'task'
  | 'daily_submission'
  | 'cabinet_spend'
  | 'admin_adjustment'
  | 'bounty';

export interface AwardResult {
  amount: number; // signed
  reason: string;
  source: TransactionSource;
}

/** Daily login bonus amount (PRD FR-2: +10 per rolling 24h). */
export const DAILY_LOGIN_BONUS = 10;

/** Participation award for any daily-game score submission (PRD FR-3.3: +5, always). */
export const DAILY_PARTICIPATION_AWARD = 5;

/**
 * Row count from a raw `db.execute()`. The neon-http driver returns either an array or a
 * `{ rows }` wrapper depending on the statement, so normalize rather than assuming one.
 * Used by the CTE-based helpers below, where "how many rows came back" is the return
 * signal (0 = the ON CONFLICT / NOT EXISTS guard fired and nothing was written).
 */
function rowCount(result: unknown): number {
  if (Array.isArray(result)) return result.length;
  const rows = (result as { rows?: unknown[] } | null)?.rows;
  return Array.isArray(rows) ? rows.length : 0;
}

export interface WriteTransactionInput {
  userId: string;
  amount: number; // signed — positive for earns, negative for spends
  reason: string;
  source: TransactionSource;
  actorUserId?: string; // set for admin_adjustment
}

/**
 * The ONLY function in this codebase permitted to insert a `transactions` row (ADR-2).
 * Balance is never stored — it is always SUM(amount) over this table, computed in
 * getBalance(). Every earn, spend, and admin adjustment must go through this function
 * so the ledger stays the single source of truth.
 */
export async function writeTransaction(input: WriteTransactionInput) {
  const [row] = await db
    .insert(transactions)
    .values({
      userId: input.userId,
      amount: input.amount,
      reason: input.reason,
      source: input.source,
      actorUserId: input.actorUserId,
    })
    .returning();
  return row;
}

/**
 * Atomically award an achievement: insert the `achievement_awards` row and its paired
 * `transactions` row, or do neither (ADR-3).
 *
 * Implemented as ONE data-modifying-CTE statement rather than `db.transaction()`, which
 * throws on Drizzle's neon-http driver (see tech-design.md "Spike result: Neon pooling
 * under Fluid Compute"). The `ON CONFLICT DO NOTHING` on the unique
 * `(user_id, achievement_id)` constraint short-circuits the whole statement: when the
 * award already exists the CTE yields no rows, so the ledger INSERT's `SELECT ... FROM
 * award` matches nothing and no transaction is written. A retried submission therefore
 * cannot double-award, and the empty result set IS the "already awarded" signal.
 *
 * Lives here, not in lib/achievements.ts, because ADR-2 makes this file the only place
 * permitted to insert `transactions` rows.
 *
 * @returns `awarded: false` when the achievement had already been granted.
 */
export async function awardAchievement(input: {
  userId: string;
  achievementId: string;
  amount: number;
  reason: string;
}): Promise<{ awarded: boolean }> {
  const result = await db.execute(sql`
    WITH award AS (
      INSERT INTO achievement_awards (user_id, achievement_id)
      VALUES (${input.userId}::uuid, ${input.achievementId}::uuid)
      ON CONFLICT (user_id, achievement_id) DO NOTHING
      RETURNING user_id
    )
    INSERT INTO transactions (user_id, amount, reason, source)
    SELECT user_id, ${input.amount}, ${input.reason}, 'achievement'
    FROM award
    RETURNING id
  `);
  return { awarded: rowCount(result) > 0 };
}

/**
 * Atomically record a content completion and its token award (FR-3.4).
 *
 * Same single-statement CTE rationale as awardAchievement(). Once-per-day for
 * riddles/trivia is enforced by the partial unique index
 * `content_completions_once_per_day_uniq` (see schema.ts) — NOT by an application-level
 * "have they done it today?" read, which would race against a double-submit. Tasks pass
 * `oncePerDay: false`, fall outside the partial index, and so award every time.
 *
 * @returns `completed: false` when a riddle/trivia was already completed today.
 */
export async function recordContentCompletion(input: {
  userId: string;
  contentItemId: string;
  answerText: string;
  completedDate: string; // YYYY-MM-DD, caller-supplied day bucket
  oncePerDay: boolean;
  amount: number;
  reason: string;
  source: Extract<TransactionSource, 'riddle' | 'task'>;
}): Promise<{ completed: boolean }> {
  const result = await db.execute(sql`
    WITH completion AS (
      INSERT INTO content_completions
        (user_id, content_item_id, answer_text, completed_date, once_per_day)
      VALUES (
        ${input.userId}::uuid, ${input.contentItemId}::uuid, ${input.answerText},
        ${input.completedDate}::date, ${input.oncePerDay}
      )
      ON CONFLICT DO NOTHING
      RETURNING user_id
    )
    INSERT INTO transactions (user_id, amount, reason, source)
    SELECT user_id, ${input.amount}, ${input.reason}, ${input.source}
    FROM completion
    RETURNING id
  `);
  return { completed: rowCount(result) > 0 };
}

/**
 * Award the daily login bonus (+10 per rolling 24h, FR-2 / tasks id:32).
 *
 * "Rolling 24h, no buildup across inactivity" means: award only if this user has no
 * `login`-source transaction newer than 24 hours ago. A month away still yields exactly
 * one bonus on return, never 30.
 *
 * The guard is a `WHERE NOT EXISTS` inside the INSERT itself rather than a separate read,
 * so two concurrent logins cannot both pass the check and double-award.
 *
 * @returns `awarded: false` when a bonus was already granted within the last 24h.
 */
export async function awardDailyLoginBonus(
  userId: string,
  amount = DAILY_LOGIN_BONUS,
): Promise<{ awarded: boolean }> {
  const result = await db.execute(sql`
    INSERT INTO transactions (user_id, amount, reason, source)
    SELECT ${userId}::uuid, ${amount}, 'Daily Login', 'login'
    WHERE NOT EXISTS (
      SELECT 1 FROM transactions
      WHERE user_id = ${userId}::uuid
        AND source = 'login'
        AND created_at > now() - interval '24 hours'
    )
    RETURNING id
  `);
  return { awarded: rowCount(result) > 0 };
}

/**
 * Atomically settles a game/day's top-score award: claims the settlement row and writes
 * the paired ledger transaction, or does neither (FR-3.3).
 *
 * Same single-statement CTE shape as awardAchievement(), guarding on
 * `daily_top_score_settlements`' `(game_id, game_date)` primary key. A repeat settle — a
 * retried cron, or two concurrent calls — conflicts, yields no rows, and writes no
 * transaction.
 *
 * @returns `settled: false` when this game/day was already settled.
 */
export async function settleTopScoreAward(input: {
  userId: string;
  gameId: string;
  gameDate: string; // YYYY-MM-DD
  amount: number;
  reason: string;
  source: TransactionSource;
  fromBounty: boolean;
}): Promise<{ settled: boolean }> {
  const result = await db.execute(sql`
    WITH settlement AS (
      INSERT INTO daily_top_score_settlements
        (game_id, game_date, user_id, amount, from_bounty)
      VALUES (
        ${input.gameId}, ${input.gameDate}::date, ${input.userId}::uuid,
        ${input.amount}, ${input.fromBounty}
      )
      ON CONFLICT (game_id, game_date) DO NOTHING
      RETURNING user_id
    )
    INSERT INTO transactions (user_id, amount, reason, source)
    SELECT user_id, ${input.amount}, ${input.reason}, ${input.source}
    FROM settlement
    RETURNING id
  `);
  return { settled: rowCount(result) > 0 };
}

export async function getBalance(userId: string): Promise<number> {
  const [result] = await db
    .select({ balance: sql<number>`coalesce(sum(${transactions.amount}), 0)` })
    .from(transactions)
    .where(eq(transactions.userId, userId));
  return Number(result?.balance ?? 0);
}

export async function getRecentTransactions(userId: string, limit = 50) {
  return db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(desc(transactions.createdAt))
    .limit(limit);
}

/**
 * Admin manual balance edit (FR-2.2). Still just a transaction — the "adjustment" is
 * entirely expressed in the reason string, per the PRD's exact copy convention.
 */
export async function adminAdjustBalance(input: {
  userId: string;
  actorUserId: string;
  previousBalance: number;
  newBalance: number;
}) {
  const delta = input.newBalance - input.previousBalance;
  return writeTransaction({
    userId: input.userId,
    amount: delta,
    reason: `Admin adjusted ${input.previousBalance} -> ${input.newBalance}`,
    source: 'admin_adjustment',
    actorUserId: input.actorUserId,
  });
}
