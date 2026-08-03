/**
 * zod request/response schemas for every route (tasks.md id:49).
 *
 * Kept in one file rather than beside each handler so the published contract in
 * docs/discord-bot-api.md has a single place to stay honest against — the bot is built
 * separately, so drift between doc and validation is the likely failure mode.
 */
import { z } from 'zod';

const gameId = z.string().min(1).max(64);
/** `YYYY-MM-DD`, matching lib/leaderboard.ts `dayBucket()` and the `date` columns. */
const gameDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');
const uuid = z.string().uuid();

// --- requests ---------------------------------------------------------------

export const SpendRequestSchema = z.object({ gameId });

/**
 * Note there is deliberately no "userId or discordId is required" refinement here: a
 * session-authenticated submission supplies neither (the subject is the session's own
 * user, and a body `userId` is ignored so nobody can submit as someone else). The
 * requirement applies only to the bot path, so the route enforces it there.
 */
export const ScoreSubmitRequestSchema = z.object({
  userId: uuid.optional(),
  discordId: z.string().min(1).optional(),
  gameId,
  // Non-negative integer: the ledger and high-score comparisons assume whole numbers,
  // and a negative "score" would corrupt interval-gap watermarks.
  score: z.number().int().min(0),
  isDailySubmission: z.boolean().optional().default(false),
});

export const BountySetRequestSchema = z.object({
  gameId,
  gameDate,
  amount: z.number().int().positive(),
});

export const ContentCompleteRequestSchema = z.object({
  contentItemId: uuid,
  // Accepted at face value — there is no automated answer verification in this
  // initiative (schema.ts `content_completions.answer_text`).
  answerText: z.string().min(1).max(2000),
});

export const BotLogRequestSchema = z.object({
  // Not a closed enum: FR-5.4's log is a debugging aid, and rejecting an event type the
  // bot invented would lose exactly the information the log exists to capture.
  eventType: z.string().min(1).max(64),
  payload: z.record(z.unknown()).default({}),
});

export const SettleDailyRequestSchema = z.object({
  /** Defaults to the day that just closed — see app/api/cron/settle-daily/route.ts. */
  gameDate: gameDate.optional(),
});

// --- query params -----------------------------------------------------------

export const BountyPendingQuerySchema = z.object({
  gameId,
  date: gameDate.optional(),
});

export const ByDiscordIdQuerySchema = z.object({
  discordId: z.string().min(1),
});

// --- responses --------------------------------------------------------------
// Response schemas are the contract the separately-built Discord bot codes against.
// They are exported for tests and doc generation, not used to strip handler output.

export const TransactionSchema = z.object({
  id: uuid,
  amount: z.number().int(),
  reason: z.string(),
  source: z.string(),
  createdAt: z.union([z.string(), z.date()]),
});

export const BalanceResponseSchema = z.object({
  balance: z.number().int(),
  recent: z.array(TransactionSchema),
});

export const AwardSchema = z.object({
  amount: z.number().int(),
  reason: z.string(),
  source: z.string(),
});

export const SpendResponseSchema = z.union([
  z.object({ ok: z.literal(true), newBalance: z.number().int() }),
  z.object({
    ok: z.literal(false),
    error: z.literal('insufficient_balance'),
    required: z.number().int(),
    balance: z.number().int(),
  }),
]);

export const ScoreSubmitResponseSchema = z.object({
  recorded: z.literal(true),
  awards: z.array(AwardSchema),
});

export const BountyPendingResponseSchema = z.union([
  z.object({
    pending: z.literal(true),
    gameId: z.string(),
    gameDate: z.string(),
  }),
  z.object({ pending: z.literal(false) }),
]);

export const ByDiscordIdResponseSchema = z.object({
  userId: uuid,
  displayName: z.string(),
});

export const ContentListResponseSchema = z.object({
  items: z.array(
    z.object({
      id: uuid,
      type: z.enum(['riddle', 'trivia', 'task']),
      prompt: z.string(),
      award: z.number().int(),
      completedToday: z.boolean(),
    }),
  ),
});

export const ContentCompleteResponseSchema = z.union([
  z.object({ ok: z.literal(true), awarded: z.number().int() }),
  z.object({ ok: z.literal(false), error: z.literal('already_completed_today') }),
]);
