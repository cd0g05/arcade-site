import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  date,
  jsonb,
  primaryKey,
  unique,
  index,
} from 'drizzle-orm/pg-core';

// See .cicadas/active/token-system/tech-design.md "Data Models" for the source of truth
// this schema implements. Every table here maps 1:1 to that section.

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  googleId: text('google_id').notNull().unique(),
  discordId: text('discord_id').unique(), // nullable — optional link, FR-1.2
  displayName: text('display_name').notNull(),
  email: text('email').notNull(),
  isAdmin: boolean('is_admin').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  lastActiveAt: timestamp('last_active_at').notNull().defaultNow(),
});

// Ledger-only balance model (ADR-2): there is no `balance` column anywhere.
// Balance is always SUM(transactions.amount) for a user — see lib/ledger.ts.
export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    amount: integer('amount').notNull(), // signed
    reason: text('reason').notNull(), // e.g. "High Score: Dino Run"
    source: text('source', {
      enum: [
        'login',
        'high_score',
        'achievement',
        'riddle',
        'task',
        'daily_submission',
        'cabinet_spend',
        'admin_adjustment',
        'bounty',
      ],
    }).notNull(),
    actorUserId: uuid('actor_user_id').references(() => users.id), // set for admin_adjustment
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    userTimeIdx: index('transactions_user_id_created_at_idx').on(t.userId, t.createdAt),
  }),
);

export const games = pgTable('games', {
  id: text('id').primaryKey(), // slug, e.g. "dino-run"
  displayName: text('display_name').notNull(),
  tier: text('tier', { enum: ['cartridge', 'cabinet'] }).notNull(),
  tokenCost: integer('token_cost').notNull(),
  isDaily: boolean('is_daily').notNull().default(false),
  // FR-3.3 / PRD Open Questions resolution: flat default award to the top scorer
  // when 2+ people submit a score for a daily game and Carter hasn't posted his
  // own score (i.e. no bounty was set) that day.
  defaultTopScoreAward: integer('default_top_score_award').notNull().default(10),
});

// ADR-5: current_high_score and last_awarded_high_score are tracked separately so
// interval-gap achievements can update the displayed high score without re-triggering
// an award until the score exceeds last_awarded_high_score + gap.
export const highScores = pgTable(
  'high_scores',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    gameId: text('game_id')
      .notNull()
      .references(() => games.id),
    currentHighScore: integer('current_high_score').notNull(),
    lastAwardedHighScore: integer('last_awarded_high_score').notNull().default(0),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.userId, t.gameId] }) }),
);

export const achievements = pgTable('achievements', {
  id: uuid('id').primaryKey().defaultRandom(),
  gameId: text('game_id')
    .notNull()
    .references(() => games.id),
  mode: text('mode', { enum: ['threshold', 'interval_gap'] }).notNull(),
  value: integer('value').notNull(), // threshold score, or gap amount
  award: integer('award').notNull(),
  active: boolean('active').notNull().default(true),
});

// ADR-3: idempotent one-time awards via a uniqueness constraint, not application-level
// locking. Awarding is INSERT ... ON CONFLICT DO NOTHING paired with the ledger write
// in the same DB transaction — a conflict means "already awarded."
export const achievementAwards = pgTable(
  'achievement_awards',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    achievementId: uuid('achievement_id')
      .notNull()
      .references(() => achievements.id),
    awardedAt: timestamp('awarded_at').notNull().defaultNow(),
  },
  (t) => ({ uniq: unique().on(t.userId, t.achievementId) }),
);

export const dailyLeaderboardEntries = pgTable('daily_leaderboard_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  gameId: text('game_id')
    .notNull()
    .references(() => games.id),
  score: integer('score').notNull(),
  submittedVia: text('submitted_via', { enum: ['site', 'bot'] }).notNull(),
  gameDate: date('game_date').notNull(), // midnight-cutoff day bucket
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const bounties = pgTable('bounties', {
  id: uuid('id').primaryKey().defaultRandom(),
  gameId: text('game_id')
    .notNull()
    .references(() => games.id),
  gameDate: date('game_date').notNull(),
  amount: integer('amount'), // null until Carter sets it
  claimedByUserId: uuid('claimed_by_user_id').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const botLogEvents = pgTable('bot_log_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventType: text('event_type').notNull(), // "score_submitted" | "bounty_set" | "message_posted"
  payload: jsonb('payload').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Riddle/trivia/task infrastructure (FR-3.4). Content authoring UI is explicitly
// out of scope for this initiative — rows are seeded directly (see scripts/seed.ts)
// until Carter builds an authoring surface later. The awarding mechanic must work
// end-to-end against whatever rows exist.
export const contentItems = pgTable('content_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: text('type', { enum: ['riddle', 'trivia', 'task'] }).notNull(),
  prompt: text('prompt').notNull(),
  award: integer('award').notNull().default(10), // flat per FR-3.4
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const contentCompletions = pgTable(
  'content_completions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    contentItemId: uuid('content_item_id')
      .notNull()
      .references(() => contentItems.id),
    answerText: text('answer_text').notNull(), // accepted at face value, no automated verification
    completedDate: date('completed_date').notNull(), // once-per-day enforcement for riddle/trivia
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    // Enforces "riddles/trivia award once per day" (FR-3.4). Tasks are exempt at the
    // application level (lib/content.ts only checks this index for type in
    // ('riddle','trivia')) rather than via a DB constraint, since a partial unique
    // index keyed on type would need conditional logic Drizzle expresses more awkwardly
    // than a plain lookup index + application-level check.
    lookupIdx: index('content_completions_user_item_date_idx').on(
      t.userId,
      t.contentItemId,
      t.completedDate,
    ),
  }),
);
