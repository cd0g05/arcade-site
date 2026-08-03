import { getAnalytics } from '@/lib/admin';

/** Basic analytics (tasks.md id:69): most-played, participation counts, first places. */
export default async function AnalyticsPage() {
  const { mostPlayed, participation, firstPlaces } = await getAnalytics();

  return (
    <div className="stack">
      <section className="panel">
        <h2 className="panel-heading">Most Played</h2>
        {mostPlayed.length === 0 ? (
          <p className="empty">No games seeded yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Game</th>
                <th>Paid plays</th>
              </tr>
            </thead>
            <tbody>
              {mostPlayed.map((row) => (
                <tr key={row.gameId}>
                  <td>{row.displayName}</td>
                  <td>{row.plays}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="empty" style={{ paddingBottom: 0 }}>
          Counts paid starts, not score submissions — free games always read zero.
        </p>
      </section>

      <section className="panel">
        <h2 className="panel-heading">Daily Participation</h2>
        {participation.length === 0 ? (
          <p className="empty">No daily submissions yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Game</th>
                <th>Distinct submitters</th>
              </tr>
            </thead>
            <tbody>
              {participation.map((row) => (
                <tr key={`${row.gameId}-${row.gameDate}`}>
                  <td>{row.gameDate}</td>
                  <td>{row.gameId}</td>
                  <td>{row.submitters}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <h2 className="panel-heading">First Places</h2>
        {firstPlaces.length === 0 ? (
          <p className="empty">No users yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th>Days won</th>
              </tr>
            </thead>
            <tbody>
              {firstPlaces.map((row) => (
                <tr key={row.userId}>
                  <td>{row.displayName}</td>
                  <td>{row.wins}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="empty" style={{ paddingBottom: 0 }}>
          Counts settled top-score awards, so a day only appears once the cron has settled
          it.
        </p>
      </section>
    </div>
  );
}
