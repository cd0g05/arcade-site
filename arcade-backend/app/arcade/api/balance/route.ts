import { handle, requireSession } from '@/lib/api-auth';
import { handlePreflight } from '@/lib/cors';
import { getBalance, getRecentTransactions } from '@/lib/ledger';

/** GET /api/balance — tasks.md id:41. Auth: user session. */
export async function GET(req: Request) {
  return handle(req, async () => {
    const { userId } = await requireSession();
    const [balance, recent] = await Promise.all([
      getBalance(userId),
      getRecentTransactions(userId),
    ]);
    return Response.json({ balance, recent });
  });
}

export const OPTIONS = handlePreflight;
