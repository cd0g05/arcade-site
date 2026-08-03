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
 * NOTE — the sequence game is titled "ECHO" on this site and seeded as `simon`
 * ("Simon") in the backend. The mapping is unambiguous (there is only one such game),
 * but the two names should probably be reconciled; flagged for the Builder.
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
  { hubId: 'setrit', bestKey: 'best:setrit', slug: 'setrit' },
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
