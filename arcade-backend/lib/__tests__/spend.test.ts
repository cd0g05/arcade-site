import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../db/client';
import { games, transactions, users } from '../db/schema';
import { spendTokens, InsufficientBalanceError, UnknownGameError } from '../spend';
import {
  awardDailyLoginBonus,
  getBalance,
  writeTransaction,
  DAILY_LOGIN_BONUS,
} from '../ledger';

describe('spendTokens (FR-4.1/FR-4.2: deduct at game start, per-game cost)', () => {
  const stamp = Date.now();
  const cartridgeId = `spend-cartridge-${stamp}`;
  const cabinetId = `spend-cabinet-${stamp}`;
  let userId: string;

  beforeAll(async () => {
    const [user] = await db
      .insert(users)
      .values({
        googleId: `spend-google-${stamp}`,
        email: `spend-${stamp}@example.com`,
        displayName: 'Spend Test User',
      })
      .returning();
    userId = user.id;

    await db.insert(games).values([
      { id: cartridgeId, displayName: 'Cheap Game', tier: 'cartridge', tokenCost: 1 },
      { id: cabinetId, displayName: 'Setrit', tier: 'cabinet', tokenCost: 3 },
    ]);
  });

  afterAll(async () => {
    await db.delete(transactions).where(eq(transactions.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
    await db.delete(games).where(inArray(games.id, [cartridgeId, cabinetId]));
  });

  beforeEach(async () => {
    await db.delete(transactions).where(eq(transactions.userId, userId));
  });

  // tasks.md id:31
  it('deducts the cabinet cost and reports the new balance', async () => {
    await writeTransaction({ userId, amount: 20, reason: 'Seed', source: 'admin_adjustment' });

    const result = await spendTokens(userId, cabinetId);

    expect(result.cost).toBe(3);
    expect(result.newBalance).toBe(17);
    // Copy convention per UX "Critical copy samples": "-3 Cabinet: Setrit".
    expect(result.reason).toBe('Cabinet: Setrit');
    expect(await getBalance(userId)).toBe(17);
  });

  it('deducts the lower cartridge cost', async () => {
    await writeTransaction({ userId, amount: 20, reason: 'Seed', source: 'admin_adjustment' });
    const result = await spendTokens(userId, cartridgeId);
    expect(result.cost).toBe(1);
    expect(await getBalance(userId)).toBe(19);
  });

  it('throws InsufficientBalanceError with required and balance for the UX veil', async () => {
    await writeTransaction({ userId, amount: 2, reason: 'Seed', source: 'admin_adjustment' });

    await expect(spendTokens(userId, cabinetId)).rejects.toThrow(InsufficientBalanceError);

    // The `"Need {N} tokens"` veil and the 402 body both need these two numbers.
    try {
      await spendTokens(userId, cabinetId);
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(InsufficientBalanceError);
      expect((e as InsufficientBalanceError).details).toEqual({ required: 3, balance: 2 });
    }

    // Nothing was deducted on the failed attempt.
    expect(await getBalance(userId)).toBe(2);
  });

  it('allows a spend that lands exactly on zero', async () => {
    await writeTransaction({ userId, amount: 3, reason: 'Seed', source: 'admin_adjustment' });
    const result = await spendTokens(userId, cabinetId);
    expect(result.newBalance).toBe(0);
  });

  it('rejects a zero balance', async () => {
    await expect(spendTokens(userId, cartridgeId)).rejects.toThrow(InsufficientBalanceError);
  });

  it('rejects an unknown game slug', async () => {
    await expect(spendTokens(userId, 'no-such-game')).rejects.toThrow(UnknownGameError);
  });
});

describe('awardDailyLoginBonus (FR-2: +10 per rolling 24h, no buildup)', () => {
  const stamp = Date.now();
  let userId: string;

  beforeAll(async () => {
    const [user] = await db
      .insert(users)
      .values({
        googleId: `login-google-${stamp}`,
        email: `login-${stamp}@example.com`,
        displayName: 'Login Test User',
      })
      .returning();
    userId = user.id;
  });

  afterAll(async () => {
    await db.delete(transactions).where(eq(transactions.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
  });

  beforeEach(async () => {
    await db.delete(transactions).where(eq(transactions.userId, userId));
  });

  // tasks.md id:32
  it('awards the bonus on a first login', async () => {
    const { awarded } = await awardDailyLoginBonus(userId);
    expect(awarded).toBe(true);
    expect(await getBalance(userId)).toBe(DAILY_LOGIN_BONUS);
  });

  it('does not award again within the same 24h window', async () => {
    expect((await awardDailyLoginBonus(userId)).awarded).toBe(true);
    expect((await awardDailyLoginBonus(userId)).awarded).toBe(false);
    expect(await getBalance(userId)).toBe(DAILY_LOGIN_BONUS);
  });

  it('awards again once the previous bonus is older than 24h', async () => {
    await awardDailyLoginBonus(userId);

    // Backdate the existing bonus past the window rather than waiting a day.
    await db
      .update(transactions)
      .set({ createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) })
      .where(eq(transactions.userId, userId));

    expect((await awardDailyLoginBonus(userId)).awarded).toBe(true);
    expect(await getBalance(userId)).toBe(DAILY_LOGIN_BONUS * 2);
  });

  it('grants exactly one bonus after a long absence, not one per missed day', async () => {
    await awardDailyLoginBonus(userId);
    await db
      .update(transactions)
      .set({ createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) })
      .where(eq(transactions.userId, userId));

    await awardDailyLoginBonus(userId);

    // 30 days away yields one further bonus, never 30 (the "no buildup" rule).
    expect(await getBalance(userId)).toBe(DAILY_LOGIN_BONUS * 2);
  });

  it('does not double-award under concurrent logins', async () => {
    const results = await Promise.all([
      awardDailyLoginBonus(userId),
      awardDailyLoginBonus(userId),
      awardDailyLoginBonus(userId),
    ]);

    expect(results.filter((r) => r.awarded)).toHaveLength(1);
    expect(await getBalance(userId)).toBe(DAILY_LOGIN_BONUS);
  });
});
