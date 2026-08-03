import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../db/client';
import { contentCompletions, contentItems, transactions, users } from '../db/schema';
import {
  completeContentItem,
  countCompletions,
  listContentForUser,
  InactiveContentItemError,
  UnknownContentItemError,
} from '../content';
import { getBalance } from '../ledger';

describe('completeContentItem (FR-3.4: riddles/trivia once per day, tasks unlimited)', () => {
  const stamp = Date.now();
  let userId: string;
  let riddleId: string;
  let triviaId: string;
  let taskId: string;
  let inactiveId: string;

  beforeAll(async () => {
    const [user] = await db
      .insert(users)
      .values({
        googleId: `content-google-${stamp}`,
        email: `content-${stamp}@example.com`,
        displayName: 'Content Test User',
      })
      .returning();
    userId = user.id;

    const items = await db
      .insert(contentItems)
      .values([
        { type: 'riddle', prompt: 'Test riddle', award: 10 },
        { type: 'trivia', prompt: 'Test trivia', award: 8 },
        { type: 'task', prompt: 'Test task', award: 12 },
        { type: 'riddle', prompt: 'Retired riddle', award: 10, active: false },
      ])
      .returning();
    [riddleId, triviaId, taskId, inactiveId] = items.map((i) => i.id);
  });

  afterAll(async () => {
    await db.delete(transactions).where(eq(transactions.userId, userId));
    await db.delete(contentCompletions).where(eq(contentCompletions.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
    await db
      .delete(contentItems)
      .where(inArray(contentItems.id, [riddleId, triviaId, taskId, inactiveId]));
  });

  beforeEach(async () => {
    await db.delete(transactions).where(eq(transactions.userId, userId));
    await db.delete(contentCompletions).where(eq(contentCompletions.userId, userId));
  });

  // tasks.md id:35
  it('awards a riddle once per day and refuses a second same-day attempt', async () => {
    const first = await completeContentItem(userId, riddleId, 'my answer');
    expect(first.status).toBe('awarded');
    if (first.status === 'awarded') {
      expect(first.award).toEqual(
        expect.objectContaining({ amount: 10, source: 'riddle' }),
      );
    }

    const second = await completeContentItem(userId, riddleId, 'another answer');
    expect(second.status).toBe('already_completed_today');

    // Exactly one award, not two.
    expect(await getBalance(userId)).toBe(10);
  });

  it('applies the same once-per-day rule to trivia', async () => {
    expect((await completeContentItem(userId, triviaId, 'a')).status).toBe('awarded');
    expect((await completeContentItem(userId, triviaId, 'b')).status).toBe(
      'already_completed_today',
    );
    expect(await getBalance(userId)).toBe(8);
  });

  // tasks.md id:36
  it('awards a task on every call with no once-per-day restriction', async () => {
    const results = [
      await completeContentItem(userId, taskId, 'first listen'),
      await completeContentItem(userId, taskId, 'second listen'),
      await completeContentItem(userId, taskId, 'third listen'),
    ];

    expect(results.every((r) => r.status === 'awarded')).toBe(true);
    expect(await getBalance(userId)).toBe(36); // 3 x 12
  });

  it('allows the same riddle again on a different day', async () => {
    const day1 = new Date(2026, 4, 10, 12, 0);
    const day2 = new Date(2026, 4, 11, 12, 0);

    expect((await completeContentItem(userId, riddleId, 'a', day1)).status).toBe('awarded');
    expect((await completeContentItem(userId, riddleId, 'b', day1)).status).toBe(
      'already_completed_today',
    );
    expect((await completeContentItem(userId, riddleId, 'c', day2)).status).toBe('awarded');

    expect(await getBalance(userId)).toBe(20);
    expect(await countCompletions(userId, riddleId, '2026-05-10')).toBe(1);
    expect(await countCompletions(userId, riddleId, '2026-05-11')).toBe(1);
  });

  it('does not double-award a riddle under concurrent submissions', async () => {
    const results = await Promise.all([
      completeContentItem(userId, riddleId, 'a'),
      completeContentItem(userId, riddleId, 'b'),
      completeContentItem(userId, riddleId, 'c'),
    ]);

    const awarded = results.filter((r) => r.status === 'awarded');
    expect(awarded).toHaveLength(1);
    expect(await getBalance(userId)).toBe(10);
  });

  it('rejects an unknown content item', async () => {
    await expect(
      completeContentItem(userId, '00000000-0000-0000-0000-000000000000', 'x'),
    ).rejects.toThrow(UnknownContentItemError);
  });

  it('rejects an inactive content item', async () => {
    await expect(completeContentItem(userId, inactiveId, 'x')).rejects.toThrow(
      InactiveContentItemError,
    );
  });

  describe('listContentForUser', () => {
    it('flags completed riddles but never flags repeatable tasks', async () => {
      await completeContentItem(userId, riddleId, 'answer');
      await completeContentItem(userId, taskId, 'done');

      const list = await listContentForUser(userId);
      const byId = new Map(list.map((i) => [i.id, i]));

      expect(byId.get(riddleId)?.completedToday).toBe(true);
      expect(byId.get(taskId)?.completedToday).toBe(false);
      expect(byId.get(triviaId)?.completedToday).toBe(false);
    });

    it('omits inactive items', async () => {
      const list = await listContentForUser(userId);
      expect(list.map((i) => i.id)).not.toContain(inactiveId);
    });
  });
});
