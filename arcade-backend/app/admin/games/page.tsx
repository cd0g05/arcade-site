import Link from 'next/link';
import { listAchievementsForGame, listGames } from '@/lib/admin';
import { AchievementBuilder, type AchievementRow } from './AchievementBuilder';
import { GameConfigRow } from './GameConfigRow';

/**
 * Games config + Achievement Builder (tasks.md ids 64-66).
 *
 * The selected game is a search param so the builder swaps in place, matching the Users
 * page's drill-down pattern rather than introducing a second navigation model.
 */
export default async function GamesPage({
  searchParams,
}: {
  searchParams: Promise<{ game?: string }>;
}) {
  const params = await searchParams;
  const games = await listGames();
  const selectedId = params.game ?? games[0]?.id;
  const selected = games.find((g) => g.id === selectedId);

  const criteria = selected
    ? ((await listAchievementsForGame(selected.id)) as AchievementRow[])
    : [];

  return (
    <div className="stack">
      <section className="panel">
        <h2 className="panel-heading">Games</h2>
        {games.length === 0 ? (
          <p className="empty">No games seeded yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Game</th>
                <th>Tier</th>
                <th>Cost</th>
                <th>Default top-score award</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {games.map((game) => (
                <GameConfigRow
                  key={game.id}
                  gameId={game.id}
                  displayName={game.displayName}
                  tier={game.tier}
                  tokenCost={game.tokenCost}
                  defaultTopScoreAward={game.defaultTopScoreAward}
                />
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <h2 className="panel-heading">
          Achievement Builder{selected ? ` — ${selected.displayName}` : ''}
        </h2>

        {games.length > 0 ? (
          <p>
            {games.map((game) => (
              <Link
                key={game.id}
                href={`/admin/games?game=${game.id}`}
                className={`sort-link${game.id === selectedId ? ' active' : ''}`}
                style={{ marginRight: '0.75rem' }}
              >
                {game.displayName}
              </Link>
            ))}
          </p>
        ) : null}

        {selected ? (
          <AchievementBuilder
            key={selected.id}
            gameId={selected.id}
            initialRows={criteria}
          />
        ) : (
          <p className="empty">Seed a game to configure achievements.</p>
        )}
      </section>
    </div>
  );
}
