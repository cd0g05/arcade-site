ALTER TABLE "transactions" ADD COLUMN "game_id" text;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transactions_game_id_source_idx" ON "transactions" USING btree ("game_id","source");--> statement-breakpoint
-- Backfill game_id for historical rows.
--
-- Written as part of the same migration that adds the column because the reason strings
-- are the ONLY link between an existing transaction and its game, and this is the last
-- point at which that mapping is guaranteed intact — the whole purpose of the column is
-- to stop depending on those strings, so a later backfill would be racing its own fix.
--
-- Each pattern below reconstructs exactly what its writer produces:
--   lib/spend.ts        -> '{Tier}: {Display Name}'   e.g. 'Cabinet: Setrit'
--   lib/leaderboard.ts  -> 'Daily Submission: {Name}', 'Top Score: {Name}', 'Bounty: {Name}'
--   lib/achievements.ts -> 'High Score: {Name}'
-- Unmatched rows keep NULL, which is correct: login, riddle, task, and admin_adjustment
-- rows have no game.
UPDATE transactions t
SET game_id = g.id
FROM games g
WHERE t.game_id IS NULL
  AND (
    (t.source = 'cabinet_spend'
      AND t.reason = initcap(g.tier) || ': ' || g.display_name)
    OR (t.source = 'daily_submission'
      AND t.reason IN ('Daily Submission: ' || g.display_name,
                       'Top Score: ' || g.display_name))
    OR (t.source = 'bounty'
      AND t.reason = 'Bounty: ' || g.display_name)
    OR (t.source = 'achievement'
      AND t.reason = 'High Score: ' || g.display_name)
  );
