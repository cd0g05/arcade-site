import { handle, jsonBody, requireBotKey } from '@/lib/api-auth';
import { BotLogRequestSchema } from '@/lib/api-schemas';
import { db } from '@/lib/db/client';
import { botLogEvents } from '@/lib/db/schema';

/**
 * POST /api/bot/log — tasks.md id:55. Auth: service API key only.
 *
 * Ingest for the bot action log (FR-5.4). Not in the original route list for this
 * partition: the `bot_log_events` table and Partition 4's read-only view of it were both
 * planned, but nothing was specified to write to it, so the admin page would have shown a
 * permanently empty feed.
 *
 * `payload` is stored as opaque jsonb — this is a debugging/audit feed, so the bot decides
 * what is worth recording per event type rather than the backend prescribing a shape.
 *
 * No CORS handling: server-to-server only.
 */
export async function POST(req: Request) {
  return handle(req, async () => {
    requireBotKey(req);
    const body = BotLogRequestSchema.parse(await jsonBody(req));

    const [row] = await db
      .insert(botLogEvents)
      .values({ eventType: body.eventType, payload: body.payload })
      .returning({ id: botLogEvents.id });

    return Response.json({ ok: true, id: row.id });
  });
}
