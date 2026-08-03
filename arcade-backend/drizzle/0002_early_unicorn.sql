CREATE TABLE "daily_top_score_settlements" (
	"game_id" text NOT NULL,
	"game_date" date NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"from_bounty" boolean NOT NULL,
	"settled_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "daily_top_score_settlements_game_id_game_date_pk" PRIMARY KEY("game_id","game_date")
);
--> statement-breakpoint
ALTER TABLE "daily_top_score_settlements" ADD CONSTRAINT "daily_top_score_settlements_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_top_score_settlements" ADD CONSTRAINT "daily_top_score_settlements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;