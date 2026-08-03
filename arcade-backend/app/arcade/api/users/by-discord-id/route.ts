import { handle, requireBotKey, resolveDiscordId } from '@/lib/api-auth';
import { ByDiscordIdQuerySchema } from '@/lib/api-schemas';
import { handlePreflight } from '@/lib/cors';

/**
 * GET /api/users/by-discord-id?discordId= — tasks.md id:46. Auth: service API key only.
 *
 * 404 is the expected answer for an unlinked Discord user, not an error condition —
 * linking is optional (nullable `users.discord_id`), so the bot uses this to decide
 * whether to prompt someone to link their account.
 */
export async function GET(req: Request) {
  return handle(req, async () => {
    requireBotKey(req);

    const url = new URL(req.url);
    const query = ByDiscordIdQuerySchema.parse({
      discordId: url.searchParams.get('discordId') ?? undefined,
    });

    const user = await resolveDiscordId(query.discordId);
    return Response.json({ userId: user.id, displayName: user.displayName });
  });
}

export const OPTIONS = handlePreflight;
