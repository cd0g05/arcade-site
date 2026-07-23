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
