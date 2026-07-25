/**
 * Data access for the admin dashboard (tasks.md ids 60-69).
 *
 * Every list query here is a single joined/aggregated statement rather than a per-row
 * loop. That is not premature optimization: the `neon-http` driver issues each query as
 * its own HTTPS round trip, and the Partition 1 pooling spike measured per-query latency
 * degrading ~13x under wide concurrency. A Users page that fetched a balance per user
 * would be one request per row.
 *
 * Reads live here; writes go through `lib/ledger.ts` (ADR-2) or the server actions in
 * app/admin/actions.ts.
 */
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { db } from './db/client';
import {
  achievements,
  botLogEvents,
  contentItems,
  dailyLeaderboardEntries,
  dailyTopScoreSettlements,
  games,
  transactions,
  users,
} from './db/schema';

export interface AdminUserRow {
  id: string;
  displayName: string;
  email: string;
  isAdmin: boolean;
  balance: number;
  lastActiveAt: Date;
}

/**
 * The Users list (UX Mock-Up 1): one row per user with their ledger balance.
 *
 * LEFT JOIN + GROUP BY, so a user with no transactions still appears with a balance of 0
 * rather than dropping out of the list.
 */
export async function listUsersWithBalances(): Promise<AdminUserRow[]> {
  const rows = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      email: users.email,
      isAdmin: users.isAdmin,
      lastActiveAt: users.lastActiveAt,
      balance: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(users)
    .leftJoin(transactions, eq(transactions.userId, users.id))
    .groupBy(users.id)
    .orderBy(desc(users.lastActiveAt));

  return rows.map((r) => ({ ...r, balance: Number(r.balance) }));
}

export async function getUserWithBalance(userId: string) {
  const [row] = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      email: users.email,
      isAdmin: users.isAdmin,
      lastActiveAt: users.lastActiveAt,
      balance: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(users)
    .leftJoin(transactions, eq(transactions.userId, users.id))
    .where(eq(users.id, userId))
    .groupBy(users.id);

  return row ? { ...row, balance: Number(row.balance) } : null;
}

export type TransactionSort = 'time' | 'amount' | 'reason';

/** The per-user drill-down (UX Mock-Up 1), sortable by time/amount/reason. */
export async function listUserTransactions(userId: string, sort: TransactionSort = 'time') {
  const order =
    sort === 'amount'
      ? desc(transactions.amount)
      : sort === 'reason'
        ? asc(transactions.reason)
        : desc(transactions.createdAt);

  return db
    .select()
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .orderBy(order)
    .limit(200);
}

export async function listGames() {
  return db.select().from(games).orderBy(asc(games.tier), asc(games.displayName));
}

export async function listAchievementsForGame(gameId: string) {
  return db
    .select()
    .from(achievements)
    .where(eq(achievements.gameId, gameId))
    .orderBy(asc(achievements.value));
}

/**
 * Daily leaderboard history, newest day first, with the display name joined in so the
 * page does not resolve users one row at a time.
 */
export async function listLeaderboardHistory(limit = 200) {
  return db
    .select({
      id: dailyLeaderboardEntries.id,
      gameId: dailyLeaderboardEntries.gameId,
      gameDate: dailyLeaderboardEntries.gameDate,
      score: dailyLeaderboardEntries.score,
      submittedVia: dailyLeaderboardEntries.submittedVia,
      userId: dailyLeaderboardEntries.userId,
      displayName: users.displayName,
    })
    .from(dailyLeaderboardEntries)
    .innerJoin(users, eq(users.id, dailyLeaderboardEntries.userId))
    .orderBy(desc(dailyLeaderboardEntries.gameDate), desc(dailyLeaderboardEntries.score))
    .limit(limit);
}

export async function listBotLogEvents(limit = 200) {
  return db
    .select()
    .from(botLogEvents)
    .orderBy(desc(botLogEvents.createdAt))
    .limit(limit);
}

export async function listContentItems() {
  return db.select().from(contentItems).orderBy(desc(contentItems.createdAt));
}

export interface AdminAnalytics {
  mostPlayed: Array<{ gameId: string; displayName: string; plays: number }>;
  participation: Array<{ gameId: string; gameDate: string; submitters: number }>;
  firstPlaces: Array<{ userId: string; displayName: string; wins: number }>;
}

/**
 * The Analytics page (FR-5.x). Three aggregates, three queries — deliberately not one
 * mega-query, since they group by different things and a union would be less readable
 * for no round-trip saving worth the trade.
 */
export async function getAnalytics(): Promise<AdminAnalytics> {
  // "Most played" counts spend transactions rather than score submissions: a play is
  // paid for at start (FR-4.1), whereas not every play produces a submitted score.
  //
  // Joined on the reason string because `transactions` has no `game_id` column — the
  // ledger is deliberately game-agnostic (ADR-2). `spendTokens()` builds that string
  // deterministically as "{Tier}: {Display Name}", so this reconstructs it and matches
  // exactly rather than guessing with a LIKE wildcard, which would mis-attribute one
  // game whose name is a suffix of another's.
  //
  // The coupling is real but narrow: if that copy convention changes, this count silently
  // goes to zero. A `transactions.game_id` column would be the durable fix and is worth
  // revisiting if analytics grows past this page.
  const mostPlayed = await db
    .select({
      gameId: games.id,
      displayName: games.displayName,
      plays: sql<number>`count(${transactions.id})`,
    })
    .from(games)
    .leftJoin(
      transactions,
      and(
        eq(transactions.source, 'cabinet_spend'),
        sql`${transactions.reason} = initcap(${games.tier}) || ': ' || ${games.displayName}`,
      ),
    )
    .groupBy(games.id, games.displayName)
    .orderBy(desc(sql`count(${transactions.id})`));

  const participation = await db
    .select({
      gameId: dailyLeaderboardEntries.gameId,
      gameDate: dailyLeaderboardEntries.gameDate,
      submitters: sql<number>`count(distinct ${dailyLeaderboardEntries.userId})`,
    })
    .from(dailyLeaderboardEntries)
    .groupBy(dailyLeaderboardEntries.gameId, dailyLeaderboardEntries.gameDate)
    .orderBy(desc(dailyLeaderboardEntries.gameDate))
    .limit(60);

  // Settled top scores are the authoritative record of who won a day — the leaderboard
  // entries alone would require recomputing the 2+-submitter gate per day.
  const firstPlaces = await db
    .select({
      userId: users.id,
      displayName: users.displayName,
      wins: sql<number>`count(${dailyTopScoreSettlements.gameDate})`,
    })
    .from(users)
    .leftJoin(dailyTopScoreSettlements, eq(dailyTopScoreSettlements.userId, users.id))
    .groupBy(users.id, users.displayName)
    .orderBy(desc(sql`count(${dailyTopScoreSettlements.gameDate})`));

  return {
    mostPlayed: mostPlayed.map((r) => ({ ...r, plays: Number(r.plays) })),
    participation: participation.map((r) => ({ ...r, submitters: Number(r.submitters) })),
    firstPlaces: firstPlaces.map((r) => ({ ...r, wins: Number(r.wins) })),
  };
}
