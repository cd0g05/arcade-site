import { handle, requireSession } from '@/lib/api-auth';
import { handlePreflight } from '@/lib/cors';
import { listContentForUser } from '@/lib/content';

/**
 * GET /api/content — tasks.md id:47. Auth: user session.
 *
 * Returns an empty `items` array at launch, which is the expected state: content rows are
 * seeded directly and no authoring endpoints exist in this initiative (a deliberate scope
 * cut, PRD Open Questions).
 */
export async function GET(req: Request) {
  return handle(req, async () => {
    const { userId } = await requireSession();
    const items = await listContentForUser(userId);
    return Response.json({ items });
  });
}

export const OPTIONS = handlePreflight;
