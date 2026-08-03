/**
 * Route-level integration tests (tasks.md id:51).
 *
 * Covers every Acceptance Criterion listed for `feat/api-and-bot-contract` in approach.md.
 * Handlers are invoked directly with a `Request` rather than over a running server: the
 * routes are plain functions of Request -> Response, so a live server would only add a
 * socket to the loop. The database is real (same live-Postgres approach as the lib tests),
 * because the behaviour under test is largely constraint-driven.
 *
 * Only Auth.js's `auth()` is mocked — sessions are the one input a test cannot construct
 * honestly. The bot's `isValidBotApiKey` stays real, since constant-time key comparison is
 * itself a security control worth exercising.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { eq, inArray } from 'drizzle-orm';

const BOT_KEY = 'test-bot-api-key-0123456789';
const CRON_SECRET = 'test-cron-secret-0123456789';
process.env.BOT_API_KEY = BOT_KEY;
process.env.CRON_SECRET = CRON_SECRET;
process.env.CORS_ALLOWED_ORIGINS = 'https://arcade.cartercripe.com';
process.env.CORS_ALLOWED_ORIGIN_SUFFIXES = '.vercel.app';

let currentSession: { user: { id: string; isAdmin: boolean } } | null = null;

// Replaced wholesale rather than spread over the original: `next-auth` cannot be imported
// under a plain node test env at all (it fails to resolve `next/server`). This module now
// exports only Auth.js machinery — the bot key check lives in lib/bot-key.ts and stays
// real for these tests.
vi.mock('@/lib/auth', () => ({
  auth: async () => currentSession,
  handlers: {},
  signIn: async () => undefined,
  signOut: async () => undefined,
}));

const { db } = await import('@/lib/db/client');
const {
  users,
  games,
  transactions,
  achievements,
  achievementAwards,
  highScores,
  dailyLeaderboardEntries,
  dailyTopScoreSettlements,
  bounties,
  botLogEvents,
  contentItems,
  contentCompletions,
} = await import('@/lib/db/schema');
const { writeTransaction, getBalance } = await import('@/lib/ledger');
const { dayBucket } = await import('@/lib/leaderboard');

const balanceRoute = await import('../balance/route');
const spendRoute = await import('../spend/route');
const submitRoute = await import('../scores/submit/route');
const bountyPendingRoute = await import('../bounty/pending/route');
const bountySetRoute = await import('../bounty/set/route');
const byDiscordRoute = await import('../users/by-discord-id/route');
const contentRoute = await import('../content/route');
const contentCompleteRoute = await import('../content/complete/route');
const cronRoute = await import('../cron/settle-daily/route');
const botLogRoute = await import('../bot/log/route');

const BASE = 'http://localhost:3001';

function req(
  path: string,
  init: { method?: string; body?: unknown; key?: string; origin?: string } = {},
) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (init.key) headers.authorization = `Bearer ${init.key}`;
  if (init.origin) headers.origin = init.origin;
  return new Request(`${BASE}${path}`, {
    method: init.method ?? 'GET',
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

describe('API routes (feat/api-and-bot-contract)', () => {
  const stamp = Date.now();
  const dailyGame = `api-daily-${stamp}`;
  const cabinetGame = `api-cabinet-${stamp}`;
  const discordId = `discord-${stamp}`;
  const logEventType = `test_event_${stamp}`;

  let adminId: string;
  let playerId: string;
  let rivalId: string;
  let riddleId: string;
  let taskId: string;
  let achievementId: string;

  const allUserIds = () => [adminId, playerId, rivalId];

  beforeAll(async () => {
    const inserted = await db
      .insert(users)
      .values([
        {
          googleId: `api-admin-${stamp}`,
          email: `api-admin-${stamp}@example.com`,
          displayName: 'Carter',
          isAdmin: true,
        },
        {
          googleId: `api-player-${stamp}`,
          email: `api-player-${stamp}@example.com`,
          displayName: 'Linked Player',
          discordId,
        },
        {
          googleId: `api-rival-${stamp}`,
          email: `api-rival-${stamp}@example.com`,
          displayName: 'Rival',
        },
      ])
      .returning();
    [adminId, playerId, rivalId] = inserted.map((u) => u.id);

    await db.insert(games).values([
      {
        id: dailyGame,
        displayName: 'Daily Game',
        tier: 'cartridge',
        tokenCost: 0,
        isDaily: true,
        defaultTopScoreAward: 10,
      },
      { id: cabinetGame, displayName: 'Setrit', tier: 'cabinet', tokenCost: 3 },
    ]);

    const [ach] = await db
      .insert(achievements)
      .values({ gameId: cabinetGame, mode: 'threshold', value: 100, award: 25 })
      .returning();
    achievementId = ach.id;

    const content = await db
      .insert(contentItems)
      .values([
        { type: 'riddle', prompt: `Riddle ${stamp}`, award: 10 },
        { type: 'task', prompt: `Task ${stamp}`, award: 4 },
      ])
      .returning();
    riddleId = content[0].id;
    taskId = content[1].id;
  });

  afterAll(async () => {
    await db.delete(contentCompletions).where(inArray(contentCompletions.userId, allUserIds()));
    await db.delete(contentItems).where(inArray(contentItems.id, [riddleId, taskId]));
    await db
      .delete(dailyTopScoreSettlements)
      .where(inArray(dailyTopScoreSettlements.gameId, [dailyGame, cabinetGame]));
    await db.delete(bounties).where(inArray(bounties.gameId, [dailyGame, cabinetGame]));
    await db
      .delete(dailyLeaderboardEntries)
      .where(inArray(dailyLeaderboardEntries.userId, allUserIds()));
    await db.delete(achievementAwards).where(inArray(achievementAwards.userId, allUserIds()));
    await db.delete(achievements).where(eq(achievements.id, achievementId));
    await db.delete(highScores).where(inArray(highScores.userId, allUserIds()));
    await db.delete(transactions).where(inArray(transactions.userId, allUserIds()));
    await db.delete(users).where(inArray(users.id, allUserIds()));
    await db.delete(botLogEvents).where(eq(botLogEvents.eventType, logEventType));
    await db.delete(games).where(inArray(games.id, [dailyGame, cabinetGame]));
  });

  beforeEach(async () => {
    currentSession = null;
    await db.delete(transactions).where(inArray(transactions.userId, allUserIds()));
    await db
      .delete(dailyLeaderboardEntries)
      .where(inArray(dailyLeaderboardEntries.userId, allUserIds()));
    await db
      .delete(dailyTopScoreSettlements)
      .where(inArray(dailyTopScoreSettlements.gameId, [dailyGame, cabinetGame]));
    await db.delete(bounties).where(inArray(bounties.gameId, [dailyGame, cabinetGame]));
    await db.delete(achievementAwards).where(inArray(achievementAwards.userId, allUserIds()));
    await db.delete(highScores).where(inArray(highScores.userId, allUserIds()));
    await db.delete(contentCompletions).where(inArray(contentCompletions.userId, allUserIds()));
  });

  const asUser = (id: string, isAdmin = false) => {
    currentSession = { user: { id, isAdmin } };
  };

  // --- GET /api/balance (id:41) --------------------------------------------

  it('returns balance and recent transactions for a valid session', async () => {
    asUser(playerId);
    await writeTransaction({
      userId: playerId,
      amount: 30,
      reason: 'Seed',
      source: 'admin_adjustment',
    });

    const res = await balanceRoute.GET(req('/api/balance'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.balance).toBe(30);
    expect(body.recent).toHaveLength(1);
    expect(body.recent[0].reason).toBe('Seed');
  });

  it('returns 401 from /api/balance with no session', async () => {
    const res = await balanceRoute.GET(req('/api/balance'));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  });

  // --- POST /api/spend (id:42) ---------------------------------------------

  it('spends tokens and reports the new balance', async () => {
    asUser(playerId);
    await writeTransaction({
      userId: playerId,
      amount: 10,
      reason: 'Seed',
      source: 'admin_adjustment',
    });

    const res = await spendRoute.POST(
      req('/api/spend', { method: 'POST', body: { gameId: cabinetGame } }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, newBalance: 7 });
  });

  it('returns 402 with required and balance when the user cannot afford the game', async () => {
    asUser(playerId);
    await writeTransaction({
      userId: playerId,
      amount: 1,
      reason: 'Seed',
      source: 'admin_adjustment',
    });

    const res = await spendRoute.POST(
      req('/api/spend', { method: 'POST', body: { gameId: cabinetGame } }),
    );
    expect(res.status).toBe(402);
    // The UX "Need {N} tokens" veil renders from exactly these two fields.
    expect(await res.json()).toEqual({
      ok: false,
      error: 'insufficient_balance',
      required: 3,
      balance: 1,
    });
  });

  it('rejects a malformed spend body with 400', async () => {
    asUser(playerId);
    const res = await spendRoute.POST(
      req('/api/spend', { method: 'POST', body: { notAGameId: 1 } }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('invalid_request');
  });

  // --- POST /api/scores/submit (id:43) -------------------------------------

  it('awards an achievement on a qualifying session-authenticated submission', async () => {
    asUser(playerId);
    const res = await submitRoute.POST(
      req('/api/scores/submit', {
        method: 'POST',
        body: { gameId: cabinetGame, score: 150 },
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.recorded).toBe(true);
    expect(body.awards).toContainEqual(
      expect.objectContaining({ amount: 25, source: 'achievement' }),
    );
  });

  it('ignores a body userId on the session path, so a user cannot submit as someone else', async () => {
    asUser(playerId);
    await submitRoute.POST(
      req('/api/scores/submit', {
        method: 'POST',
        body: { userId: rivalId, gameId: cabinetGame, score: 150 },
      }),
    );

    expect(await getBalance(rivalId)).toBe(0);
    expect(await getBalance(playerId)).toBe(25);
  });

  it('accepts a bot submission that resolves a linked discordId', async () => {
    const res = await submitRoute.POST(
      req('/api/scores/submit', {
        method: 'POST',
        key: BOT_KEY,
        body: { discordId, gameId: cabinetGame, score: 150 },
      }),
    );

    expect(res.status).toBe(200);
    expect(await getBalance(playerId)).toBe(25);
  });

  it('returns 404 for a bot submission whose discordId is not linked', async () => {
    const res = await submitRoute.POST(
      req('/api/scores/submit', {
        method: 'POST',
        key: BOT_KEY,
        body: { discordId: 'never-linked', gameId: cabinetGame, score: 150 },
      }),
    );

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'unknown_discord_id' });
  });

  it('returns 404 for a bot submission naming a well-formed but unknown userId', async () => {
    const res = await submitRoute.POST(
      req('/api/scores/submit', {
        method: 'POST',
        key: BOT_KEY,
        body: {
          userId: '00000000-0000-4000-8000-000000000000',
          gameId: cabinetGame,
          score: 150,
        },
      }),
    );
    // Would otherwise surface as a foreign-key violation, i.e. a 500.
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'unknown_user' });
  });

  it('returns 400 for malformed JSON on the settle cron', async () => {
    const res = await cronRoute.POST(
      new Request(`${BASE}/api/cron/settle-daily`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${CRON_SECRET}`,
        },
        body: '{not json',
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'invalid_json' });
  });

  it('returns 401 for a submission with neither a session nor a valid key', async () => {
    const res = await submitRoute.POST(
      req('/api/scores/submit', {
        method: 'POST',
        key: 'wrong-key',
        body: { discordId, gameId: cabinetGame, score: 150 },
      }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 for an unknown gameId', async () => {
    asUser(playerId);
    const res = await submitRoute.POST(
      req('/api/scores/submit', {
        method: 'POST',
        body: { gameId: 'no-such-game', score: 10 },
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'unknown_game' });
  });

  it('returns 400 for a negative score', async () => {
    asUser(playerId);
    const res = await submitRoute.POST(
      req('/api/scores/submit', {
        method: 'POST',
        body: { gameId: cabinetGame, score: -5 },
      }),
    );
    expect(res.status).toBe(400);
  });

  it('pays the participation award on a daily submission', async () => {
    asUser(playerId);
    const res = await submitRoute.POST(
      req('/api/scores/submit', {
        method: 'POST',
        body: { gameId: dailyGame, score: 40, isDailySubmission: true },
      }),
    );

    const body = await res.json();
    expect(body.awards).toContainEqual(
      expect.objectContaining({ amount: 5, source: 'daily_submission' }),
    );
  });

  // --- Bounty routes (id:44, id:45) ----------------------------------------

  it('opens a pending bounty when the admin posts a daily score, and not for other users', async () => {
    asUser(playerId);
    await submitRoute.POST(
      req('/api/scores/submit', {
        method: 'POST',
        body: { gameId: dailyGame, score: 20, isDailySubmission: true },
      }),
    );

    let res = await bountyPendingRoute.GET(
      req(`/api/bounty/pending?gameId=${dailyGame}`, { key: BOT_KEY }),
    );
    expect(await res.json()).toEqual({ pending: false });

    asUser(adminId, true);
    await submitRoute.POST(
      req('/api/scores/submit', {
        method: 'POST',
        body: { gameId: dailyGame, score: 99, isDailySubmission: true },
      }),
    );

    res = await bountyPendingRoute.GET(
      req(`/api/bounty/pending?gameId=${dailyGame}`, { key: BOT_KEY }),
    );
    expect(await res.json()).toEqual({
      pending: true,
      gameId: dailyGame,
      gameDate: dayBucket(),
    });
  });

  it('stops reporting pending once the bounty amount is set', async () => {
    await db.insert(bounties).values({ gameId: dailyGame, gameDate: dayBucket(), amount: null });

    const setRes = await bountySetRoute.POST(
      req('/api/bounty/set', {
        method: 'POST',
        key: BOT_KEY,
        body: { gameId: dailyGame, gameDate: dayBucket(), amount: 25 },
      }),
    );
    expect(setRes.status).toBe(200);

    const res = await bountyPendingRoute.GET(
      req(`/api/bounty/pending?gameId=${dailyGame}`, { key: BOT_KEY }),
    );
    expect(await res.json()).toEqual({ pending: false });
  });

  it('upserts rather than duplicating when a bounty is set twice', async () => {
    for (const amount of [10, 20]) {
      const res = await bountySetRoute.POST(
        req('/api/bounty/set', {
          method: 'POST',
          key: BOT_KEY,
          body: { gameId: dailyGame, gameDate: dayBucket(), amount },
        }),
      );
      expect(res.status).toBe(200);
    }

    const rows = await db.select().from(bounties).where(eq(bounties.gameId, dailyGame));
    expect(rows).toHaveLength(1);
    expect(rows[0].amount).toBe(20);
  });

  it('returns 401 from /api/bounty/set without a valid service API key', async () => {
    asUser(adminId, true); // an admin session must not substitute for the bot key
    const res = await bountySetRoute.POST(
      req('/api/bounty/set', {
        method: 'POST',
        body: { gameId: dailyGame, gameDate: dayBucket(), amount: 10 },
      }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 401 from /api/bounty/pending without a valid service API key', async () => {
    const res = await bountyPendingRoute.GET(
      req(`/api/bounty/pending?gameId=${dailyGame}`, { key: 'nope' }),
    );
    expect(res.status).toBe(401);
  });

  // --- GET /api/users/by-discord-id (id:46) --------------------------------

  it('resolves a linked discordId to a user', async () => {
    const res = await byDiscordRoute.GET(
      req(`/api/users/by-discord-id?discordId=${discordId}`, { key: BOT_KEY }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ userId: playerId, displayName: 'Linked Player' });
  });

  it('returns 404 for an unlinked discordId', async () => {
    const res = await byDiscordRoute.GET(
      req('/api/users/by-discord-id?discordId=nobody', { key: BOT_KEY }),
    );
    expect(res.status).toBe(404);
  });

  it('returns 401 from /api/users/by-discord-id without a valid service API key', async () => {
    const res = await byDiscordRoute.GET(
      req(`/api/users/by-discord-id?discordId=${discordId}`),
    );
    expect(res.status).toBe(401);
  });

  // --- Content routes (id:47, id:48) ---------------------------------------

  it('lists active content with completedToday flags', async () => {
    asUser(playerId);
    const res = await contentRoute.GET(req('/api/content'));
    expect(res.status).toBe(200);
    const body = await res.json();

    const riddle = body.items.find((i: { id: string }) => i.id === riddleId);
    expect(riddle).toMatchObject({ type: 'riddle', award: 10, completedToday: false });
  });

  it('awards a riddle once per day and reports already_completed_today on retry', async () => {
    asUser(playerId);
    const body = { contentItemId: riddleId, answerText: 'an echo' };

    const first = await contentCompleteRoute.POST(
      req('/api/content/complete', { method: 'POST', body }),
    );
    expect(await first.json()).toEqual({ ok: true, awarded: 10 });

    const second = await contentCompleteRoute.POST(
      req('/api/content/complete', { method: 'POST', body }),
    );
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({
      ok: false,
      error: 'already_completed_today',
    });

    expect(await getBalance(playerId)).toBe(10);

    const listed = await (
      await contentRoute.GET(req('/api/content'))
    ).json();
    expect(
      listed.items.find((i: { id: string }) => i.id === riddleId).completedToday,
    ).toBe(true);
  });

  it('awards a task on every call', async () => {
    asUser(playerId);
    const body = { contentItemId: taskId, answerText: 'done' };

    await contentCompleteRoute.POST(req('/api/content/complete', { method: 'POST', body }));
    await contentCompleteRoute.POST(req('/api/content/complete', { method: 'POST', body }));

    expect(await getBalance(playerId)).toBe(8);
  });

  it('returns 404 for an unknown content item', async () => {
    asUser(playerId);
    const res = await contentCompleteRoute.POST(
      req('/api/content/complete', {
        method: 'POST',
        body: {
          contentItemId: '00000000-0000-4000-8000-000000000000',
          answerText: 'x',
        },
      }),
    );
    expect(res.status).toBe(404);
  });

  it('returns 401 from content routes with no session', async () => {
    expect((await contentRoute.GET(req('/api/content'))).status).toBe(401);
    expect(
      (
        await contentCompleteRoute.POST(
          req('/api/content/complete', {
            method: 'POST',
            body: { contentItemId: riddleId, answerText: 'x' },
          }),
        )
      ).status,
    ).toBe(401);
  });

  // --- POST /api/bot/log (id:55) -------------------------------------------

  it('records a bot log event and rejects an unauthenticated write', async () => {
    const res = await botLogRoute.POST(
      req('/api/bot/log', {
        method: 'POST',
        key: BOT_KEY,
        body: { eventType: logEventType, payload: { gameId: dailyGame, score: 12 } },
      }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);

    const rows = await db
      .select()
      .from(botLogEvents)
      .where(eq(botLogEvents.eventType, logEventType));
    expect(rows).toHaveLength(1);
    expect(rows[0].payload).toEqual({ gameId: dailyGame, score: 12 });

    const denied = await botLogRoute.POST(
      req('/api/bot/log', {
        method: 'POST',
        key: 'nope',
        body: { eventType: logEventType, payload: {} },
      }),
    );
    expect(denied.status).toBe(401);
  });

  // --- POST /api/cron/settle-daily (id:53) ---------------------------------

  it('returns 401 from the settle cron without the cron secret or service key', async () => {
    const res = await cronRoute.POST(
      req('/api/cron/settle-daily', { method: 'POST', key: 'wrong', body: {} }),
    );
    expect(res.status).toBe(401);
  });

  it('settles the previous day once, and is a no-op on a second run', async () => {
    const yesterday = dayBucket(new Date(Date.now() - 24 * 60 * 60 * 1000));

    // Two distinct submitters are required before any top-score award exists (FR-3.3).
    await db.insert(dailyLeaderboardEntries).values([
      {
        userId: playerId,
        gameId: dailyGame,
        score: 90,
        submittedVia: 'site',
        gameDate: yesterday,
      },
      {
        userId: rivalId,
        gameId: dailyGame,
        score: 40,
        submittedVia: 'bot',
        gameDate: yesterday,
      },
    ]);

    const first = await cronRoute.POST(
      req('/api/cron/settle-daily', { method: 'POST', key: CRON_SECRET, body: {} }),
    );
    const firstBody = await first.json();
    expect(first.status).toBe(200);
    expect(firstBody.gameDate).toBe(yesterday);
    expect(firstBody.results).toContainEqual(
      expect.objectContaining({ gameId: dailyGame, status: 'settled', amount: 10 }),
    );
    expect(await getBalance(playerId)).toBe(10);

    const second = await cronRoute.POST(
      req('/api/cron/settle-daily', { method: 'POST', key: CRON_SECRET, body: {} }),
    );
    expect((await second.json()).results).toContainEqual(
      expect.objectContaining({ gameId: dailyGame, status: 'already_settled' }),
    );
    // The whole point of the guard: no second payout.
    expect(await getBalance(playerId)).toBe(10);
  });

  it('accepts the cron GET that Vercel actually sends', async () => {
    const res = await cronRoute.GET(
      req('/api/cron/settle-daily', { key: CRON_SECRET }),
    );
    expect(res.status).toBe(200);
  });

  it('reports no_award when only one person submitted', async () => {
    const yesterday = dayBucket(new Date(Date.now() - 24 * 60 * 60 * 1000));
    await db.insert(dailyLeaderboardEntries).values({
      userId: playerId,
      gameId: dailyGame,
      score: 90,
      submittedVia: 'site',
      gameDate: yesterday,
    });

    const res = await cronRoute.POST(
      req('/api/cron/settle-daily', { method: 'POST', key: CRON_SECRET, body: {} }),
    );
    expect((await res.json()).results).toContainEqual(
      expect.objectContaining({ gameId: dailyGame, status: 'no_award' }),
    );
    expect(await getBalance(playerId)).toBe(0);
  });

  // --- CORS (id:50) ---------------------------------------------------------

  it('echoes the allow-list header only for an allow-listed origin', async () => {
    asUser(playerId);

    const allowed = await balanceRoute.GET(
      req('/api/balance', { origin: 'https://arcade.cartercripe.com' }),
    );
    expect(allowed.headers.get('access-control-allow-origin')).toBe(
      'https://arcade.cartercripe.com',
    );
    expect(allowed.headers.get('vary')).toBe('Origin');

    // No allow header means the browser blocks the response for the caller — the
    // rejection is the absence of consent, not a distinct status code.
    const denied = await balanceRoute.GET(
      req('/api/balance', { origin: 'https://evil.example.com' }),
    );
    expect(denied.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('admits a configured preview-host suffix but not a lookalike', async () => {
    asUser(playerId);

    const preview = await balanceRoute.GET(
      req('/api/balance', { origin: 'https://arcade-git-abc.vercel.app' }),
    );
    expect(preview.headers.get('access-control-allow-origin')).toBe(
      'https://arcade-git-abc.vercel.app',
    );

    const lookalike = await balanceRoute.GET(
      req('/api/balance', { origin: 'https://arcade.vercel.app.attacker.com' }),
    );
    expect(lookalike.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('answers preflight 204 for an allow-listed origin and 403 otherwise', async () => {
    const ok = spendRoute.OPTIONS(
      req('/api/spend', { method: 'OPTIONS', origin: 'https://arcade.cartercripe.com' }),
    );
    expect(ok.status).toBe(204);

    const blocked = spendRoute.OPTIONS(
      req('/api/spend', { method: 'OPTIONS', origin: 'https://evil.example.com' }),
    );
    expect(blocked.status).toBe(403);
  });
});
