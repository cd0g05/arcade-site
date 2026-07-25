import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/client';
import {
  achievements,
  achievementAwards,
  games,
  highScores,
  transactions,
  users,
} from '../db/schema';
import {
  evaluateScoreSubmission,
  getHighScore,
  countAchievementAwards,
} from '../achievements';

// Runs against a real Postgres (per tech-design.md's Mocking strategy) because the whole
// point is verifying constraint-driven idempotency (ADR-3) — a mocked DB client would
// prove nothing about it.
describe('evaluateScoreSubmission (ADR-3 idempotency, ADR-5 interval-gap tracking)', () => {
  const stamp = Date.now();
  const gameId = `test-game-${stamp}`;
  let userId: string;

  beforeAll(async () => {
    const [user] = await db
      .insert(users)
      .values({
        googleId: `ach-google-${stamp}`,
        email: `ach-test-${stamp}@example.com`,
        displayName: 'Achievement Test User',
      })
      .returning();
    userId = user.id;

    await db.insert(games).values({
      id: gameId,
      displayName: 'Test Game',
      tier: 'cartridge',
      tokenCost: 1,
    });
  });

  afterAll(async () => {
    await db.delete(transactions).where(eq(transactions.userId, userId));
    await db.delete(achievementAwards).where(eq(achievementAwards.userId, userId));
    await db.delete(achievements).where(eq(achievements.gameId, gameId));
    await db.delete(highScores).where(eq(highScores.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
    await db.delete(games).where(eq(games.id, gameId));
  });

  // Each test defines its own achievement config and starts from a clean progression.
  beforeEach(async () => {
    await db.delete(transactions).where(eq(transactions.userId, userId));
    await db.delete(achievementAwards).where(eq(achievementAwards.userId, userId));
    await db.delete(achievements).where(eq(achievements.gameId, gameId));
    await db.delete(highScores).where(eq(highScores.userId, userId));
  });

  async function seedIntervalGap(gap: number, award: number, lastAwarded: number) {
    await db.insert(achievements).values({
      gameId,
      mode: 'interval_gap',
      value: gap,
      award,
    });
    await db.insert(highScores).values({
      userId,
      gameId,
      currentHighScore: lastAwarded,
      lastAwardedHighScore: lastAwarded,
    });
  }

  // tasks.md id:23
  it('does not award between the last award and the next gap threshold, but does update the high score', async () => {
    await seedIntervalGap(100, 25, 1000);

    const awards = await evaluateScoreSubmission({
      userId,
      gameId,
      score: 1050,
      isDailySubmission: false,
    });

    expect(awards).toEqual([]);

    const progression = await getHighScore(userId, gameId);
    expect(progression?.currentHighScore).toBe(1050);
    // ADR-5: the awarded watermark must NOT move just because the high score did.
    expect(progression?.lastAwardedHighScore).toBe(1000);
  });

  // tasks.md id:24
  it('awards exactly once when the score reaches the next gap threshold', async () => {
    await seedIntervalGap(100, 25, 1000);
    await evaluateScoreSubmission({ userId, gameId, score: 1050, isDailySubmission: false });

    const awards = await evaluateScoreSubmission({
      userId,
      gameId,
      score: 1100,
      isDailySubmission: false,
    });

    expect(awards).toHaveLength(1);
    expect(awards[0]).toEqual(
      expect.objectContaining({ amount: 25, source: 'achievement' }),
    );

    const progression = await getHighScore(userId, gameId);
    expect(progression?.currentHighScore).toBe(1100);
    expect(progression?.lastAwardedHighScore).toBe(1100);

    const rows = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.userId, userId), eq(transactions.source, 'achievement')));
    expect(rows).toHaveLength(1);
  });

  // tasks.md id:25 — the retry case that ADR-3 exists for.
  it('never double-awards a threshold achievement when the same submission is replayed', async () => {
    await db.insert(achievements).values({
      gameId,
      mode: 'threshold',
      value: 500,
      award: 15,
    });

    const first = await evaluateScoreSubmission({
      userId,
      gameId,
      score: 750,
      isDailySubmission: false,
    });
    const replay = await evaluateScoreSubmission({
      userId,
      gameId,
      score: 750,
      isDailySubmission: false,
    });

    expect(first).toHaveLength(1);
    expect(replay).toEqual([]); // ON CONFLICT DO NOTHING short-circuited the whole CTE

    expect(await countAchievementAwards(userId)).toBe(1);
    const rows = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.userId, userId), eq(transactions.source, 'achievement')));
    expect(rows).toHaveLength(1);
  });

  it('never double-awards under genuinely concurrent replays', async () => {
    await db.insert(achievements).values({
      gameId,
      mode: 'threshold',
      value: 500,
      award: 15,
    });

    const results = await Promise.all([
      evaluateScoreSubmission({ userId, gameId, score: 750, isDailySubmission: false }),
      evaluateScoreSubmission({ userId, gameId, score: 750, isDailySubmission: false }),
      evaluateScoreSubmission({ userId, gameId, score: 750, isDailySubmission: false }),
    ]);

    const totalAwards = results.flat().length;
    expect(totalAwards).toBe(1);
    expect(await countAchievementAwards(userId)).toBe(1);
  });

  it('awards each cleared interval when one submission jumps several gaps', async () => {
    await seedIntervalGap(100, 10, 1000);

    const awards = await evaluateScoreSubmission({
      userId,
      gameId,
      score: 1350,
      isDailySubmission: false,
    });

    // 1100, 1200, 1300 all cleared; 1400 not reached.
    expect(awards).toHaveLength(3);
    const progression = await getHighScore(userId, gameId);
    expect(progression?.lastAwardedHighScore).toBe(1300);
    expect(progression?.currentHighScore).toBe(1350);
  });

  it('creates a first-time high score row and awards a crossed threshold', async () => {
    await db.insert(achievements).values({
      gameId,
      mode: 'threshold',
      value: 100,
      award: 15,
    });

    const awards = await evaluateScoreSubmission({
      userId,
      gameId,
      score: 250,
      isDailySubmission: false,
    });

    expect(awards).toHaveLength(1);
    const progression = await getHighScore(userId, gameId);
    expect(progression?.currentHighScore).toBe(250);
  });

  it('does not lower a stored high score when a later score is worse', async () => {
    await evaluateScoreSubmission({ userId, gameId, score: 900, isDailySubmission: false });
    await evaluateScoreSubmission({ userId, gameId, score: 400, isDailySubmission: false });

    const progression = await getHighScore(userId, gameId);
    expect(progression?.currentHighScore).toBe(900);
  });

  it('awards an interval-gap achievement on a first-ever score with no prior progression row', async () => {
    // Exercises the insert-with-watermark path: there is no high_scores row yet, so the
    // watermark advance has to create one rather than UPDATE.
    await db.insert(achievements).values({
      gameId,
      mode: 'interval_gap',
      value: 100,
      award: 20,
    });

    const awards = await evaluateScoreSubmission({
      userId,
      gameId,
      score: 250,
      isDailySubmission: false,
    });

    expect(awards).toHaveLength(2); // cleared 100 and 200
    const progression = await getHighScore(userId, gameId);
    expect(progression?.lastAwardedHighScore).toBe(200);
    expect(progression?.currentHighScore).toBe(250);
  });

  it('ignores inactive achievements', async () => {
    await db.insert(achievements).values({
      gameId,
      mode: 'threshold',
      value: 100,
      award: 15,
      active: false,
    });

    const awards = await evaluateScoreSubmission({
      userId,
      gameId,
      score: 999,
      isDailySubmission: false,
    });
    expect(awards).toEqual([]);
  });

  it('ignores a misconfigured non-positive interval gap instead of awarding unboundedly', async () => {
    await seedIntervalGap(0, 10, 1000);

    const awards = await evaluateScoreSubmission({
      userId,
      gameId,
      score: 5000,
      isDailySubmission: false,
    });
    expect(awards).toEqual([]);
  });
});
