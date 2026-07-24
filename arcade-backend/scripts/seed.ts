import { db } from '../lib/db/client';
import { games } from '../lib/db/schema';

// Seeds the games table from the current arcade site roster (per Arcade Handoff.md
// and src/games/). Costs match PRD FR-4.1 defaults: 1 token for hub cartridges,
// 3 tokens for cabinets. Re-run is safe — onConflictDoNothing skips existing rows.
const ROSTER: Array<{ id: string; displayName: string; tier: 'cartridge' | 'cabinet'; isDaily?: boolean }> = [
  { id: 'dino-run', displayName: 'Dino Run', tier: 'cartridge' },
  { id: '2048', displayName: '2048', tier: 'cartridge' },
  { id: 'token-miner', displayName: 'Token Miner', tier: 'cartridge' },
  { id: 'simon', displayName: 'Simon', tier: 'cartridge' },
  { id: 'memory', displayName: 'Memory', tier: 'cartridge' },
  { id: 'lights-out', displayName: 'Lights Out', tier: 'cartridge' },
  { id: 'snake', displayName: 'Snake', tier: 'cabinet' },
  { id: 'bricks', displayName: 'Bricks', tier: 'cabinet' },
  { id: 'aim-trainer', displayName: 'Aim Trainer', tier: 'cabinet' },
  { id: 'minesweeper', displayName: 'Minesweeper', tier: 'cabinet' },
  { id: 'water-sort', displayName: 'Water Sort', tier: 'cabinet' },
  { id: 'setrit', displayName: 'Setrit', tier: 'cabinet' },
];

async function main() {
  for (const game of ROSTER) {
    await db
      .insert(games)
      .values({
        id: game.id,
        displayName: game.displayName,
        tier: game.tier,
        tokenCost: game.tier === 'cartridge' ? 1 : 3,
        isDaily: game.isDaily ?? false,
      })
      .onConflictDoNothing();
  }
  console.log(`Seeded ${ROSTER.length} games (existing rows skipped).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
