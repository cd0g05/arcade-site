import { and, eq, sql } from 'drizzle-orm';
import { db } from './db/client';
import { contentCompletions, contentItems } from './db/schema';
import { recordContentCompletion, type AwardResult } from './ledger';
import { dayBucket } from './leaderboard';

/**
 * Riddle / trivia / task completion (PRD FR-3.4).
 *
 * Riddles and trivia award once per day per item; tasks are unlimited. Answers are accepted
 * at face value — FR-3.4 explicitly specifies no automated verification, so there is no
 * grading here, only recording.
 *
 * Content authoring is out of scope for this initiative (rows are seeded directly), so this
 * module reads `content_items` but never writes them.
 */

export type ContentItemType = 'riddle' | 'trivia' | 'task';

/** Item types restricted to one award per day. Tasks are deliberately absent. */
const ONCE_PER_DAY_TYPES: ReadonlySet<ContentItemType> = new Set(['riddle', 'trivia']);

export class UnknownContentItemError extends Error {
  constructor(contentItemId: string) {
    super(`Unknown content item: ${contentItemId}`);
    this.name = 'UnknownContentItemError';
  }
}

export class InactiveContentItemError extends Error {
  constructor(contentItemId: string) {
    super(`Content item is not active: ${contentItemId}`);
    this.name = 'InactiveContentItemError';
  }
}

export type CompleteContentResult =
  | { status: 'awarded'; award: AwardResult }
  | { status: 'already_completed_today' };

/**
 * Records a completion and awards its tokens.
 *
 * For riddles/trivia the once-per-day guarantee is enforced by the partial unique index
 * `content_completions_once_per_day_uniq` via `recordContentCompletion()`, not by a
 * read-then-write check here — so a double-submitted answer cannot award twice.
 */
export async function completeContentItem(
  userId: string,
  contentItemId: string,
  answerText: string,
  now: Date = new Date(),
): Promise<CompleteContentResult> {
  const [item] = await db
    .select()
    .from(contentItems)
    .where(eq(contentItems.id, contentItemId));

  if (!item) throw new UnknownContentItemError(contentItemId);
  if (!item.active) throw new InactiveContentItemError(contentItemId);

  const type = item.type as ContentItemType;
  const oncePerDay = ONCE_PER_DAY_TYPES.has(type);
  const completedDate = dayBucket(now);

  // Ledger `source` has no 'trivia' member — trivia is a riddle variant for accounting
  // purposes, which keeps the transaction-source enum aligned with the PRD's earn
  // categories rather than mirroring every content type.
  const source = type === 'task' ? 'task' : 'riddle';
  const reason = `${capitalize(type)} Completed`;

  const { completed } = await recordContentCompletion({
    userId,
    contentItemId,
    answerText,
    completedDate,
    oncePerDay,
    amount: item.award,
    reason,
    source,
  });

  if (!completed) return { status: 'already_completed_today' };

  return {
    status: 'awarded',
    award: { amount: item.award, reason, source },
  };
}

/**
 * Lists active content with a per-item `completedToday` flag — the shape
 * `GET /api/content` returns (built in feat/api-and-bot-contract).
 */
export async function listContentForUser(userId: string, now: Date = new Date()) {
  const today = dayBucket(now);

  const items = await db
    .select()
    .from(contentItems)
    .where(eq(contentItems.active, true));

  const completions = await db
    .select({ contentItemId: contentCompletions.contentItemId })
    .from(contentCompletions)
    .where(
      and(
        eq(contentCompletions.userId, userId),
        eq(contentCompletions.completedDate, today),
      ),
    );
  const completedIds = new Set(completions.map((c) => c.contentItemId));

  return items.map((item) => ({
    id: item.id,
    type: item.type,
    prompt: item.prompt,
    award: item.award,
    // Tasks are repeatable, so "completed today" is never a reason to disable them.
    completedToday:
      ONCE_PER_DAY_TYPES.has(item.type as ContentItemType) && completedIds.has(item.id),
  }));
}

/** Counts a user's completions of one item on a given day. Used by tests. */
export async function countCompletions(
  userId: string,
  contentItemId: string,
  onDate: string,
): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(contentCompletions)
    .where(
      and(
        eq(contentCompletions.userId, userId),
        eq(contentCompletions.contentItemId, contentItemId),
        eq(contentCompletions.completedDate, onDate),
      ),
    );
  return Number(row?.count ?? 0);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
