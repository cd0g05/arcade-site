---
summary: "Foundation-mode task breakdown across the five partitions from approach.md: backend-foundation (schema/auth/ledger) -> economy-engine (achievements/leaderboard) -> {api-and-bot-contract, admin-dashboard} in parallel -> site-integration. No PR tasks injected (lifecycle.json has all pr_boundaries false) — every boundary merges directly. STATUS: Partitions 1, 2, 3 AND 4 are COMPLETE. Partition 1 (feat/backend-foundation, ids 1-17) verified against a live Neon instance. Partition 2 (feat/economy-engine, ids 20-39) implements the full library layer — achievements, leaderboard, spend, login bonus, content — with 45 tests green against live Postgres and 100% stmt/line/function coverage on the five lib modules; two schema deviations are recorded as ids 38-39. Partition 3 (feat/api-and-bot-contract, ids 40-55) implements all 9 HTTP routes, zod schemas, bot service-key auth, CORS allow-listing, the Vercel cron settle trigger, and the published docs/discord-bot-api.md — 34 route tests green, 78 total, next build compiles all routes. THREE BUILDER DECISIONS 2026-07-25: (a) interval-gap achievements keep writing no achievement_awards row — the Partition 2 acceptance criterion was amended to match, no schema change; (b) the daily settle trigger is a Vercel cron hitting /api/cron/settle-daily, added as ids 53-54; (c) partitions 3 and 4 run back to back without pausing. THREE PARTITION 3 DEVIATIONS: migration 0003 adds a unique (game_id, game_date) on bounties (id:56); isValidBotApiKey moved lib/auth.ts -> lib/bot-key.ts (id:57); POST /api/bot/log added as id:55 to make FR-5.4's bot log reachable. Partition 4 (feat/admin-dashboard, ids 60-73) implements the /admin dashboard: guard, Users list + drill-down, balance-adjust confirm flow, Achievement Builder, Games config, Leaderboards, Bot Log, Analytics — server-rendered with server actions, 24 tests (16 server + 8 component). Its deviations: lib/admin.ts + lib/admin-guard.ts added (id:71), the guard re-checked inside every server action since actions are directly-reachable endpoints (id:72), and jsdom/testing-library devDeps wired per-file (id:73). CROSS-CUTTING (ids 80-82, feat/ledger-game-id): transactions.game_id added (migration 0004 + backfill), replacing the analytics reason-string coupling. NEXT: Partition 5 (feat/site-integration) — do NOT change spend reason copy expectations from analytics; that dependency is gone."
phase: "tasks"
when_to_load:
  - "When selecting the next implementation task or reviewing completion state."
  - "When checking partition progress, PR boundaries, or execution sequencing."
depends_on:
  - "prd.md"
  - "ux.md"
  - "tech-design.md"
  - "approach.md"
modules:
  - "arcade-backend/lib"
  - "arcade-backend/app/api"
  - "arcade-backend/app/admin"
  - "src/ui, src/lib"
index:
  partition_one: "## Partition: feat/backend-foundation"
  partition_two: "## Partition: feat/economy-engine"
  partition_three: "## Partition: feat/api-and-bot-contract"
  partition_four: "## Partition: feat/admin-dashboard"
  partition_five: "## Partition: feat/site-integration"
  initiative_boundary: "## Initiative Boundary"
next_section: "## Partition: feat/site-integration"
---

# Tasks: Token System

**Mode:** Foundation (new backend module) for Partitions 1-4; Feature (vertical slice into existing site) for Partition 5.
**PR boundaries:** None — `lifecycle.json` has all `pr_boundaries` false; no `Open PR` tasks are injected anywhere below.

## Partition: feat/backend-foundation

- [x] Scaffold `arcade-backend/` as a Next.js App Router + TypeScript project inside this repo <!-- id: 1 -->
- [x] Add `arcade-backend/vercel.json` (or equivalent project config) scoped to the `arcade-backend/` Root Directory, per Tech Design ADR-1 <!-- id: 2 -->
- [x] Provision a Neon Postgres database via the Vercel Marketplace; wire `DATABASE_URL` into `arcade-backend` env vars <!-- id: 3 --> (Builder provisioned; live instance `ep-solitary-field-aud3q72f-pooler` verified reachable, all 11 tables + `drizzle.__drizzle_migrations` present. NOTE: verified for **local** `.env.local` only — mirroring `DATABASE_URL` into the Vercel project's env vars remains Builder-manual and is covered by task id:99)
- [x] Spike: confirm the Neon serverless driver correctly pools/reuses connections under Vercel Fluid Compute without exhausting Neon's connection limit (flagged risk in tech-design.md and approach.md) <!-- id: 4 --> (PASS — 175 concurrent queries, 0 failures, ≤7 of 112 connections used. `neon-http` is stateless-over-HTTPS + `-pooler` endpoint. Reproducible via `scripts/spike-neon-pooling.ts`; findings in tech-design.md. **Surfaced a new constraint for id:22** — no `db.transaction()` on this driver)
- [x] Write `lib/db/schema.ts` with all tables from Tech Design Data Models: `users`, `transactions`, `games`, `high_scores`, `achievements`, `achievement_awards`, `daily_leaderboard_entries`, `bounties`, `bot_log_events` <!-- id: 5 --> (also includes `content_items`/`content_completions` per the reconciled riddle/task infra decision)
- [x] Generate and apply the initial Drizzle migration against the Neon database <!-- id: 6 --> (migration `drizzle/0000_wooden_paladin.sql` generated and applied; `drizzle-kit check` reports "Everything's fine", confirming schema.ts and the live DB are in sync)
- [x] Implement `lib/ledger.ts` as the sole function permitted to write `transactions` rows (ADR-2) <!-- id: 7 -->
- [x] Unit test: balance computed via `SUM(transactions.amount)` matches the sum of a sequence of ledger writes for a test user <!-- id: 8 --> (`lib/__tests__/ledger.test.ts` — **now green against the live Neon instance**: 2/2 passing, no longer blocked on id:3)
- [x] Configure Auth.js with the Google OAuth provider; verify `/api/auth/signin` redirects to Google's consent screen <!-- id: 9 --> (**live redirect now verified**: `POST /api/auth/signin/google` after a CSRF handshake returns `302` → `accounts.google.com/o/oauth2/v2/auth` with the correct `client_id`, `redirect_uri`, and PKCE `code_challenge`. Required fixing a missing `AUTH_SECRET` — see id:14)
- [x] Stub the Discord OAuth provider in Auth.js config for later account-linking (full linking UX lands in `feat/site-integration`) <!-- id: 10 -->
- [x] Write a seed script populating the `games` table from the existing hub cartridge/cabinet roster with correct tier + token cost (1 cartridge / 3 cabinet, per PRD FR-4.1 defaults) <!-- id: 11 --> (`scripts/seed.ts` — **now run against the live Neon instance**: all 12 games present with correct tier/cost (6 cartridge @1, 6 cabinet @3); re-run confirmed idempotent via `onConflictDoNothing`)
- [x] Add a `GET /api/health` route returning `200`, for use as the partition's ready-check <!-- id: 12 --> (verified live against the running dev server: `200` / `{"ok":true}`)
- [x] Reflect: update `tech-design.md`/`approach.md` "NEEDS MANUAL REVIEW" markers with the actual confirmed `npm run dev` script name and port once scaffolded <!-- id: 13 -->
- [x] Add the missing `AUTH_SECRET` env var (required by Auth.js v5; absent from the env template, so every `/api/auth/*` route returned `500`) — documented in `.env.example` + README step 6, set locally <!-- id: 14 --> (discovered while verifying id:9)
- [x] Create the missing `arcade-backend/.env.example` — it was referenced by README, `lib/db/client.ts`, and `lib/db/migrate.ts` but never existed <!-- id: 15 --> (discovered while verifying id:9)
- [x] Fix root `.gitignore` silently ignoring `.env.example` via the blanket `.env.*` rule — added an `!.env.example` negation so the template is actually committable <!-- id: 16 --> (discovered while creating id:15)
- [x] Centralize env loading in `lib/load-env.ts` for non-Next entrypoints (tsx scripts, drizzle-kit, Vitest `setupFiles`) and remove `dotenv` from `lib/db/client.ts` <!-- id: 17 --> (`next build` was logging `injected env (0) from ../../../../ROOT/arcade-backend/.env.local` — the bundled `__dirname` resolved a nonsense path. Next.js loads `.env*` natively, so app code must not call dotenv. Verified after: `tsc`, `vitest`, `drizzle-kit check`, `db:migrate`, `db:seed`, `next build`, and the id:4 spike all pass; bogus path gone from build output)

## Partition: feat/economy-engine

- [x] Implement `lib/achievements.ts` threshold-mode evaluation: award once when score first crosses a fixed value <!-- id: 20 --> (`lib/achievements.ts` `evaluateScoreSubmission`; awards once via `awardAchievement()`'s unique-constraint CTE)
- [x] Implement `lib/achievements.ts` interval-gap-mode evaluation, reading/writing `high_scores.last_awarded_high_score` distinctly from `current_high_score` (ADR-5) <!-- id: 21 --> (reads/writes `high_scores.last_awarded_high_score` distinctly from `current_high_score` per ADR-5; one submission clearing several gap multiples awards each exactly once)
- [x] Implement idempotent award insertion via `(user_id, achievement_id)` unique constraint + `ON CONFLICT DO NOTHING`, paired with the ledger write in one DB transaction (ADR-3) <!-- id: 22 --> (**deviation forced by the id:4 driver constraint** — `db.transaction()` is unavailable on neon-http, so this is a single-statement data-modifying CTE in `lib/ledger.ts` `awardAchievement()`, keeping ADR-2's sole-writer rule intact. Repeatable interval-gap awards can't use the once-ever `(user_id, achievement_id)` constraint, so they're guarded by a compare-and-set on the watermark instead)
- [x] Unit test: scoring 1050 after a `last_awarded_high_score` of 1000 with gap 100 produces no award but updates `current_high_score` <!-- id: 23 --> (`achievements.test.ts` — asserts no award, `currentHighScore` 1050, `lastAwardedHighScore` still 1000)
- [x] Unit test: a subsequent score of 1100 in the same scenario produces exactly one award and exactly one `achievement_awards` row <!-- id: 24 --> (`achievements.test.ts` — exactly 1 award and exactly 1 `transactions` row)
- [x] Unit test: calling the same score-evaluation twice with identical input (simulated retry) never double-awards <!-- id: 25 --> (`achievements.test.ts` — sequential replay **and** a 3-way concurrent replay; both yield exactly one award)
- [x] Implement `lib/leaderboard.ts`: midnight-cutoff day bucketing for `daily_leaderboard_entries` <!-- id: 26 --> (`lib/leaderboard.ts` `dayBucket()` + `computeDailyLeaderboard()`; day bucket derived once and passed through so one request can't hold two notions of "today")
- [x] Implement participation award (+5, always awarded on any daily-game submission) <!-- id: 27 --> (`submitDailyScore()` — `DAILY_PARTICIPATION_AWARD` = 5, unconditional)
- [x] Implement 2+-submitter gating for top-score awards (no award if only one distinct submitter for a game/day) <!-- id: 28 --> (counts *distinct* submitters, keeping each user's best; one user submitting twice does not unlock the top-score award)
- [x] Unit test: single-submitter day yields participation award only, no top-score award <!-- id: 29 --> (`leaderboard.test.ts`)
- [x] Unit test: multi-submitter day correctly identifies the top scorer <!-- id: 30 --> (`leaderboard.test.ts`)
- [x] Implement `lib/spend.ts`: deduct-before-play using `lib/ledger.ts`, throwing a typed `InsufficientBalanceError` with `{ required, balance }` details <!-- id: 31 --> (`lib/spend.ts` — cost read from `games.token_cost` per FR-4.1, not hardcoded; `InsufficientBalanceError.details` carries `{required, balance}` for the `"Need {N} tokens"` veil and the 402 body)
- [x] Implement daily login bonus (+10 per rolling 24h, no buildup across inactivity) as its own ledger-writing function <!-- id: 32 --> (`lib/ledger.ts` `awardDailyLoginBonus()` — the 24h guard is a `NOT EXISTS` inside the INSERT, so concurrent logins can't double-award. Tested: 30-day absence yields exactly one bonus, not 30)
- [x] Add `games.default_top_score_award` (default 10) to the schema and use it in `lib/leaderboard.ts` when no bounty is set for a game/day (PRD Open Questions resolution) <!-- id: 33 --> (**column already existed** — `games.default_top_score_award` (default 10) landed with the Partition 1 schema and is live in the DB, so no migration was needed. This task reduced to consuming it in `lib/leaderboard.ts`, which now falls back to it whenever no bounty amount is set)
- [x] Implement `lib/content.ts`: `completeContentItem(userId, contentItemId, answerText)`, enforcing once-per-day only for `type in ('riddle', 'trivia')`, unlimited for `type: 'task'` (FR-3.4 infra; content itself is seeded, not authored in-app this initiative) <!-- id: 34 --> (`lib/content.ts` — once-per-day enforced by a **partial unique index**, not an app-level check; see id:38)
- [x] Unit test: a riddle/trivia completion awards tokens once per day, a second same-day attempt returns `already_completed_today` with no award <!-- id: 35 --> (`content.test.ts` — also covers trivia, a different day, and a 3-way concurrent submit)
- [x] Unit test: a task completion awards tokens on every call with no once-per-day restriction <!-- id: 36 --> (`content.test.ts` — 3 task completions, 3 awards)
- [x] Confirm 100% test coverage on `lib/ledger.ts`, `lib/achievements.ts`, `lib/leaderboard.ts`, `lib/content.ts` per Tech Design coverage expectations <!-- id: 37 --> (**100% statements / lines / functions** on `ledger.ts`, `achievements.ts`, `leaderboard.ts`, `content.ts` *and* `spend.ts`. Branch coverage 88% overall — the residual gaps are unreachable defensive `??` fallbacks such as `game?.displayName ?? gameId`, where `game_id` is a foreign key so the row always exists. Not gamed with artificial tests)
- [x] Add `content_completions.once_per_day` + partial unique index `content_completions_once_per_day_uniq` (migration `0001_large_maestro.sql`) <!-- id: 38 --> (**schema deviation.** The original schema deliberately used a plain lookup index plus an application-level "completed today?" check, reasoning that a partial unique index keyed on `content_items.type` was awkward in Drizzle. But a read-then-write check races: a double-submitted riddle can award twice, which id:35 forbids. Denormalizing the once-per-day flag onto the completion row makes a partial unique index expressible, moving the guarantee into the DB per ADR-3's stated principle. Tasks store `false`, fall outside the partial index, and stay unlimited. Verified by a 3-way concurrent-submit test)
- [x] Add `daily_top_score_settlements` table (PK `(game_id, game_date)`, migration `0002_early_unicorn.sql`) <!-- id: 39 --> (**found by a failing test.** The first cut guarded repeat settlement with `transactions.created_at::date = gameDate`, which is wrong whenever settlement runs after the day being settled — the day played and the day paid differ, so the guard never matched and the award paid twice. Replaced with a one-row-per-game/day constraint, giving the bounty and default-award paths one shared idempotency mechanism. `bounties.claimed_by_user_id` is now bookkeeping for the bot's pending-bounty view, not the guard)

## Partition: feat/api-and-bot-contract

- [x] Implement service-API-key middleware: constant-time comparison against `BOT_API_KEY` env var, applied to bot-only routes <!-- id: 40 -->
- [x] Implement `GET /api/balance` (user session required) returning `{ balance, recent }` <!-- id: 41 -->
- [x] Implement `POST /api/spend` (user session required) returning `200`/`{ ok: true, newBalance }` or `402`/`{ ok: false, error: "insufficient_balance", required, balance }` <!-- id: 42 -->
- [x] Implement `POST /api/scores/submit` accepting either a user session or a service API key + `discordId` lookup, delegating to `lib/achievements.ts` + `lib/leaderboard.ts` <!-- id: 43 -->
- [x] Implement `GET /api/bounty/pending` (service API key only) <!-- id: 44 -->
- [x] Implement `POST /api/bounty/set` (service API key only) <!-- id: 45 -->
- [x] Implement `GET /api/users/by-discord-id` (service API key only), `404` when unresolved <!-- id: 46 -->
- [x] Implement `GET /api/content` (user session), returning active `content_items` with per-item `completedToday` flag <!-- id: 47 -->
- [x] Implement `POST /api/content/complete` (user session), delegating to `lib/content.ts`; no create/edit/delete routes for `content_items` — authoring is explicitly out of scope this initiative <!-- id: 48 -->
- [x] Implement `POST /api/cron/settle-daily` (service API key / cron secret only): calls `settleDailyTopScore()` for every game for the day that just closed. Builder-decided 2026-07-25 as the trigger for the one-shot daily settle, which had no caller after Partition 2 <!-- id: 53 -->
- [x] Add the Vercel cron entry invoking `/api/cron/settle-daily` just after the day boundary (arcade-backend project config) <!-- id: 54 -->
- [x] Implement `POST /api/bot/log` (service API key only): ingest endpoint for `bot_log_events`. Not in the original route list, but FR-5.4 specifies the table is "populated via the same API the bot writes through" and Partition 4's Bot Log page (id:68) reads it — without this the table is permanently empty and that page has nothing to show <!-- id: 55 -->
- [x] Add `zod` request/response schemas for every route above <!-- id: 49 -->
- [x] Configure CORS to allow-list the arcade site's production + preview origins only <!-- id: 50 -->
- [x] Integration tests covering every Acceptance Criterion listed for this partition in `approach.md` <!-- id: 51 -->
- [x] Write and publish `docs/discord-bot-api.md` documenting every bot-relevant endpoint, request/response shape, and auth requirement, ready to hand off to Carter's separate Discord bot build (Tech Design Implementation Sequence step 6) <!-- id: 52 -->
- [x] Migration `0003`: unique `(game_id, game_date)` on `bounties`. **Deviation, not in the original plan.** `computeDailyLeaderboard()` already read this table as `const [bounty] = ...`, assuming at most one row per game/day, but nothing enforced it. Both API writers (the pending-row open on an admin daily submission, and `/api/bounty/set`) need a conflict target to be idempotent — without it a retried bot call silently creates a second row and which one supplies the award amount is arbitrary. Constraint-first per ADR-3 <!-- id: 56 -->
- [x] Move `isValidBotApiKey` from `lib/auth.ts` to `lib/bot-key.ts`. **Deviation.** It shares no machinery with Auth.js, and living in that module forced `next-auth` into every context that only needed to compare a key — which made it untestable outside a Next.js runtime (`next-auth` cannot resolve `next/server` under vitest's node env) <!-- id: 57 -->

## Partition: feat/admin-dashboard

- [x] Implement Auth.js session guard + `users.isAdmin` check as shared `/admin` layout middleware; verify non-admins get `403`/redirect <!-- id: 60 -->
- [x] Build the Users list page (`/admin/users`) with balance + last-active columns, per UX Mock-Up 1 (`admin-users.html`) <!-- id: 61 -->
- [x] Build the per-user transaction drill-down (inline, no full navigation) sortable by time/amount/reason <!-- id: 62 -->
- [x] Build the "Adjust balance" inline edit flow with the `"Confirm: {old} -> {new}?"` confirm step, writing an `"Admin adjusted {old} -> {new}"` transaction on confirm <!-- id: 63 -->
- [x] Build the Achievement Builder (per-game criteria-row CRUD: mode, threshold/gap value, award, one-time flag), live-applying without redeploy <!-- id: 64 -->
- [x] Build empty-state copy for the Achievement Builder: `"No achievements configured for this game yet."` <!-- id: 65 -->
- [x] Build Games config page: per-game token cost editing <!-- id: 66 -->
- [x] Build Leaderboards page: daily leaderboard history, edit/delete a bad entry <!-- id: 67 -->
- [x] Build Bot Log page: read-only feed of `bot_log_events` <!-- id: 68 -->
- [x] Build basic Analytics page: most-played games, daily leaderboard participation counts, per-user first-place counts <!-- id: 69 -->
- [x] Component/page tests for balance-edit confirm flow and achievement builder empty/populated states <!-- id: 70 -->
- [x] Add `lib/admin.ts` (aggregate read queries) and `lib/admin-guard.ts` (`getAdminSession()`). **Deviation from the declared module list**, which named only `arcade-backend/app/admin`: the Users list and Analytics pages need joined/aggregated SQL that does not belong in a page component, and the guard is shared by the layout *and* every server action <!-- id: 71 -->
- [x] Re-check the admin guard inside every server action, not just the layout. **Not in the plan and a real hole if missed**: a server action is a directly-reachable POST endpoint with a generated URL, so the layout guard is not a gate on it — without this, any authenticated user could call `adjustBalanceAction` <!-- id: 72 -->
- [x] Add `@vitejs/plugin-react`, `@testing-library/react`, `@testing-library/jest-dom`, `jsdom` as devDeps and wire a `lib/test-setup.ts`; component test files opt into jsdom per-file via an `@vitest-environment` docblock so lib/route tests keep the node env they need for live Postgres. `@vitejs/plugin-react` is pinned to v4 — v6 requires Vite 8 and vitest 2.1.9 ships Vite 5 <!-- id: 73 -->

## Cross-cutting: transactions.game_id (feat/ledger-game-id)

- [x] Add nullable `transactions.game_id` FK to `games` + `transactions_game_id_source_idx`; migration `0004` includes a backfill of historical rows from their reason strings. Builder-approved 2026-07-25 as the durable fix for the Partition 4 analytics coupling <!-- id: 80 -->
- [x] Thread `gameId` through `lib/ledger.ts`'s game-related insert sites (`writeTransaction`, `awardAchievement`, `settleTopScoreAward`) and their callers in `lib/spend.ts`, `lib/leaderboard.ts`, `lib/achievements.ts`. Content, login, and admin-adjustment writes leave it null <!-- id: 81 -->
- [x] Switch `lib/admin.ts` Analytics "most played" to join on `transactions.game_id` instead of a reconstructed reason string; test asserts the count survives a reason-wording change <!-- id: 82 -->

## Partition: feat/site-integration

- [ ] Add `src/lib/tokenApi.ts` API-client module wrapping fetch calls to the backend, with graceful degradation when the backend is unreachable <!-- id: 80 -->
- [ ] Add "Sign in with Google" control to the existing header, replaced by the balance pill when signed in, per UX Mock-Up 2 (`site-balance-pill.html`) <!-- id: 81 -->
- [ ] Implement the balance pill's Loading / Populated states with the LED-pulse convention <!-- id: 82 -->
- [ ] Implement the transient achievement/award toast (`aria-live="polite"`, ~3s auto-dismiss, fades instead of slides under `prefers-reduced-motion`) <!-- id: 83 -->
- [ ] Wire `POST /api/spend` into the existing `Hub.register(...)` cartridge/cabinet start flow; block game start on insufficient balance <!-- id: 84 -->
- [ ] Implement the `"Need {N} tokens"` inline veil for insufficient-balance attempts, without stealing keyboard focus from other games <!-- id: 85 -->
- [ ] Wire `POST /api/scores/submit` into each existing game's score-save path <!-- id: 86 -->
- [ ] Build the minimal Account surface: Discord account-link CTA (using the Discord provider stubbed in `feat/backend-foundation`), own transaction log view <!-- id: 87 -->
- [ ] Build the Riddles/Tasks list on the Games Tab, calling `GET /api/content` / `POST /api/content/complete`; must render correctly in the expected-empty state at launch (no content seeded yet) per UX Riddles/Tasks List states <!-- id: 87a -->
- [ ] Verify a simulated backend outage leaves core gameplay fully playable (click-to-wake, pause-on-click-away, fullscreen, Escape) with only the balance pill degraded <!-- id: 88 -->
- [ ] Manual regression pass against the existing hub interaction model per approach.md Risks & Mitigations <!-- id: 89 -->
- [ ] Accessibility check: keyboard navigation, `aria-live` toast behavior, reduced-motion, color contrast on new elements (WCAG 2.1 AA) <!-- id: 90 -->

## Initiative Boundary

- [ ] Verify both Vercel projects (site + `arcade-backend`) are correctly scoped via Root Directory, with no env var leakage between them, before considering the initiative complete <!-- id: 99 -->
