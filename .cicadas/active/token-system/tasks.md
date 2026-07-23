---
summary: "Foundation-mode task breakdown across the five partitions from approach.md: backend-foundation (schema/auth/ledger) -> economy-engine (achievements/leaderboard) -> {api-and-bot-contract, admin-dashboard} in parallel -> site-integration. No PR tasks injected (lifecycle.json has all pr_boundaries false) — every boundary merges directly."
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
next_section: "## Partition: feat/backend-foundation"
---

# Tasks: Token System

**Mode:** Foundation (new backend module) for Partitions 1-4; Feature (vertical slice into existing site) for Partition 5.
**PR boundaries:** None — `lifecycle.json` has all `pr_boundaries` false; no `Open PR` tasks are injected anywhere below.

## Partition: feat/backend-foundation

- [ ] Scaffold `arcade-backend/` as a Next.js App Router + TypeScript project inside this repo <!-- id: 1 -->
- [ ] Add `arcade-backend/vercel.json` (or equivalent project config) scoped to the `arcade-backend/` Root Directory, per Tech Design ADR-1 <!-- id: 2 -->
- [ ] Provision a Neon Postgres database via the Vercel Marketplace; wire `DATABASE_URL` into `arcade-backend` env vars <!-- id: 3 -->
- [ ] Spike: confirm the Neon serverless driver correctly pools/reuses connections under Vercel Fluid Compute without exhausting Neon's connection limit (flagged risk in tech-design.md and approach.md) <!-- id: 4 -->
- [ ] Write `lib/db/schema.ts` with all tables from Tech Design Data Models: `users`, `transactions`, `games`, `high_scores`, `achievements`, `achievement_awards`, `daily_leaderboard_entries`, `bounties`, `bot_log_events` <!-- id: 5 -->
- [ ] Generate and apply the initial Drizzle migration against the Neon database <!-- id: 6 -->
- [ ] Implement `lib/ledger.ts` as the sole function permitted to write `transactions` rows (ADR-2) <!-- id: 7 -->
- [ ] Unit test: balance computed via `SUM(transactions.amount)` matches the sum of a sequence of ledger writes for a test user <!-- id: 8 -->
- [ ] Configure Auth.js with the Google OAuth provider; verify `/api/auth/signin` redirects to Google's consent screen <!-- id: 9 -->
- [ ] Stub the Discord OAuth provider in Auth.js config for later account-linking (full linking UX lands in `feat/site-integration`) <!-- id: 10 -->
- [ ] Write a seed script populating the `games` table from the existing hub cartridge/cabinet roster with correct tier + token cost (1 cartridge / 3 cabinet, per PRD FR-4.1 defaults) <!-- id: 11 -->
- [ ] Add a `GET /api/health` route returning `200`, for use as the partition's ready-check <!-- id: 12 -->
- [ ] Reflect: update `tech-design.md`/`approach.md` "NEEDS MANUAL REVIEW" markers with the actual confirmed `npm run dev` script name and port once scaffolded <!-- id: 13 -->

## Partition: feat/economy-engine

- [ ] Implement `lib/achievements.ts` threshold-mode evaluation: award once when score first crosses a fixed value <!-- id: 20 -->
- [ ] Implement `lib/achievements.ts` interval-gap-mode evaluation, reading/writing `high_scores.last_awarded_high_score` distinctly from `current_high_score` (ADR-5) <!-- id: 21 -->
- [ ] Implement idempotent award insertion via `(user_id, achievement_id)` unique constraint + `ON CONFLICT DO NOTHING`, paired with the ledger write in one DB transaction (ADR-3) <!-- id: 22 -->
- [ ] Unit test: scoring 1050 after a `last_awarded_high_score` of 1000 with gap 100 produces no award but updates `current_high_score` <!-- id: 23 -->
- [ ] Unit test: a subsequent score of 1100 in the same scenario produces exactly one award and exactly one `achievement_awards` row <!-- id: 24 -->
- [ ] Unit test: calling the same score-evaluation twice with identical input (simulated retry) never double-awards <!-- id: 25 -->
- [ ] Implement `lib/leaderboard.ts`: midnight-cutoff day bucketing for `daily_leaderboard_entries` <!-- id: 26 -->
- [ ] Implement participation award (+5, always awarded on any daily-game submission) <!-- id: 27 -->
- [ ] Implement 2+-submitter gating for top-score awards (no award if only one distinct submitter for a game/day) <!-- id: 28 -->
- [ ] Unit test: single-submitter day yields participation award only, no top-score award <!-- id: 29 -->
- [ ] Unit test: multi-submitter day correctly identifies the top scorer <!-- id: 30 -->
- [ ] Implement `lib/spend.ts`: deduct-before-play using `lib/ledger.ts`, throwing a typed `InsufficientBalanceError` with `{ required, balance }` details <!-- id: 31 -->
- [ ] Implement daily login bonus (+10 per rolling 24h, no buildup across inactivity) as its own ledger-writing function <!-- id: 32 -->
- [ ] Add `games.default_top_score_award` (default 10) to the schema and use it in `lib/leaderboard.ts` when no bounty is set for a game/day (PRD Open Questions resolution) <!-- id: 33 -->
- [ ] Implement `lib/content.ts`: `completeContentItem(userId, contentItemId, answerText)`, enforcing once-per-day only for `type in ('riddle', 'trivia')`, unlimited for `type: 'task'` (FR-3.4 infra; content itself is seeded, not authored in-app this initiative) <!-- id: 34 -->
- [ ] Unit test: a riddle/trivia completion awards tokens once per day, a second same-day attempt returns `already_completed_today` with no award <!-- id: 35 -->
- [ ] Unit test: a task completion awards tokens on every call with no once-per-day restriction <!-- id: 36 -->
- [ ] Confirm 100% test coverage on `lib/ledger.ts`, `lib/achievements.ts`, `lib/leaderboard.ts`, `lib/content.ts` per Tech Design coverage expectations <!-- id: 37 -->

## Partition: feat/api-and-bot-contract

- [ ] Implement service-API-key middleware: constant-time comparison against `BOT_API_KEY` env var, applied to bot-only routes <!-- id: 40 -->
- [ ] Implement `GET /api/balance` (user session required) returning `{ balance, recent }` <!-- id: 41 -->
- [ ] Implement `POST /api/spend` (user session required) returning `200`/`{ ok: true, newBalance }` or `402`/`{ ok: false, error: "insufficient_balance", required, balance }` <!-- id: 42 -->
- [ ] Implement `POST /api/scores/submit` accepting either a user session or a service API key + `discordId` lookup, delegating to `lib/achievements.ts` + `lib/leaderboard.ts` <!-- id: 43 -->
- [ ] Implement `GET /api/bounty/pending` (service API key only) <!-- id: 44 -->
- [ ] Implement `POST /api/bounty/set` (service API key only) <!-- id: 45 -->
- [ ] Implement `GET /api/users/by-discord-id` (service API key only), `404` when unresolved <!-- id: 46 -->
- [ ] Implement `GET /api/content` (user session), returning active `content_items` with per-item `completedToday` flag <!-- id: 47 -->
- [ ] Implement `POST /api/content/complete` (user session), delegating to `lib/content.ts`; no create/edit/delete routes for `content_items` — authoring is explicitly out of scope this initiative <!-- id: 48 -->
- [ ] Add `zod` request/response schemas for every route above <!-- id: 49 -->
- [ ] Configure CORS to allow-list the arcade site's production + preview origins only <!-- id: 50 -->
- [ ] Integration tests covering every Acceptance Criterion listed for this partition in `approach.md` <!-- id: 51 -->
- [ ] Write and publish `docs/discord-bot-api.md` documenting every bot-relevant endpoint, request/response shape, and auth requirement, ready to hand off to Carter's separate Discord bot build (Tech Design Implementation Sequence step 6) <!-- id: 52 -->

## Partition: feat/admin-dashboard

- [ ] Implement Auth.js session guard + `users.isAdmin` check as shared `/admin` layout middleware; verify non-admins get `403`/redirect <!-- id: 60 -->
- [ ] Build the Users list page (`/admin/users`) with balance + last-active columns, per UX Mock-Up 1 (`admin-users.html`) <!-- id: 61 -->
- [ ] Build the per-user transaction drill-down (inline, no full navigation) sortable by time/amount/reason <!-- id: 62 -->
- [ ] Build the "Adjust balance" inline edit flow with the `"Confirm: {old} -> {new}?"` confirm step, writing an `"Admin adjusted {old} -> {new}"` transaction on confirm <!-- id: 63 -->
- [ ] Build the Achievement Builder (per-game criteria-row CRUD: mode, threshold/gap value, award, one-time flag), live-applying without redeploy <!-- id: 64 -->
- [ ] Build empty-state copy for the Achievement Builder: `"No achievements configured for this game yet."` <!-- id: 65 -->
- [ ] Build Games config page: per-game token cost editing <!-- id: 66 -->
- [ ] Build Leaderboards page: daily leaderboard history, edit/delete a bad entry <!-- id: 67 -->
- [ ] Build Bot Log page: read-only feed of `bot_log_events` <!-- id: 68 -->
- [ ] Build basic Analytics page: most-played games, daily leaderboard participation counts, per-user first-place counts <!-- id: 69 -->
- [ ] Component/page tests for balance-edit confirm flow and achievement builder empty/populated states <!-- id: 70 -->

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
