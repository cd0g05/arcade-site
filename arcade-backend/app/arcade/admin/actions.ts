'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getAdminSession } from '@/lib/admin-guard';
import { getUserWithBalance } from '@/lib/admin';
import { db } from '@/lib/db/client';
import { achievements, dailyLeaderboardEntries, games } from '@/lib/db/schema';
import { adminAdjustBalance } from '@/lib/ledger';

/**
 * Server actions for every admin mutation (tasks.md ids 63, 64, 66, 67).
 *
 * Each action re-checks `getAdminSession()` rather than trusting that the layout guard
 * ran. A server action is a POST endpoint with a generated URL — it is reachable directly,
 * not only through the page that renders its form, so the layout's guard is not a gate on
 * it. Skipping this check would leave every write below open to any authenticated user.
 */
async function requireAdmin() {
  const session = await getAdminSession();
  if (!session) throw new Error('forbidden');
  return session;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

// --- Balance adjustment (id:63) ---------------------------------------------

const AdjustBalanceSchema = z.object({
  userId: z.string().uuid(),
  newBalance: z.number().int(),
});

/**
 * Writes the "Admin adjusted {old} -> {new}" transaction (FR-2.2).
 *
 * `previousBalance` is re-read here rather than accepted from the client: the confirm
 * step shows the old value the admin saw, but between rendering and confirming the user
 * may have earned or spent. Trusting the client's number would write a delta that
 * silently reverses that activity. The reason string uses the freshly-read value, so it
 * always describes the adjustment that actually happened.
 */
export async function adjustBalanceAction(input: {
  userId: string;
  newBalance: number;
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = AdjustBalanceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid balance value.' };

  const user = await getUserWithBalance(parsed.data.userId);
  if (!user) return { ok: false, error: 'User not found.' };

  if (user.balance === parsed.data.newBalance) {
    // A zero-amount transaction would be a confusing no-op row in the user's own log.
    return { ok: false, error: 'Balance is already that value.' };
  }

  await adminAdjustBalance({
    userId: parsed.data.userId,
    actorUserId: admin.userId,
    previousBalance: user.balance,
    newBalance: parsed.data.newBalance,
  });

  revalidatePath('/arcade/admin/users');
  return { ok: true };
}

// --- Achievement builder (id:64) --------------------------------------------

const AchievementSchema = z.object({
  gameId: z.string().min(1),
  mode: z.enum(['threshold', 'interval_gap']),
  value: z.number().int().positive(),
  award: z.number().int().positive(),
  active: z.boolean().default(true),
});

export async function createAchievementAction(input: {
  gameId: string;
  mode: 'threshold' | 'interval_gap';
  value: number;
  award: number;
  active?: boolean;
}): Promise<ActionResult> {
  await requireAdmin();
  const parsed = AchievementSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Value and award must be positive whole numbers.' };
  }

  const [game] = await db.select().from(games).where(eq(games.id, parsed.data.gameId));
  if (!game) return { ok: false, error: 'Unknown game.' };

  await db.insert(achievements).values(parsed.data);

  // Live-applying without a redeploy (id:64) is a property of the design, not this call:
  // lib/achievements.ts reads the `achievements` table on every score submission, so a
  // new row takes effect on the next submission.
  revalidatePath('/arcade/admin/games');
  return { ok: true };
}

export async function updateAchievementAction(input: {
  id: string;
  value: number;
  award: number;
  active: boolean;
}): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z
    .object({
      id: z.string().uuid(),
      value: z.number().int().positive(),
      award: z.number().int().positive(),
      active: z.boolean(),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Value and award must be positive whole numbers.' };
  }

  await db
    .update(achievements)
    .set({
      value: parsed.data.value,
      award: parsed.data.award,
      active: parsed.data.active,
    })
    .where(eq(achievements.id, parsed.data.id));

  revalidatePath('/arcade/admin/games');
  return { ok: true };
}

/**
 * Deactivates rather than deletes.
 *
 * `achievement_awards` has a foreign key to `achievements`, so deleting a criteria row
 * that has ever paid out would either fail or (with a cascade) erase the record of awards
 * people actually received. `active: false` stops future awards and leaves history intact
 * — and `lib/achievements.ts` already filters on `active`.
 */
export async function deactivateAchievementAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: 'Invalid achievement.' };
  }

  await db.update(achievements).set({ active: false }).where(eq(achievements.id, id));
  revalidatePath('/arcade/admin/games');
  return { ok: true };
}

// --- Game config (id:66) ----------------------------------------------------

export async function updateGameConfigAction(input: {
  gameId: string;
  tokenCost: number;
  defaultTopScoreAward: number;
}): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z
    .object({
      gameId: z.string().min(1),
      // Zero is allowed: a free game is a legitimate configuration, unlike a negative
      // cost, which would pay the player for starting it.
      tokenCost: z.number().int().min(0),
      defaultTopScoreAward: z.number().int().min(0),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: 'Costs and awards must be whole numbers, zero or above.' };
  }

  await db
    .update(games)
    .set({
      tokenCost: parsed.data.tokenCost,
      defaultTopScoreAward: parsed.data.defaultTopScoreAward,
    })
    .where(eq(games.id, parsed.data.gameId));

  revalidatePath('/arcade/admin/games');
  return { ok: true };
}

// --- Leaderboard entry edit/delete (id:67) ----------------------------------

export async function updateLeaderboardEntryAction(input: {
  id: string;
  score: number;
}): Promise<ActionResult> {
  await requireAdmin();
  const parsed = z
    .object({ id: z.string().uuid(), score: z.number().int().min(0) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Score must be a whole number.' };

  await db
    .update(dailyLeaderboardEntries)
    .set({ score: parsed.data.score })
    .where(eq(dailyLeaderboardEntries.id, parsed.data.id));

  revalidatePath('/arcade/admin/leaderboards');
  return { ok: true };
}

/**
 * Removes a bad entry (FR-5.x).
 *
 * Note this does not claw back the +5 participation award already paid, nor re-settle a
 * day whose top-score award is already in `daily_top_score_settlements` — settlement is
 * one-shot by constraint. Correcting a day that has already settled requires an explicit
 * balance adjustment on the affected users.
 */
export async function deleteLeaderboardEntryAction(id: string): Promise<ActionResult> {
  await requireAdmin();
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: 'Invalid entry.' };
  }

  await db.delete(dailyLeaderboardEntries).where(eq(dailyLeaderboardEntries.id, id));
  revalidatePath('/arcade/admin/leaderboards');
  return { ok: true };
}
