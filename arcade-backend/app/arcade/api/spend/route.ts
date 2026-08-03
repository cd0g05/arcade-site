import { handle, jsonBody, requireSession, HttpError } from '@/lib/api-auth';
import { SpendRequestSchema } from '@/lib/api-schemas';
import { handlePreflight } from '@/lib/cors';
import { spendTokens, InsufficientBalanceError, UnknownGameError } from '@/lib/spend';

/** POST /api/spend — tasks.md id:42. Auth: user session. */
export async function POST(req: Request) {
  return handle(req, async () => {
    const { userId } = await requireSession();
    const body = SpendRequestSchema.parse(await jsonBody(req));

    try {
      const result = await spendTokens(userId, body.gameId);
      return Response.json({ ok: true, newBalance: result.newBalance });
    } catch (e) {
      if (e instanceof InsufficientBalanceError) {
        // 402 carries `required`/`balance` so the site can render the UX's
        // "Need {N} tokens" veil without a second round trip.
        return Response.json(
          { ok: false, error: 'insufficient_balance', ...e.details },
          { status: 402 },
        );
      }
      if (e instanceof UnknownGameError) {
        throw new HttpError(400, { ok: false, error: 'unknown_game' });
      }
      throw e;
    }
  });
}

export const OPTIONS = handlePreflight;
