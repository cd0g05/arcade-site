import { handle, jsonBody, requireSession, HttpError } from '@/lib/api-auth';
import { ContentCompleteRequestSchema } from '@/lib/api-schemas';
import { handlePreflight } from '@/lib/cors';
import {
  completeContentItem,
  UnknownContentItemError,
  InactiveContentItemError,
} from '@/lib/content';

/**
 * POST /api/content/complete — tasks.md id:48. Auth: user session.
 *
 * `already_completed_today` is a 200, not an error status: it is an expected outcome of
 * the once-per-day rule for riddles/trivia (tasks repeat without limit), and the contract
 * models it as `{ ok: false, ... }` in the success body.
 */
export async function POST(req: Request) {
  return handle(req, async () => {
    const { userId } = await requireSession();
    const body = ContentCompleteRequestSchema.parse(await jsonBody(req));

    try {
      const result = await completeContentItem(
        userId,
        body.contentItemId,
        body.answerText,
      );

      if (result.status === 'already_completed_today') {
        return Response.json({ ok: false, error: 'already_completed_today' });
      }
      return Response.json({ ok: true, awarded: result.award.amount });
    } catch (e) {
      if (e instanceof UnknownContentItemError) {
        throw new HttpError(404, { ok: false, error: 'unknown_content_item' });
      }
      if (e instanceof InactiveContentItemError) {
        throw new HttpError(400, { ok: false, error: 'inactive_content_item' });
      }
      throw e;
    }
  });
}

export const OPTIONS = handlePreflight;
