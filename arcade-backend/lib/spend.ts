import { eq } from 'drizzle-orm';
import { db } from './db/client';
import { games } from './db/schema';
import { getBalance, writeTransaction } from './ledger';

/**
 * Spend path (PRD FR-4.1/FR-4.2): tokens are deducted at game start, before gameplay,
 * as their own transaction row.
 */

/**
 * Thrown when a user cannot afford a game. Carries `required`/`balance` because the UX's
 * `"Need {N} tokens"` veil needs both to render, and the API contract surfaces them in the
 * `402` response body (see tech-design.md "Error Handling Pattern").
 */
export class InsufficientBalanceError extends Error {
  readonly details: { required: number; balance: number };

  constructor(required: number, balance: number) {
    super(`Insufficient balance: need ${required}, have ${balance}`);
    this.name = 'InsufficientBalanceError';
    this.details = { required, balance };
  }
}

/** Thrown when a spend references a game slug that isn't in the roster. */
export class UnknownGameError extends Error {
  constructor(gameId: string) {
    super(`Unknown game: ${gameId}`);
    this.name = 'UnknownGameError';
  }
}

export interface SpendResult {
  newBalance: number;
  cost: number;
  reason: string;
}

/**
 * Deducts a game's token cost from a user, or throws.
 *
 * The cost is read from `games.token_cost` rather than a constant, because FR-4.1 requires
 * per-game costs to be admin-editable without a redeploy.
 *
 * Note the deliberate ordering: balance is checked before the write, so this is a
 * read-then-write and two truly simultaneous spends could each see a sufficient balance.
 * That is an accepted trade-off for a ~5-20 user hobby arcade where the failure mode is a
 * briefly negative balance rather than lost money, and where the PRD explicitly frames
 * tokens as abundant and non-scarce. Tightening it would need either a balance materialized
 * with a constraint (which ADR-2 rules out) or an advisory lock.
 */
export async function spendTokens(userId: string, gameId: string): Promise<SpendResult> {
  const [game] = await db.select().from(games).where(eq(games.id, gameId));
  if (!game) throw new UnknownGameError(gameId);

  const cost = game.tokenCost;
  const balance = await getBalance(userId);
  if (balance < cost) throw new InsufficientBalanceError(cost, balance);

  // Copy convention per UX "Critical copy samples": "-3 Cabinet: Setrit".
  const label = game.tier === 'cabinet' ? 'Cabinet' : 'Cartridge';
  const reason = `${label}: ${game.displayName}`;

  await writeTransaction({
    userId,
    amount: -cost,
    reason,
    source: 'cabinet_spend',
  });

  return { newBalance: balance - cost, cost, reason };
}
