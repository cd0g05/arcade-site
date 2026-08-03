import { listLeaderboardHistory } from '@/lib/admin';
import { LeaderboardEntryRow } from './LeaderboardEntryRow';

/** Daily leaderboard history with entry edit/delete (tasks.md id:67). */
export default async function LeaderboardsPage() {
  const entries = await listLeaderboardHistory();

  return (
    <section className="panel">
      <h2 className="panel-heading">Daily Leaderboards</h2>
      <p className="empty" style={{ padding: 0 }}>
        Editing or deleting an entry does not claw back the participation award already
        paid, and a day whose top-score award has settled cannot be re-settled — correct
        those with a balance adjustment.
      </p>
      {entries.length === 0 ? (
        <p className="empty">No daily submissions yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Game</th>
              <th>Player</th>
              <th>Score</th>
              <th>Via</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <LeaderboardEntryRow
                key={entry.id}
                id={entry.id}
                gameId={entry.gameId}
                gameDate={entry.gameDate}
                displayName={entry.displayName}
                score={entry.score}
                submittedVia={entry.submittedVia}
              />
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
