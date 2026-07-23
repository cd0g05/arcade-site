---
summary: "Adds a gamified token economy to Carter's Arcade: players earn tokens via daily login, high scores, one-time achievements, riddles/tasks, and daily-game participation; spend tokens to play cabinet games. Requires new backend infra (Google auth + optional Discord link, Postgres-backed ledger, achievement builder, admin dashboard at dev.cartercripe.com/arcade) for a small trusted group (~5-20 users). Discord bot (built separately by Carter) is a first-class API consumer for score logging and bounty management."
phase: "clarify"
when_to_load:
  - "When defining or reviewing initiative goals, users, scope, success criteria, and risks."
  - "When validating that implementation still aligns with the intended problem and outcomes."
depends_on: []
modules:
  - "New backend service (auth, database, token/achievement engine, admin dashboard)"
  - "Arcade site (score submission hooks, token balance display)"
  - "Discord bot (external, built by Carter, consumes backend API)"
index:
  executive_summary: "## Executive Summary"
  project_classification: "## Project Classification"
  success_criteria: "## Success Criteria"
  user_journeys: "## User Journeys"
  scope: "## Scope"
  functional_requirements: "## Functional Requirements"
  non_functional_requirements: "## Non-Functional Requirements"
  open_questions: "## Open Questions"
  risk_mitigation: "## Risk Mitigation"
next_section: "done"
---

# PRD: Token System

## Progress

- [x] Executive Summary
- [x] Project Classification
- [x] Success Criteria
- [x] User Journeys
- [x] Scope & Phasing
- [x] Functional Requirements
- [x] Non-Functional Requirements
- [x] Open Questions
- [x] Risk Mitigation

## Executive Summary

A gamified in-game currency layered on top of Carter's Arcade: players earn tokens by playing, setting high scores, unlocking one-time achievements, answering riddles/trivia, completing tasks, and participating in daily-game leaderboards; they spend tokens to play cabinet games. The point is engagement, not scarcity — tokens should be abundant and easy to earn, existing purely to make the arcade feel like a living game system rather than a static page of embedded games.

### What Makes This Special

- **Deliberately gameable** — the economy is not designed to be a hard barrier or anti-cheat system. Verification of riddles/tasks is loose (take players at their word); the goal is fun friction, not fraud prevention, because the user base is small and trusted.
- **Achievement-driven high scores** — rather than rewarding every incremental high score (which trivially-gameable games like Dino Run or 2048 would let players farm), Carter configures per-game thresholds and gap-based intervals in an admin-authored achievement builder, so bonuses land on meaningful milestones.
- **Discord-native social loop** — Carter's own daily scores set bounties; other players' scores are scraped from a shared Discord channel by a bot Carter builds himself, tying the token economy to an existing family/friend social space instead of requiring a separate destination.

## Project Classification

**Technical Type:** Consumer App (small-group) with an Internal Admin Tool component
**Domain:** Entertainment / Gamification
**Complexity:** High — new backend, auth, database, admin dashboard, and an external bot integration are all being introduced to a previously backend-less static site.
**Project Context:** Brownfield (extends Carter's Arcade, a Vite + vanilla TS static MPA with an existing hub/cartridge game system) but Greenfield for everything backend-related — no auth, database, or server currently exists in this repo.

---

## Success Criteria

### User Success

A user achieves success when they can:

1. **See a live token balance and earn it passively** — logging in daily and just playing games (no extra effort) visibly grows their balance within the first session.
2. **Understand what earned them tokens** — every earn/spend event is explained (e.g. "+15 High Score: Dino Run", "-3 Cabinet: Setrit") so the economy doesn't feel opaque.
3. **Participate via Discord without visiting the site** — a player who only posts scores in the family Discord channel still earns and can check their balance, without ever loading the arcade site.

### Technical Success

The system is successful when:

1. Every token-affecting event (login, high score, achievement, riddle, daily submission, admin override, cabinet spend) is captured as an immutable, attributed ledger entry — balance is always a derived sum, never a mutated field trusted on its own.
2. Achievement criteria checks run automatically and idempotently on score submission — an achievement is never awarded twice, and a re-submitted or corrected score does not double-award.
3. The Discord bot integrates against a stable, documented REST API boundary and never computes token math itself — the backend is the single source of truth.

### Measurable Outcomes

- A new user can earn 100+ tokens in their first session purely by setting first-time high scores across the existing cartridge/cabinet roster.
- Admin dashboard page load (user list + recent ledger) under 1s for the expected ~5-20 user scale.
- Zero double-awarded achievements or high-score bonuses across the interval-gap tracking logic (verified by test coverage, not manual audit).

---

## User Journeys

### Journey 1: Casual Player — "I just want to fidget and watch numbers go up"

A friend or family member lands on the arcade hub, logs in with Google (low friction — they already have an account), and plays a couple rounds of Dino Run and 2048 during a work break. They don't know or care about the token system at first, but they notice a balance ticking up in the corner with small toast-style notes ("+15 High Score", "+5 Daily Submission") and get curious. They click into the games tab, see a leaderboard with their name climbing, and come back the next day mostly because the daily login bonus and the "beat yesterday's board" itch pull them back. Success for this user is: they didn't have to learn any rules to start earning, and the system rewarded exploration (new games = new first-time high scores = fast early balance growth).

**Requirements Revealed:** Google auth, passive token balance display, transaction toasts/log, daily login bonus, per-game high-score achievement checking, daily leaderboard.

---

### Journey 2: Discord-Native Player — "I never leave the family channel"

A family member who is active in the shared Discord server but rarely visits the site posts their Wordle or maptap.gg score in the family channel like they always have. Carter's bot (built separately, consuming the backend API) reads the message, resolves their Discord identity to a linked arcade account, and logs the score. Because at least one other person also posted a score for that game that day, the bot checks the daily leaderboard, and if this player's score wins the day, they're awarded whatever bounty Carter set after posting his own score (bot DM's Carter privately to set the bounty, then deletes the exchange and posts a public "Beat Carter's score for a 10 token bounty" message). The player never needs to visit the arcade site to earn — their Discord account, linked once via an account-linking flow, is enough.

**Requirements Revealed:** Discord account linking (optional, post-Google-login step), bot-to-backend score submission API, daily leaderboard computation with 2+ submitter threshold, bounty set/redeem flow, participation-only award (+5 for any posted score, always awarded regardless of ranking).

---

### Journey 3: Carter — Admin & Economy Designer

Carter wants to tune the economy over time without redeploying code: add a new achievement for a newly-added cabinet game, adjust a high-score award threshold because a game turned out too easy to farm, or manually correct a token balance after a dispute. He logs into the admin dashboard at `dev.cartercripe.com/arcade`, opens the achievement builder for "Dino Run", and adds a criteria row (`score >= 1500`, award `15`, one-time). He browses the user list, clicks into a specific player to see their full transaction history, and — if needed — edits their token count directly, which logs an "Admin adjusted 40 -> 55" entry visible in that player's own transaction log. He also checks a lightweight analytics view (most active games, daily leaderboard participation, first-place counts per user) to decide what to build next.

**Requirements Revealed:** Admin dashboard (user list, per-user transaction drill-down, manual balance edit with audit logging), achievement builder UI (per-game criteria: threshold or interval-gap mode, award amount, one-time flag), game/cabinet config management, basic analytics/heatmaps, Discord bot action log view.

---

### Journey Requirements Summary

| User Type | Key Requirements |
|-----------|-----------------|
| **Casual Player** | Google auth, balance display, transaction log/toasts, daily login bonus, automatic achievement checking, daily leaderboard |
| **Discord-Native Player** | Discord account linking, bot API integration, bounty flow, participation award, 2+-submitter leaderboard gating |
| **Carter (Admin)** | Admin dashboard, achievement builder (threshold/interval modes), manual ledger edits with audit trail, game config management, analytics |

---

## Scope

### MVP — Minimum Viable Product (v1)

**Core Deliverables:**
- Google OAuth login; optional Discord account-link step
- Token ledger: every earn/spend is an immutable, attributed transaction row; balance is a derived sum
- Earning: daily login bonus (10/24h, no buildup), per-game high-score achievement checking (one-time, threshold or interval-gap configurable per game), +5 participation award for any posted daily score
- Spending: fixed per-game costs (e.g. -1 hub cartridge, -3 cabinet game), enforced before gameplay starts
- Achievement builder in admin dashboard: add/edit/delete criteria per game (`game`, `criteria` (score threshold or gap-from-last-award), `award`, one-time flag); automatic check runs on every score submission
- Admin dashboard v1: user list (balance, last active), click-through to per-user transaction log, manual balance edit (logged as an "Admin adjusted X -> Y" transaction visible to both admin and user logs)
- Daily leaderboard per game: cutoff at midnight, requires 2+ distinct submitters for top-score tokens to be awarded, always-awarded participation token for any submission
- Discord bot API contract published (endpoints for score submission, bounty set/pending, user-by-discord-id lookup) — bot implementation itself tracked as a parallel, Carter-owned task line (see Functional Requirements §6), not blocking v1 backend completion
- Bounty flow: Carter posts his score, bot privately asks him to set a bounty amount, deletes the exchange, posts a public bounty message; a flat default of 10 tokens (configurable per game) is awarded to the top scorer instead when Carter hasn't posted a score that day
- Riddle/task **infrastructure** (schema + completion tracking + awarding API per FR-3.4) ships in v1 so the mechanic works end-to-end; actual riddle/trivia/task **content** is out of scope for this initiative and added later by Carter

**Quality Gates:**
- No score submission path (site or bot) can bypass achievement/high-score checking
- Achievement awards are provably idempotent (test-covered)
- Every token balance change is reconstructable from the ledger alone

### Growth Features (Post-MVP)

**v2: Engagement Depth**
- Streaks (consecutive daily logins/submissions)
- "Beat your own prior high score" as a distinct achievement class, separate from milestone thresholds
- Notifications section (user-facing) for admin balance adjustments
- Graphs/heatmaps in admin analytics

**v3: Social & Economy Expansion**
- Multiplayer wagering on shared games
- System AI that can award variable amounts for riddles/tasks and let a user haggle for more (Dungeon Crawler Carl-inspired)

### Vision (Future)

- Microtransactions / token shop
- Broader public rollout beyond the trusted friend group (would require revisiting the "loose verification, gameable by design" posture)

---

## Functional Requirements

### 1. Authentication & Identity

**FR-1.1:** Users authenticate via Google OAuth as the primary identity.
- Session persists across visits; no separate arcade-specific password.

**FR-1.2:** Users may optionally link a Discord account after Google login.
- Linking associates a Discord user ID with the arcade account so the bot can resolve identity when scraping channel messages.
- Unlinked users can still use the site fully; they simply can't be matched by the Discord bot.

---

### 2. Token Ledger & Balance

**FR-2.1:** Every token-affecting event creates an immutable transaction row: amount (signed), reason string, source (login/high-score/achievement/riddle/task/daily-submission/cabinet-spend/admin-adjustment/bounty), timestamp, and actor (system or admin user ID for manual edits).
- Balance displayed to a user is always `SUM(transactions.amount)` for that user, never a separately mutated counter.

**FR-2.2:** Admin manual balance edits are themselves transactions.
- Reason string format: `"Admin adjusted {previous_value} -> {new_value}"`.
- Visible in both the admin's action log and the affected user's own transaction history.

---

### 3. Earning Mechanics

**FR-3.1:** Daily login bonus: +10 tokens awarded once per rolling 24h period on login. No accumulation/buildup during inactivity — a user returning after 30 days gets the same +10, not backpay.

**FR-3.2:** Per-game high-score achievements, configured per game in the achievement builder, in one of two modes:
- **Threshold mode:** award once when score first crosses a fixed value (e.g. `score >= 1500` -> 15 tokens).
- **Interval-gap mode:** award when score exceeds the last *awarded* high score by at least a configured gap (e.g. last award at 1000, gap = 100 -> next award only at >=1100; scoring 1050 updates the stored high score but does not trigger an award). The system must track "last high score that triggered an award" separately from "current high score" to support this.
- Achievements are one-time per criteria row — once awarded to a user, that specific criteria is never re-checked for them.
- Checking happens automatically, synchronously, on every score submission (site or bot-sourced) — no manual admin or bot involvement required.

**FR-3.3:** Daily-game participation and competition awards:
- Posting a score for a daily game always awards +5 tokens (participation), regardless of ranking.
- If 2+ distinct users post a score for the same daily game on the same day (cutoff: midnight), the top scorer receives an additional award. If Carter has posted a score for that game that day, this becomes a bounty (see FR-6.3); otherwise the top-score award is a default fixed or admin-configured amount.
- If only one user submits a score for a game on a given day, no top-score bonus is awarded (participation bonus still applies).

**FR-3.4:** Riddles/trivia/tasks:
- Riddles and trivia are retryable and award tokens once per day per riddle.
- Tasks (e.g. "listen to a song and note your favorite part") are completable an unlimited number of times, at a flat token amount (default 10), initially admin-configured — no automated verification, answers are accepted at face value.

---

### 4. Spending

**FR-4.1:** Playing a hub-embedded cartridge game costs 1 token per play; playing a cabinet game costs 3 tokens per play. Costs are configurable per game in the admin dashboard, not hardcoded.

**FR-4.2:** Spend is deducted at game start, before gameplay begins, as its own transaction row.

---

### 5. Admin Dashboard

**FR-5.1:** User management view: list of all users with current balance and most recent site activity timestamp; clicking a user opens their full transaction log (sortable, filterable).

**FR-5.2:** Achievement builder: per-game CRUD for achievement criteria rows (game, mode [threshold/interval-gap], threshold/gap value, award amount, one-time flag). Newly added criteria are immediately live for the next score submission check — no redeploy required.

**FR-5.3:** Game/cabinet configuration management: edit per-game token costs; view/edit/delete daily game entries (e.g. correct a bad score submission).

**FR-5.4:** Discord bot action log: a read-only view of bot-originated events (score submissions logged, bounties set, messages posted) for debugging/auditing, populated via the same API the bot writes through.

**FR-5.5:** Basic analytics: most-played games, daily leaderboard participation counts, per-user first-place counts. Heatmaps/graphs are Post-MVP (v2).

---

### 6. Discord Bot Integration (API boundary; bot itself built by Carter)

**FR-6.1:** Backend exposes a documented API for the bot to consume, at minimum:
- `POST /api/scores/submit` — bot-sourced score submission (triggers the same achievement-checking path as site submissions)
- `GET /api/bounty/pending` — check whether a bounty is awaiting Carter's input for a given game/day
- `POST /api/bounty/set` — Carter (via bot DM flow) sets a bounty amount after posting his own score
- `GET /api/users/by-discord-id` — resolve a Discord user ID to an arcade account for score attribution

**FR-6.2:** The bot never computes token math or achievement eligibility itself — all such logic lives server-side; the bot is a thin event source and message-formatting layer.

**FR-6.3:** Bounty flow: after Carter posts his own daily score in the channel, the bot DMs him to set a bounty amount, deletes both the prompt and his reply from the channel/DM history, then posts a public message of the form "Beat Carter's score for a {N} token bounty."

**FR-6.4 (implementation ownership, not a backend build task):** The Discord bot codebase, score-scraping logic, account-linking flow trigger, and bounty prompt/response UX are built by Carter directly, against the API contract defined in FR-6.1-6.3. This initiative's backend work must ship that API contract early enough for bot development to proceed in parallel.

---

## Non-Functional Requirements

- **Performance:** Admin dashboard views (user list, transaction log, leaderboard) load in under 1s at the target scale (~5-20 users, expect low thousands of transaction rows in year one).
- **Reliability:** Achievement/high-score checks must be idempotent under retries or duplicate submissions (e.g. bot resending after a network blip) — no double-award.
- **Security:** Google OAuth for primary auth; admin dashboard routes require Carter's own elevated account, not just any logged-in user. Discord bot authenticates to the backend via a server-to-server credential (API key or similar), not a user session.
- **Maintainability:** Achievement criteria and per-game costs are data (admin-configured), not hardcoded per-game logic, so adding a new game's economy rules doesn't require a code change.

---

## Open Questions

- ~~**Hosting/stack for the new backend**~~ — **Resolved in Tech Design (ADR-1):** a new Next.js project at `arcade-backend/` in this same repo, deployed as its own separate Vercel project (Root Directory) at `dev.cartercripe.com/arcade`.
- ~~**Default top-score award amount when no bounty is set**~~ — **Resolved:** flat default of **10 tokens**, configurable per game (see `games.default_top_score_award` in Tech Design Data Models). Awarded to the top scorer when 2+ people submit a score for a daily game and Carter has not posted his own score (and thus no bounty was set) that day.
- ~~**Session/auth mechanism for the arcade site itself**~~ — **Resolved:** Google login gates only the token-earning/spending layer (balance, achievements, spend-to-play). Games remain freely playable anonymously with no tokens deducted or earned — this preserves the existing "no loading screens or menus between games" fidget-friction-free feel for anyone who hasn't signed in.
- **Riddle/task content authoring** — **Resolved (scope decision):** the riddle/trivia/task *infrastructure* (schema, completion-tracking, and awarding API per FR-3.4) ships as part of this initiative's MVP so the earning mechanic works end-to-end. The *content itself* (writing actual riddles/trivia/tasks and any dedicated authoring UI beyond direct DB entry) is explicitly deferred — Carter will add content later, by hand if needed, once the plumbing exists. See Tech Design Data Models and Scope.

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Achievement double-award due to non-idempotent submission handling (esp. bot retries) | Med | Med | Ledger-first design (FR-2.1) + explicit one-time-per-criteria tracking (FR-3.2); test coverage required as an MVP quality gate. |
| Scope creep from the large "future features" list (streaks, AI economy agent, multiplayer wagering, shop) bleeding into v1 | High | Med | Explicit MVP/v2/v3/Vision phasing in Scope section; Discord bot and backend built in parallel but backend does not block on bot completion. |
| Introducing a full backend/auth/DB stack to a previously static site is a large jump in operational complexity for a ~5-20 user hobby project | Med | Med | Small trusted scale keeps NFR targets modest; defer heavier ops concerns (rate limiting, abuse prevention) since verification is intentionally loose and users are trusted. |
| Discord bot (external, Carter-owned) and backend API drift out of sync since they're built somewhat independently | Med | High | API contract (FR-6.1) frozen and documented early; Signal operation used if backend API shape changes after bot work has started. |
