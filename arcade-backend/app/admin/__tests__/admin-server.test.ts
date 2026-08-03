/**
 * Server-side admin tests (tasks.md ids 60-63, 66-69) against the live database.
 *
 * Covers the Partition 4 Acceptance Criteria that are about *authorization and what
 * actually gets written*, which the jsdom component tests deliberately do not reach:
 * the admin guard, the exact `"Admin adjusted {old} -> {new}"` reason string, and the
 * aggregate queries behind the Users list and Analytics pages.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { eq, inArray } from 'drizzle-orm';

let currentSession: { user: { id: string; isAdmin: boolean; name?: string } } | null = null;

// next-auth cannot be imported under a node test env (it fails to resolve `next/server`),
// so the module is replaced wholesale rather than spread over the original.
vi.mock('@/lib/auth', () => ({
  auth: async () => currentSession,
  handlers: {},
  signIn: async () => undefined,
  signOut: async () => undefined,
}));

// revalidatePath() throws outside a request scope; the actions call it after every write.
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));

const { db } = await import('@/lib/db/client');
const {
  users,
  games,
  transactions,
  achievements,
  achievementAwards,
  highScores,
  dailyLeaderboardEntries,
} = await import('@/lib/db/schema');
const { writeTransaction, getBalance, getRecentTransactions } = await import('@/lib/ledger');
const { getAdminSession } = await import('@/lib/admin-guard');
const {
  listUsersWithBalances,
  listUserTransactions,
  getUserWithBalance,
  getAnalytics,
} = await import('@/lib/admin');
const {
  adjustBalanceAction,
  createAchievementAction,
  deactivateAchievementAction,
  updateGameConfigAction,
  updateLeaderboardEntryAction,
  deleteLeaderboardEntryAction,
} = await import('../actions');

describe('admin dashboard (feat/admin-dashboard)', () => {
  const stamp = Date.now();
  const gameId = `admin-game-${stamp}`;
  let adminId: string;
  let playerId: string;

  const allUserIds = () => [adminId, playerId];
  const asAdmin = () => {
    currentSession = { user: { id: adminId, isAdmin: true, name: 'Carter' } };
  };
  const asPlayer = () => {
    currentSession = { user: { id: playerId, isAdmin: false, name: 'Player' } };
  };

  beforeAll(async () => {
    const inserted = await db
      .insert(users)
      .values([
        {
          googleId: `admin-a-${stamp}`,
          email: `admin-a-${stamp}@example.com`,
          displayName: 'Carter',
          isAdmin: true,
        },
        {
          googleId: `admin-p-${stamp}`,
          email: `admin-p-${stamp}@example.com`,
          displayName: 'Dana',
        },
      ])
      .returning();
    [adminId, playerId] = inserted.map((u) => u.id);

    await db.insert(games).values({
      id: gameId,
      displayName: `Admin Game ${stamp}`,
      tier: 'cabinet',
      tokenCost: 3,
      isDaily: true,
      defaultTopScoreAward: 10,
    });
  });

  afterAll(async () => {
    await clearFixtureData();
    await db.delete(users).where(inArray(users.id, allUserIds()));
    await db.delete(games).where(eq(games.id, gameId));
  });

  /**
   * Order matters: achievement_awards and high_scores both reference the rows below them.
   * The award FK is the same one that makes deactivate-not-delete the right design for
   * the builder — a criteria row that has paid out cannot simply be removed.
   */
  const clearFixtureData = async () => {
    await db.delete(achievementAwards).where(inArray(achievementAwards.userId, allUserIds()));
    await db.delete(highScores).where(inArray(highScores.userId, allUserIds()));
    await db.delete(transactions).where(inArray(transactions.userId, allUserIds()));
    await db.delete(achievements).where(eq(achievements.gameId, gameId));
    await db
      .delete(dailyLeaderboardEntries)
      .where(inArray(dailyLeaderboardEntries.userId, allUserIds()));
  };

  beforeEach(async () => {
    currentSession = null;
    await clearFixtureData();
  });

  // --- Guard (id:60) --------------------------------------------------------

  it('denies the admin session to a signed-out visitor and to a non-admin', async () => {
    expect(await getAdminSession()).toBeNull();

    asPlayer();
    // Not distinguished from signed-out on purpose: the dashboard must not be usable to
    // probe who holds admin.
    expect(await getAdminSession()).toBeNull();
  });

  it('grants the admin session to the admin account', async () => {
    asAdmin();
    expect(await getAdminSession()).toEqual({ userId: adminId, displayName: 'Carter' });
  });

  it('refuses every mutating action to a non-admin, even called directly', async () => {
    asPlayer();
    // Server actions are directly-reachable POST endpoints, so each re-checks the guard
    // rather than trusting that the layout ran.
    await expect(
      adjustBalanceAction({ userId: playerId, newBalance: 999 }),
    ).rejects.toThrow('forbidden');
    await expect(
      createAchievementAction({ gameId, mode: 'threshold', value: 10, award: 5 }),
    ).rejects.toThrow('forbidden');
    await expect(
      updateGameConfigAction({ gameId, tokenCost: 0, defaultTopScoreAward: 0 }),
    ).rejects.toThrow('forbidden');

    expect(await getBalance(playerId)).toBe(0);
  });

  // --- Users list + drill-down (ids 61-62) ----------------------------------

  it('lists users with their ledger balance and last-active date', async () => {
    await writeTransaction({
      userId: playerId,
      amount: 40,
      reason: 'Seed',
      source: 'admin_adjustment',
    });

    const rows = await listUsersWithBalances();
    const player = rows.find((r) => r.id === playerId);
    const admin = rows.find((r) => r.id === adminId);

    expect(player?.balance).toBe(40);
    expect(player?.displayName).toBe('Dana');
    expect(player?.lastActiveAt).toBeInstanceOf(Date);
    // LEFT JOIN, so a user with no transactions still appears rather than dropping out.
    expect(admin?.balance).toBe(0);
  });

  it('sorts the drill-down by time, amount, and reason', async () => {
    await writeTransaction({
      userId: playerId,
      amount: 5,
      reason: 'Zulu',
      source: 'admin_adjustment',
    });
    await writeTransaction({
      userId: playerId,
      amount: 99,
      reason: 'Alpha',
      source: 'admin_adjustment',
    });

    const byAmount = await listUserTransactions(playerId, 'amount');
    expect(byAmount[0].amount).toBe(99);

    const byReason = await listUserTransactions(playerId, 'reason');
    expect(byReason[0].reason).toBe('Alpha');

    const byTime = await listUserTransactions(playerId, 'time');
    expect(byTime).toHaveLength(2);
  });

  // --- Balance adjustment (id:63) -------------------------------------------

  it('writes the exact "Admin adjusted 40 -> 55" transaction, visible in both views', async () => {
    await writeTransaction({
      userId: playerId,
      amount: 40,
      reason: 'Seed',
      source: 'admin_adjustment',
    });

    asAdmin();
    const result = await adjustBalanceAction({ userId: playerId, newBalance: 55 });
    expect(result.ok).toBe(true);

    expect(await getBalance(playerId)).toBe(55);

    // The reason string is exact copy per the PRD/UX convention.
    const drilldown = await listUserTransactions(playerId);
    expect(drilldown[0].reason).toBe('Admin adjusted 40 -> 55');
    expect(drilldown[0].amount).toBe(15);
    expect(drilldown[0].source).toBe('admin_adjustment');
    // Attributed to the admin who made the change, not the affected user.
    expect(drilldown[0].actorUserId).toBe(adminId);

    // ...and in the user's own /api/balance recent list, which reads the same ledger.
    const recent = await getRecentTransactions(playerId);
    expect(recent[0].reason).toBe('Admin adjusted 40 -> 55');
  });

  it('re-reads the balance rather than trusting the client, so concurrent activity is not reversed', async () => {
    await writeTransaction({
      userId: playerId,
      amount: 40,
      reason: 'Seed',
      source: 'admin_adjustment',
    });

    // The admin opened the panel seeing 40, but the player earns 10 before they confirm.
    await writeTransaction({
      userId: playerId,
      amount: 10,
      reason: 'Daily Login',
      source: 'login',
    });

    asAdmin();
    await adjustBalanceAction({ userId: playerId, newBalance: 55 });

    // Ends at exactly 55 — the adjustment describes and produces the real end state
    // rather than applying a stale +15 delta on top of 50.
    expect(await getBalance(playerId)).toBe(55);
    const [latest] = await listUserTransactions(playerId);
    expect(latest.reason).toBe('Admin adjusted 50 -> 55');
  });

  it('refuses a no-op adjustment rather than writing a zero-amount row', async () => {
    await writeTransaction({
      userId: playerId,
      amount: 40,
      reason: 'Seed',
      source: 'admin_adjustment',
    });

    asAdmin();
    const result = await adjustBalanceAction({ userId: playerId, newBalance: 40 });

    expect(result.ok).toBe(false);
    expect(await listUserTransactions(playerId)).toHaveLength(1);
  });

  // --- Achievement builder (id:64) ------------------------------------------

  it('persists a criteria row and applies it live to the next submission', async () => {
    asAdmin();
    const result = await createAchievementAction({
      gameId,
      mode: 'threshold',
      value: 100,
      award: 25,
    });
    expect(result.ok).toBe(true);

    const rows = await db.select().from(achievements).where(eq(achievements.gameId, gameId));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ mode: 'threshold', value: 100, award: 25, active: true });

    // "Live-applying without redeploy" is a property of lib/achievements.ts reading the
    // table per submission — verify the award actually fires with no restart involved.
    const { evaluateScoreSubmission } = await import('@/lib/achievements');
    const awards = await evaluateScoreSubmission({
      userId: playerId,
      gameId,
      score: 150,
      isDailySubmission: false,
    });
    expect(awards).toContainEqual(expect.objectContaining({ amount: 25 }));
  });

  it('rejects a non-positive criteria value or award', async () => {
    asAdmin();
    expect((await createAchievementAction({ gameId, mode: 'threshold', value: 0, award: 5 })).ok)
      .toBe(false);
    expect((await createAchievementAction({ gameId, mode: 'threshold', value: 5, award: 0 })).ok)
      .toBe(false);
    expect(
      await db.select().from(achievements).where(eq(achievements.gameId, gameId)),
    ).toHaveLength(0);
  });

  it('deactivates rather than deletes, preserving award history', async () => {
    asAdmin();
    await createAchievementAction({ gameId, mode: 'threshold', value: 100, award: 25 });
    const [row] = await db.select().from(achievements).where(eq(achievements.gameId, gameId));

    expect((await deactivateAchievementAction(row.id)).ok).toBe(true);

    const [after] = await db.select().from(achievements).where(eq(achievements.id, row.id));
    // Row still exists — achievement_awards has a foreign key to it, so a delete would
    // either fail or erase the record of awards people actually received.
    expect(after.active).toBe(false);

    const { evaluateScoreSubmission } = await import('@/lib/achievements');
    expect(
      await evaluateScoreSubmission({
        userId: playerId,
        gameId,
        score: 500,
        isDailySubmission: false,
      }),
    ).toEqual([]);
  });

  // --- Game config (id:66) --------------------------------------------------

  it('edits per-game token cost and default top-score award', async () => {
    asAdmin();
    expect((await updateGameConfigAction({ gameId, tokenCost: 7, defaultTopScoreAward: 20 })).ok)
      .toBe(true);

    const [game] = await db.select().from(games).where(eq(games.id, gameId));
    expect(game.tokenCost).toBe(7);
    expect(game.defaultTopScoreAward).toBe(20);

    // Zero is a legitimate config (a free game); negative is not.
    expect((await updateGameConfigAction({ gameId, tokenCost: 0, defaultTopScoreAward: 0 })).ok)
      .toBe(true);
    expect((await updateGameConfigAction({ gameId, tokenCost: -1, defaultTopScoreAward: 5 })).ok)
      .toBe(false);

    await updateGameConfigAction({ gameId, tokenCost: 3, defaultTopScoreAward: 10 });
  });

  // --- Leaderboard entry edit/delete (id:67) --------------------------------

  it('edits and deletes a daily leaderboard entry', async () => {
    const [entry] = await db
      .insert(dailyLeaderboardEntries)
      .values({
        userId: playerId,
        gameId,
        score: 50,
        submittedVia: 'site',
        gameDate: '2026-07-20',
      })
      .returning();

    asAdmin();
    expect((await updateLeaderboardEntryAction({ id: entry.id, score: 75 })).ok).toBe(true);
    const [updated] = await db
      .select()
      .from(dailyLeaderboardEntries)
      .where(eq(dailyLeaderboardEntries.id, entry.id));
    expect(updated.score).toBe(75);

    expect((await deleteLeaderboardEntryAction(entry.id)).ok).toBe(true);
    expect(
      await db
        .select()
        .from(dailyLeaderboardEntries)
        .where(eq(dailyLeaderboardEntries.id, entry.id)),
    ).toHaveLength(0);
  });

  // --- Analytics (id:69) ----------------------------------------------------

  it('counts paid plays per game by game_id, not by parsing the reason string', async () => {
    await writeTransaction({
      userId: playerId,
      amount: -3,
      // Deliberately NOT the "{Tier}: {Display Name}" copy the old join relied on — the
      // count must survive any change to the reason wording.
      reason: 'some entirely different wording',
      source: 'cabinet_spend',
      gameId,
    });

    const { mostPlayed } = await getAnalytics();
    expect(mostPlayed.find((r) => r.gameId === gameId)?.plays).toBe(1);
  });

  it('stamps game_id on every game-related ledger write path', async () => {
    const { spendTokens } = await import('@/lib/spend');
    const { submitDailyScore } = await import('@/lib/leaderboard');

    asAdmin();
    await createAchievementAction({ gameId, mode: 'threshold', value: 100, award: 25 });

    await writeTransaction({
      userId: playerId,
      amount: 100,
      reason: 'Seed',
      source: 'admin_adjustment',
    });
    await spendTokens(playerId, gameId);
    await submitDailyScore({
      userId: playerId,
      gameId,
      score: 150,
      submittedVia: 'site',
    });
    const { evaluateScoreSubmission } = await import('@/lib/achievements');
    await evaluateScoreSubmission({
      userId: playerId,
      gameId,
      score: 150,
      isDailySubmission: true,
    });

    const rows = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, playerId));

    // Each writer path goes through a different insert site in lib/ledger.ts — plain
    // insert (spend, participation), and the CTE form (achievement award).
    for (const source of ['cabinet_spend', 'daily_submission', 'achievement'] as const) {
      const row = rows.find((r) => r.source === source);
      expect(row, `expected a ${source} row`).toBeDefined();
      expect(row!.gameId, `${source} should carry game_id`).toBe(gameId);
    }
    // The seed adjustment has no game, and must stay null rather than inherit one.
    expect(rows.find((r) => r.source === 'admin_adjustment')!.gameId).toBeNull();
  });

  it('does not attribute a gameless transaction to any game', async () => {
    await writeTransaction({
      userId: playerId,
      amount: 10,
      reason: 'Daily Login',
      source: 'login',
    });

    const { mostPlayed } = await getAnalytics();
    expect(mostPlayed.every((r) => r.plays === 0)).toBe(true);
  });

  it('counts distinct daily submitters per game/day', async () => {
    await db.insert(dailyLeaderboardEntries).values([
      { userId: playerId, gameId, score: 10, submittedVia: 'site', gameDate: '2026-07-21' },
      // Same user twice on one day still counts as one submitter, per the FR-3.3 gate.
      { userId: playerId, gameId, score: 20, submittedVia: 'site', gameDate: '2026-07-21' },
      { userId: adminId, gameId, score: 30, submittedVia: 'bot', gameDate: '2026-07-21' },
    ]);

    const { participation } = await getAnalytics();
    const day = participation.find(
      (p) => p.gameId === gameId && p.gameDate === '2026-07-21',
    );
    expect(day?.submitters).toBe(2);
  });

  it('reports a user with no transactions as a zero balance rather than omitting them', async () => {
    const user = await getUserWithBalance(adminId);
    expect(user).toMatchObject({ id: adminId, balance: 0 });
  });
});
