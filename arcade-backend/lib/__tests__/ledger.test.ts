import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { users, transactions } from '../db/schema';
import { writeTransaction, getBalance, adminAdjustBalance } from '../ledger';

// Requires DATABASE_URL to point at a real (dev/test) Postgres instance — per
// tech-design.md's Mocking strategy, ledger correctness is tested against real
// constraint-driven behavior, not a mocked DB client. Run via `npm run test` after
// `.env.local` is configured (see README.md's one-time setup steps).
describe('ledger — balance is always reconstructable from the transaction log (ADR-2)', () => {
  let userId: string;

  beforeAll(async () => {
    const [user] = await db
      .insert(users)
      .values({
        googleId: `test-google-id-${Date.now()}`,
        email: `ledger-test-${Date.now()}@example.com`,
        displayName: 'Ledger Test User',
      })
      .returning();
    userId = user.id;
  });

  afterAll(async () => {
    await db.delete(transactions).where(eq(transactions.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
  });

  it('sums signed transaction amounts into a balance', async () => {
    await writeTransaction({ userId, amount: 10, reason: 'Daily Login', source: 'login' });
    await writeTransaction({ userId, amount: 15, reason: 'High Score: Dino Run', source: 'high_score' });
    await writeTransaction({ userId, amount: -3, reason: 'Cabinet: Setrit', source: 'cabinet_spend' });

    expect(await getBalance(userId)).toBe(22);
  });

  it('records an admin adjustment as a transaction with the exact expected reason copy', async () => {
    const before = await getBalance(userId);
    await adminAdjustBalance({
      userId,
      actorUserId: userId, // self-adjustment for test simplicity
      previousBalance: before,
      newBalance: before + 15,
    });

    const after = await getBalance(userId);
    expect(after).toBe(before + 15);

    const rows = await db.select().from(transactions).where(eq(transactions.userId, userId));
    const adjustment = rows.find((r) => r.source === 'admin_adjustment');
    expect(adjustment?.reason).toBe(`Admin adjusted ${before} -> ${before + 15}`);
  });
});
