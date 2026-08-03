/**
 * tokenGames.ts — the map between this site's local game identifiers and the backend's
 * `games` table slugs.
 *
 * Three different identifiers exist for the same game and none of them agree:
 *   - `hubId`     — what `Hub.register(id, ...)` uses on this site
 *   - `bestKey`   — the localStorage key the game writes its personal best to (ADR-4)
 *   - `slug`      — the backend `games.id`, seeded in arcade-backend/scripts/seed.ts
 *
 * Keeping the translation in one table rather than scattering string literals means a
 * mismatch is a visible gap here instead of a silently-unattributed transaction.
 *
 * Two slugs deliberately disagree with the site's name, both because the backend was
 * seeded before a rename landed and `games.id` is an FK target that cannot be changed
 * without orphaning existing plays:
 *   - ECHO is seeded as `simon` (renamed off the live Hasbro mark before launch)
 *   - TETRISIO is seeded as `setrit` (renamed in commit 2010c29)
 * Both mappings are unambiguous. The backend's *display* names are reconciled in
 * scripts/seed.ts; only the ids are frozen.
 */
export interface TokenGame {
  hubId: string;
  /** localStorage key holding the personal best, or null when the game keeps no score. */
  bestKey: string | null;
  slug: string;
}

export const TOKEN_GAMES: readonly TokenGame[] = [
  // hub cartridges
  { hubId: 'dino', bestKey: 'best:dino', slug: 'dino-run' },
  { hubId: 'g2048', bestKey: 'best:2048', slug: '2048' },
  { hubId: 'miner', bestKey: null, slug: 'token-miner' },
  { hubId: 'echo', bestKey: 'best:echo', slug: 'simon' },
  { hubId: 'memory', bestKey: 'best:memory', slug: 'memory' },
  { hubId: 'lightsout', bestKey: 'best:lightsout', slug: 'lights-out' },
  // cabinets
  { hubId: 'snake', bestKey: 'best:snake', slug: 'snake' },
  { hubId: 'bricks', bestKey: 'best:bricks', slug: 'bricks' },
  { hubId: 'aim', bestKey: 'best:aim', slug: 'aim-trainer' },
  // Minesweeper stores per-difficulty times and Water Sort stores a level, neither of
  // which is a "score" the backend's high-score model can compare. They still cost
  // tokens to play; they just never submit.
  { hubId: 'minesweeper', bestKey: null, slug: 'minesweeper' },
  { hubId: 'water-sort', bestKey: null, slug: 'water-sort' },
  // The site renamed Setrit -> Tetrisio (commit 2010c29) after the backend was seeded.
  // hubId and bestKey follow the site; slug deliberately does NOT — `games.id` is the
  // FK target for live `transactions` and `high_scores` rows, so renaming it would
  // orphan every Setrit play already recorded. Only the backend's display name moved.
  // The game itself reads `best:setrit` as a fallback but writes `best:tetrisio`, so
  // observing the new key is correct.
  { hubId: 'tetrisio', bestKey: 'best:tetrisio', slug: 'setrit' },
];

const BY_HUB_ID = new Map(TOKEN_GAMES.map((g) => [g.hubId, g]));
const BY_BEST_KEY = new Map(
  TOKEN_GAMES.filter((g) => g.bestKey).map((g) => [g.bestKey as string, g]),
);

export function gameByHubId(hubId: string): TokenGame | undefined {
  return BY_HUB_ID.get(hubId);
}

export function gameByBestKey(key: string): TokenGame | undefined {
  return BY_BEST_KEY.get(key);
}
