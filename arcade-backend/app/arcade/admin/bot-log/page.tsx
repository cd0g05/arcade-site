import { listBotLogEvents } from '@/lib/admin';

/**
 * Read-only feed of bot-originated events (tasks.md id:68, FR-5.4).
 *
 * Deliberately has no write controls — the bot is the only writer, via
 * `POST /api/bot/log`. This is a debugging/audit surface, so an admin editing it would
 * defeat the point.
 */
export default async function BotLogPage() {
  const events = await listBotLogEvents();

  return (
    <section className="panel">
      <h2 className="panel-heading">Bot Log</h2>
      {events.length === 0 ? (
        <p className="empty">
          No bot events yet. The Discord bot writes these via POST /api/bot/log.
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Event</th>
              <th>Payload</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td>
                  {new Date(event.createdAt).toISOString().slice(0, 16).replace('T', ' ')}
                </td>
                <td>{event.eventType}</td>
                <td>
                  <pre className="pre">{JSON.stringify(event.payload)}</pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
