import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../db/client';
import {
  bounties,
  dailyLeaderboardEntries,
  dailyTopScoreSettlements,
  games,
  transactions,
  users,
} from '../db/schema';
import {
  computeDailyLeaderboard,
  dayBucket,
  settleDailyTopScore,
  submitDailyScore,
} from '../leaderboard';
import { getBalance } from '../ledger';

describe('daily leaderboard (FR-3.3: participation, 2+-submitter gating, bounty/default award)', () => {
  const stamp = Date.now();
  const gameId = `test-daily-${stamp}`;
  const gameDate = '2026-03-15'; // fixed bucket so tests never straddle midnight
  let alice: string;
  let bob: string;

  beforeAll(async () => {
    const inserted = await db
      .insert(users)
      .values([
        {
          googleId: `lb-alice-${stamp}`,
          email: `lb-alice-${stamp}@example.com`,
          displayName: 'Alice',
        },
        {
          googleId: `lb-bob-${stamp}`,
          email: `lb-bob-${stamp}@example.com`,
          displayName: 'Bob',
        },
      ])
      .returning();
    alice = inserted[0].id;
    bob = inserted[1].id;

    await db.insert(games).values({
      id: gameId,
      displayName: 'Daily Test Game',
      tier: 'cartridge',
      tokenCost: 1,
      isDaily: true,
      defaultTopScoreAward: 10,
    });
  });

  afterAll(async () => {
    await db.delete(transactions).where(inArray(transactions.userId, [alice, bob]));
    await db.delete(dailyLeaderboardEntries).where(eq(dailyLeaderboardEntries.gameId, gameId));
    await db
      .delete(dailyTopScoreSettlements)
      .where(eq(dailyTopScoreSettlements.gameId, gameId));
    await db.delete(bounties).where(eq(bounties.gameId, gameId));
    await db.delete(users).where(inArray(users.id, [alice, bob]));
    await db.delete(games).where(eq(games.id, gameId));
  });

  beforeEach(async () => {
    await db.delete(transactions).where(inArray(transactions.userId, [alice, bob]));
    await db.delete(dailyLeaderboardEntries).where(eq(dailyLeaderboardEntries.gameId, gameId));
    await db
      .delete(dailyTopScoreSettlements)
      .where(eq(dailyTopScoreSettlements.gameId, gameId));
    await db.delete(bounties).where(eq(bounties.gameId, gameId));
  });

  // tasks.md id:27
  it('always pays the +5 participation award on a submission', async () => {
    const awards = await submitDailyScore({
      userId: alice,
      gameId,
      score: 100,
      submittedVia: 'site',
      gameDate,
    });

    expect(awards).toHaveLength(1);
    expect(awards[0]).toEqual(
      expect.objectContaining({ amount: 5, source: 'daily_submission' }),
    );
    expect(await getBalance(alice)).toBe(5);
  });

  // tasks.md id:29
  it('gives a single submitter participation only, and no top-score award', async () => {
    await submitDailyScore({ userId: alice, gameId, score: 100, submittedVia: 'site', gameDate });

    const board = await computeDailyLeaderboard(gameId, gameDate);
    expect(board.distinctSubmitters).toBe(1);
    expect(board.topScorerUserId).toBeNull();
    expect(board.topScoreAward).toBeNull();

    const settled = await settleDailyTopScore(gameId, gameDate);
    expect(settled).toBeNull();

    // Participation only.
    expect(await getBalance(alice)).toBe(5);
  });

  // tasks.md id:30
  it('identifies the top scorer once two or more people submit', async () => {
    await submitDailyScore({ userId: alice, gameId, score: 100, submittedVia: 'site', gameDate });
    await submitDailyScore({ userId: bob, gameId, score: 250, submittedVia: 'bot', gameDate });

    const board = await computeDailyLeaderboard(gameId, gameDate);
    expect(board.distinctSubmitters).toBe(2);
    expect(board.topScorerUserId).toBe(bob);
    expect(board.standings.map((s) => s.userId)).toEqual([bob, alice]);
  });

  it('does not count one user submitting twice as two submitters', async () => {
    await submitDailyScore({ userId: alice, gameId, score: 100, submittedVia: 'site', gameDate });
    await submitDailyScore({ userId: alice, gameId, score: 400, submittedVia: 'site', gameDate });

    const board = await computeDailyLeaderboard(gameId, gameDate);
    expect(board.distinctSubmitters).toBe(1);
    expect(board.topScorerUserId).toBeNull();
    // Standings keep only that user's best.
    expect(board.standings).toEqual([
      expect.objectContaining({ userId: alice, score: 400 }),
    ]);
  });

  // tasks.md id:33 — default award used when no bounty was set.
  it('falls back to games.default_top_score_award when no bounty exists', async () => {
    await submitDailyScore({ userId: alice, gameId, score: 100, submittedVia: 'site', gameDate });
    await submitDailyScore({ userId: bob, gameId, score: 250, submittedVia: 'site', gameDate });

    const board = await computeDailyLeaderboard(gameId, gameDate);
    expect(board.fromBounty).toBe(false);
    expect(board.topScoreAward).toBe(10);

    const settled = await settleDailyTopScore(gameId, gameDate);
    expect(settled).toEqual(
      expect.objectContaining({ amount: 10, reason: 'Top Score: Daily Test Game' }),
    );
    // Bob: 5 participation + 10 top score.
    expect(await getBalance(bob)).toBe(15);
  });

  it('prefers a set bounty amount over the game default', async () => {
    await db.insert(bounties).values({ gameId, gameDate, amount: 40 });
    await submitDailyScore({ userId: alice, gameId, score: 100, submittedVia: 'site', gameDate });
    await submitDailyScore({ userId: bob, gameId, score: 250, submittedVia: 'site', gameDate });

    const board = await computeDailyLeaderboard(gameId, gameDate);
    expect(board.fromBounty).toBe(true);
    expect(board.topScoreAward).toBe(40);

    const settled = await settleDailyTopScore(gameId, gameDate);
    expect(settled).toEqual(
      expect.objectContaining({ amount: 40, reason: 'Bounty: Daily Test Game' }),
    );
    expect(await getBalance(bob)).toBe(45);
  });

  it('treats a bounty row with a null amount as no bounty', async () => {
    // This is the real intermediate state: created when Carter posts a score, amount
    // filled in only once he answers the bot's prompt.
    await db.insert(bounties).values({ gameId, gameDate, amount: null });
    await submitDailyScore({ userId: alice, gameId, score: 100, submittedVia: 'site', gameDate });
    await submitDailyScore({ userId: bob, gameId, score: 250, submittedVia: 'site', gameDate });

    const board = await computeDailyLeaderboard(gameId, gameDate);
    expect(board.fromBounty).toBe(false);
    expect(board.topScoreAward).toBe(10);
  });

  it('settles the default top-score award at most once', async () => {
    await submitDailyScore({ userId: alice, gameId, score: 100, submittedVia: 'site', gameDate });
    await submitDailyScore({ userId: bob, gameId, score: 250, submittedVia: 'site', gameDate });

    const first = await settleDailyTopScore(gameId, gameDate);
    const second = await settleDailyTopScore(gameId, gameDate);

    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect(await getBalance(bob)).toBe(15);
  });

  it('settles a bounty at most once and records who claimed it', async () => {
    await db.insert(bounties).values({ gameId, gameDate, amount: 40 });
    await submitDailyScore({ userId: alice, gameId, score: 100, submittedVia: 'site', gameDate });
    await submitDailyScore({ userId: bob, gameId, score: 250, submittedVia: 'site', gameDate });

    expect(await settleDailyTopScore(gameId, gameDate)).not.toBeNull();
    expect(await settleDailyTopScore(gameId, gameDate)).toBeNull();

    const [row] = await db.select().from(bounties).where(eq(bounties.gameId, gameId));
    expect(row.claimedByUserId).toBe(bob);
    expect(await getBalance(bob)).toBe(45);
  });

  it('buckets a submission into the day it was played', async () => {
    const at = new Date(2026, 2, 15, 23, 59); // local time, just before midnight
    expect(dayBucket(at)).toBe('2026-03-15');
    expect(dayBucket(new Date(2026, 2, 16, 0, 1))).toBe('2026-03-16');
  });

  it("defaults an omitted gameDate to today's bucket", async () => {
    await submitDailyScore({ userId: alice, gameId, score: 100, submittedVia: 'site' });

    const today = dayBucket();
    const board = await computeDailyLeaderboard(gameId, today);
    expect(board.standings).toEqual([
      expect.objectContaining({ userId: alice, score: 100 }),
    ]);

    await db
      .delete(dailyLeaderboardEntries)
      .where(eq(dailyLeaderboardEntries.gameDate, today));
  });

  it('keeps separate days separate', async () => {
    await submitDailyScore({ userId: alice, gameId, score: 100, submittedVia: 'site', gameDate });
    await submitDailyScore({
      userId: bob,
      gameId,
      score: 250,
      submittedVia: 'site',
      gameDate: '2026-03-16',
    });

    // Two submitters overall, but only one on each day — so neither day qualifies.
    expect((await computeDailyLeaderboard(gameId, gameDate)).topScorerUserId).toBeNull();
    expect((await computeDailyLeaderboard(gameId, '2026-03-16')).topScorerUserId).toBeNull();
  });
});
