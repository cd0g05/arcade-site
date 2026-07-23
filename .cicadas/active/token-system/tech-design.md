---
summary: "New Next.js service at arcade-backend/ (same git repo as the static arcade site, but deployed as its own separate Vercel project via Root Directory) hosted at dev.cartercripe.com/arcade, using Auth.js (Google OAuth + Discord account link), Postgres via Vercel Marketplace (Neon) with Drizzle ORM, and Vercel Functions (Fluid Compute) for the API. Ledger-first data model (transactions table is the only source of truth for balance). Achievement checking runs synchronously and idempotently inside the score-submission handler. Discord bot (Carter-owned, separate codebase) authenticates as a service principal via a static API key against a documented REST contract."
phase: "tech"
when_to_load:
  - "When implementing or reviewing architecture, interfaces, data models, conventions, and sequencing."
  - "When checking whether changes still conform to the agreed technical approach."
depends_on:
  - "prd.md"
  - "ux.md"
modules:
  - "New backend service (Next.js, hosted separately, dev.cartercripe.com/arcade)"
  - "Arcade site client (src/lib, new auth/balance widget)"
  - "Discord bot (external, consumes documented API)"
index:
  overview: "## Overview & Context"
  stack: "## Tech Stack & Dependencies"
  structure: "## Project / Module Structure"
  adrs: "## Architecture Decisions (ADRs)"
  data_models: "## Data Models"
  interfaces: "## API & Interface Design"
  conventions: "## Implementation Patterns & Conventions"
  security_performance: "## Security & Performance"
  implementation_sequence: "## Implementation Sequence"
next_section: "done"
---

# Tech Design: Token System

**Pace: `all`** — full spec chain drafted without stopping; consolidated review happens after Tasks.

## Progress

- [x] Overview & Context
- [x] Tech Stack & Dependencies
- [x] Project / Module Structure
- [x] Architecture Decisions (ADRs)
- [x] Data Models
- [x] API & Interface Design
- [x] Implementation Patterns & Conventions
- [x] Security & Performance
- [x] Implementation Sequence

---

## Overview & Context

**Summary:** The arcade site (`arcade` repo — static Vite + vanilla TS MPA, no backend) stays a static site. A **new, separate Next.js service** is introduced to host the token economy backend and the admin dashboard, deployed on Vercel at `dev.cartercripe.com/arcade`. The arcade site becomes a thin client of this service: it calls its REST API for balance, spend, and score submission, and embeds a small auth/balance widget in the existing header. The Discord bot (built separately by Carter) is a second, independent client of the same API, authenticating as a service principal rather than a user.

This resolves the PRD's open hosting question: rather than bolting a backend onto the static site's own Vercel project, the token system gets its own deployable unit — consistent with Carter's stated intent to use `dev.cartercripe.com` as a general subdomain for this kind of app, and keeping the static arcade site's zero-build-step simplicity untouched.

### Cross-Cutting Concerns

1. **Ledger-first balance** — no component anywhere (site, admin, bot) ever writes a balance directly. Every change is a `transactions` row; balance is `SUM(amount)`. This is the single most important invariant in the system (PRD FR-2.1).
2. **Idempotent achievement/high-score checks** — score submission is the one write path that must never double-award, regardless of retries from the bot or duplicate site requests (PRD NFR: Reliability).
3. **Auth boundary is service-wide** — every API route other than the OAuth callback and health check requires either a valid user session (site) or a valid service API key (bot); there is no anonymous write path.
4. **Config-as-data** — achievement criteria and per-game costs live in the database, editable via the admin dashboard, never hardcoded per game (PRD NFR: Maintainability).

### Brownfield Notes

- The arcade site repo (`arcade`) is touched only for: (a) a new auth/balance widget in the existing header, (b) wiring game-start/game-over hooks to call the new backend's spend and score-submit endpoints, (c) a lightweight "Account" surface per the UX Information Architecture. No change to the existing hub/cartridge/cabinet game logic itself, the `Hub` registration pattern, or the build pipeline.
- Must not regress the site's zero-backend, fast-load character — API calls are additive and must fail gracefully (see Security & Performance) so a backend outage degrades to "tokens unavailable" rather than breaking gameplay.
- The new service is a from-scratch build — no existing patterns to extend there.

---

## Tech Stack & Dependencies

| Category | Selection | Rationale |
|----------|-----------|-----------|
| **Language/Runtime** | TypeScript, Node.js (Vercel Fluid Compute) | Matches the arcade site's existing TS usage; Fluid Compute avoids edge-runtime Node API restrictions the DB driver and Auth.js need. |
| **Framework** | Next.js (App Router) | Single framework serves both the JSON API (route handlers) and the admin dashboard (React pages) from one deploy — avoids standing up a separate API service plus a separate admin frontend. |
| **Database** | Postgres via Vercel Marketplace (Neon) | Vercel Postgres/KV are discontinued; Neon-via-Marketplace is the supported managed-Postgres path on Vercel today and fits the relational, transaction-log-shaped data model far better than a KV store. |
| **ORM / Query** | Drizzle ORM | Lightweight, TypeScript-first, explicit SQL-shaped schema — fits a small hobby-scale project better than a heavier ORM; migrations are plain SQL, easy for a single maintainer to audit. |
| **Auth** | Auth.js (NextAuth) — Google provider primary, Discord provider for account linking | Both providers are first-class Auth.js providers; avoids hand-rolling OAuth flows for either. |
| **Testing** | Vitest | Matches the arcade site's existing test runner (per `src/tests`), keeps tooling consistent across both parts of the project even though they're separate deploys. |
| **Key Libraries** | `drizzle-orm`, `next-auth`, `zod` (request validation) | `zod` gives cheap, explicit input validation at every API boundary (NFR: Security). |

**New dependencies introduced:**
- `next` — hosts both API and admin UI.
- `drizzle-orm` + `drizzle-kit` — schema/migrations.
- `next-auth` — Google + Discord OAuth.
- `zod` — request/response schema validation.
- `@neondatabase/serverless` (or Neon's Drizzle driver adapter) — Postgres driver compatible with Vercel Functions.

**Dependencies explicitly rejected:**
- `@vercel/postgres` / `@vercel/kv` — discontinued Vercel-native offerings; superseded by Marketplace integrations.
- A separate Express/Fastify API service — unnecessary process/deploy split when Next.js route handlers cover the same need with less infrastructure.
- Prisma — heavier codegen/runtime footprint than this project's scale warrants; Drizzle's thinner, SQL-adjacent model is a better fit for a single-maintainer hobby project.

---

## Project / Module Structure

```
arcade-backend/                          # NEW top-level dir in this repo, separate Vercel deploy (ADR-1)
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/route.ts  # Auth.js handler (Google + Discord)
│   │   ├── balance/route.ts             # GET current user balance + recent transactions
│   │   ├── scores/submit/route.ts       # POST score submission (site + bot), FR-3.2/FR-3.3
│   │   ├── spend/route.ts               # POST spend tokens to start a game, FR-4.1/4.2
│   │   ├── bounty/pending/route.ts      # GET pending bounty state, FR-6.1
│   │   ├── bounty/set/route.ts          # POST bounty amount, FR-6.1/6.3
│   │   ├── users/by-discord-id/route.ts # GET account lookup for bot, FR-6.1
│   │   ├── content/route.ts             # GET active riddle/trivia/task items, FR-3.4
│   │   └── content/complete/route.ts    # POST completion + award, FR-3.4
│   ├── admin/
│   │   ├── users/page.tsx               # Users list + drill-down (UX Mock-Up 1)
│   │   ├── games/page.tsx               # Game config + achievement builder
│   │   ├── leaderboards/page.tsx        # Daily leaderboard history, edit/delete
│   │   ├── bot-log/page.tsx             # Read-only bot action feed
│   │   └── analytics/page.tsx           # Basic analytics
│   └── layout.tsx                       # Shared admin shell, reuses arcade design tokens
├── lib/
│   ├── db/
│   │   ├── schema.ts                    # Drizzle schema (see Data Models)
│   │   └── client.ts                    # Neon/Drizzle connection
│   ├── ledger.ts                        # Transaction-write helper — the ONLY way to change a balance
│   ├── achievements.ts                  # Achievement criteria evaluation (threshold + interval-gap)
│   ├── leaderboard.ts                   # Daily leaderboard computation, midnight cutoff logic
│   ├── content.ts                       # Riddle/trivia/task completion + award (content itself is seeded, not authored in-app)
│   └── auth.ts                          # Auth.js config, session + service-API-key middleware
├── drizzle/                             # Generated migrations
└── styles/tokens.css                    # Copied from arcade's src/styles/tokens.css (see ADR-4)

arcade/ (existing repo)                  # MODIFIED
├── src/ui/                              # [MODIFIED] add balance pill + toast component
├── src/lib/                             # [MODIFIED] add a thin API client (fetch wrapper) for the backend
└── index.html / hub pages               # [MODIFIED] header wiring, spend calls before game start
```

**Key structural decisions:**
- Business logic (`ledger.ts`, `achievements.ts`, `leaderboard.ts`) is kept out of route handlers — handlers validate input with `zod` and delegate, matching the "business logic separated from API layer" convention so the same logic is reusable from both site- and bot-originated requests.
- Admin UI and the public API live in the same Next.js app but under strictly separate route groups (`/admin/*` vs `/api/*`) with different auth requirements — no shared middleware ambiguity.

---

## Architecture Decisions (ADRs)

### ADR-1: Separate Vercel deploy for the backend, as a subdirectory of the same repo — not a Vercel Functions layer bolted onto the existing static site, and not a second git repo

**Decision:** The token system backend + admin dashboard is a new Next.js project living at `arcade-backend/` in the **same git repository** as the existing static site, deployed as its **own separate Vercel project** (Vercel "Root Directory" set to `arcade-backend/`) at `dev.cartercripe.com/arcade`, rather than added as `/api` routes inside the existing static Vite project's build, and rather than split into a second repository.

**Rationale:** The existing site is deliberately a zero-build-step-feeling static MPA (per `Arcade Handoff.md`); mixing a full Next.js/DB/auth stack into its own build would complicate that and couple two very different release cadences — two Vercel projects with independent deploys solves that. A second git repo was considered and rejected: this project's workflow (Cicadas feature branches, worktrees, task tracking) operates on a single repository, and splitting the backend into its own repo would fracture partitioning, cross-partition Signal broadcasts, and canon synthesis across two disconnected histories for no real benefit at this project's scale. One repo, two Vercel projects (via Root Directory) gets the deploy-cadence separation without the repo-topology cost.

**Affects:** New top-level `arcade-backend/` directory in this repo, two `vercel.json`/project configs (existing root one for the site, a new one scoped to `arcade-backend/`), the arcade site's new API-client module, CORS configuration on the backend (site origin must be allow-listed).

---

### ADR-2: Ledger-only balance model — no mutable `balance` column

**Decision:** `users` table has no `balance` field. Balance is always computed as `SUM(transactions.amount) WHERE user_id = ?`, either at query time or via a maintained materialized/cached value that is provably reconstructable from the ledger.

**Rationale:** PRD Success Criteria (Technical) and NFR (Reliability) both require every balance to be reconstructable from transaction history alone, and require idempotent achievement checks — a mutable balance field invites drift bugs (double-decrement, race conditions) that are hard to detect after the fact. Given the tiny scale (~5-20 users, low thousands of transactions/year), computing `SUM()` per request is well within the <1s NFR without needing a cache layer for v1.

**Affects:** `lib/ledger.ts`, `app/api/balance/route.ts`, all award/spend code paths.

---

### ADR-3: Achievement idempotency via a `(user_id, achievement_id)` uniqueness constraint, not application-level locking

**Decision:** A dedicated `achievement_awards` table records `(user_id, achievement_id, awarded_at)` with a unique constraint on `(user_id, achievement_id)`. Awarding an achievement is an `INSERT ... ON CONFLICT DO NOTHING` paired with the corresponding transaction insert in the same DB transaction; a conflict means "already awarded," and the code path short-circuits without writing a duplicate token transaction.

**Rationale:** This pushes the one-time-per-criteria guarantee (PRD FR-3.2) into the database's own constraint system rather than relying on read-then-write application logic, which is the standard way to avoid race conditions from concurrent/retried submissions (e.g. bot resending after a timeout) without introducing a separate locking mechanism.

**Affects:** `lib/achievements.ts`, `achievement_awards` schema, `scores/submit` route.

---

### ADR-4: Admin dashboard reuses the arcade site's design tokens as a vendored copy, not a shared package

**Decision:** `arcade-backend/styles/tokens.css` is a copied (not symlinked/shared-package) snapshot of `src/styles/tokens.css`, even though both now live in the same repo.

**Rationale:** The two projects are separate Vercel deploys with independent release cadences (ADR-1); a shared internal package (or build-time symlink across the two Root Directories) adds tooling overhead disproportionate to a single-maintainer hobby project reusing ~20 CSS custom properties. The UX doc already scopes visual consistency to "reuse the same tokens," not "share a component library." Being in the same repo makes the copy easy to keep in sync by hand (a single `diff src/styles/tokens.css arcade-backend/styles/tokens.css` check), which is the main risk this ADR accepts.

**Affects:** `arcade-backend/styles/tokens.css`, `arcade-backend/app/layout.tsx`. Risk: token changes on the site (e.g. a future `--sub` contrast fix) won't automatically propagate — flagged in Risk Mitigation.

---

### ADR-5: Interval-gap achievement tracking stores "last awarded score," not "last score seen"

**Decision:** The `high_scores` table stores both `current_high_score` (updated on every new personal best) and `last_awarded_high_score` (updated only when an interval-gap achievement fires). Interval-gap criteria compare the new score against `last_awarded_high_score + gap`, not against `current_high_score`.

**Rationale:** This directly implements the PRD's worked example (FR-3.2) — scoring 1050 after an award at 1000 must update the displayed high score without re-triggering an award, and only crossing 1100 (1000 + gap 100) triggers the next one. Storing only one "high score" field would make this distinction impossible to express.

**Affects:** `high_scores` schema, `lib/achievements.ts` interval-gap evaluation path.

---

## Data Models

### New Models

```ts
// lib/db/schema.ts (Drizzle)

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  googleId: text('google_id').notNull().unique(),
  discordId: text('discord_id').unique(), // nullable — optional link
  displayName: text('display_name').notNull(),
  email: text('email').notNull(),
  isAdmin: boolean('is_admin').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  lastActiveAt: timestamp('last_active_at').notNull().defaultNow(),
});

export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  amount: integer('amount').notNull(), // signed
  reason: text('reason').notNull(), // e.g. "High Score: Dino Run"
  source: text('source', { enum: ['login', 'high_score', 'achievement', 'riddle', 'task', 'daily_submission', 'cabinet_spend', 'admin_adjustment', 'bounty'] }).notNull(),
  actorUserId: uuid('actor_user_id').references(() => users.id), // set for admin_adjustment
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const games = pgTable('games', {
  id: text('id').primaryKey(), // slug, e.g. "dino-run"
  displayName: text('display_name').notNull(),
  tier: text('tier', { enum: ['cartridge', 'cabinet'] }).notNull(),
  tokenCost: integer('token_cost').notNull(),
  isDaily: boolean('is_daily').notNull().default(false),
  defaultTopScoreAward: integer('default_top_score_award').notNull().default(10), // FR-3.3 / PRD Open Questions resolution
});

export const highScores = pgTable('high_scores', {
  userId: uuid('user_id').notNull().references(() => users.id),
  gameId: text('game_id').notNull().references(() => games.id),
  currentHighScore: integer('current_high_score').notNull(),
  lastAwardedHighScore: integer('last_awarded_high_score').notNull().default(0),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => ({ pk: primaryKey({ columns: [t.userId, t.gameId] }) }));

export const achievements = pgTable('achievements', {
  id: uuid('id').primaryKey().defaultRandom(),
  gameId: text('game_id').notNull().references(() => games.id),
  mode: text('mode', { enum: ['threshold', 'interval_gap'] }).notNull(),
  value: integer('value').notNull(), // threshold score, or gap amount
  award: integer('award').notNull(),
  active: boolean('active').notNull().default(true),
});

export const achievementAwards = pgTable('achievement_awards', {
  userId: uuid('user_id').notNull().references(() => users.id),
  achievementId: uuid('achievement_id').notNull().references(() => achievements.id),
  awardedAt: timestamp('awarded_at').notNull().defaultNow(),
}, (t) => ({ uniq: unique().on(t.userId, t.achievementId) }));

export const dailyLeaderboardEntries = pgTable('daily_leaderboard_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  gameId: text('game_id').notNull().references(() => games.id),
  score: integer('score').notNull(),
  submittedVia: text('submitted_via', { enum: ['site', 'bot'] }).notNull(),
  gameDate: date('game_date').notNull(), // midnight-cutoff day bucket
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const bounties = pgTable('bounties', {
  id: uuid('id').primaryKey().defaultRandom(),
  gameId: text('game_id').notNull().references(() => games.id),
  gameDate: date('game_date').notNull(),
  amount: integer('amount'), // null until Carter sets it
  claimedByUserId: uuid('claimed_by_user_id').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const botLogEvents = pgTable('bot_log_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventType: text('event_type').notNull(), // "score_submitted" | "bounty_set" | "message_posted"
  payload: jsonb('payload').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Riddle/trivia/task infrastructure (FR-3.4). Content authoring UI is explicitly
// out of scope for this initiative — rows are seeded directly (SQL/seed script)
// until Carter builds an authoring surface later. The awarding mechanic must work
// end-to-end against whatever rows exist.
export const contentItems = pgTable('content_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: text('type', { enum: ['riddle', 'trivia', 'task'] }).notNull(),
  prompt: text('prompt').notNull(),
  award: integer('award').notNull().default(10), // flat per FR-3.4; tasks repeatable, riddles/trivia once/day
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

export const contentCompletions = pgTable('content_completions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  contentItemId: uuid('content_item_id').notNull().references(() => contentItems.id),
  answerText: text('answer_text').notNull(), // accepted at face value, no automated verification
  completedDate: date('completed_date').notNull(), // used to enforce once-per-day for riddle/trivia
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => ({
  // Enforces "riddles/trivia award once per day" (FR-3.4). Tasks (type: 'task') are exempt from
  // this constraint at the application level — evaluateContentCompletion() only enforces it for
  // type in ('riddle', 'trivia'), since a DB-level partial unique index would need to special-case
  // the type, which Drizzle expresses as a raw SQL partial index rather than a plain composite key.
  oncePerDayForRiddleTrivia: index('content_completions_once_per_day_idx').on(t.userId, t.contentItemId, t.completedDate),
}));
```

**Key field decisions:**
- `transactions.amount` is a plain signed integer, not a separate `earn`/`spend` type flag — sign alone is sufficient and keeps `SUM()` trivial (ADR-2).
- `transactions.reason` is a free-text string, not an enum, so admin-adjustment and riddle/task copy can carry human-readable specifics (e.g. game name, admin before/after values) without a combinatorial enum explosion.
- `highScores` uses a composite primary key `(user_id, game_id)` rather than a surrogate ID — there is exactly one high-score row per user per game by definition.

### Modified Models

None — this is a new service with no pre-existing schema.

### Schema / Migration Notes

- Initial migration creates all tables above in one Drizzle migration; no phased rollout needed since this is a greenfield schema.
- `games` table is seeded with the current hub cartridge + cabinet roster (costs per PRD FR-4.1 defaults: 1 for cartridge, 3 for cabinet) as part of initial setup, not hardcoded in application code.

---

## API & Interface Design

### New Endpoints

```
GET /api/balance
Auth: user session
Response: { balance: number, recent: Transaction[] }

POST /api/spend
Auth: user session
Request:  { gameId: string }
Response: { ok: true, newBalance: number } | { ok: false, error: "insufficient_balance", required: number, balance: number }

POST /api/scores/submit
Auth: user session OR service API key (bot)
Request:  { userId?: string, discordId?: string, gameId: string, score: number, isDailySubmission?: boolean }
Response: { recorded: true, awards: Array<{ amount: number, reason: string }> }
Errors:   400 invalid gameId/score, 401 unauthenticated, 404 unknown discordId (bot path)

GET /api/bounty/pending?gameId=&date=
Auth: service API key (bot only)
Response: { pending: boolean, gameId: string, gameDate: string } | { pending: false }

POST /api/bounty/set
Auth: service API key (bot only) — bot has already verified this is Carter via Discord-side auth
Request:  { gameId: string, gameDate: string, amount: number }
Response: { ok: true }

GET /api/users/by-discord-id?discordId=
Auth: service API key (bot only)
Response: { userId: string, displayName: string } | 404

GET /api/content
Auth: user session
Response: { items: Array<{ id: string, type: 'riddle'|'trivia'|'task', prompt: string, award: number, completedToday: boolean }> }
Note: "completedToday" is always false for type 'task' (unlimited repeats); reflects the once-per-day
constraint only for 'riddle'/'trivia'. No authoring endpoints (POST/PUT/DELETE on content_items) are
built in this initiative — rows are seeded directly. This is a deliberate scope cut (PRD Open Questions),
not an oversight.

POST /api/content/complete
Auth: user session
Request:  { contentItemId: string, answerText: string }
Response: { ok: true, awarded: number } | { ok: false, error: "already_completed_today" }
```

### Interface Contracts

```ts
// Shared response shape for any award-producing action
interface AwardResult {
  amount: number;      // signed
  reason: string;       // exact copy per UX "Critical copy samples"
  source: TransactionSource;
}

// lib/achievements.ts — the one function both site and bot submission paths call
function evaluateScoreSubmission(input: {
  userId: string;
  gameId: string;
  score: number;
  isDailySubmission: boolean;
}): Promise<AwardResult[]>;
```

### Backward Compatibility

N/A — greenfield API, no prior consumers.

---

## Implementation Patterns & Conventions

### Naming Conventions

| Construct | Convention | Example |
|-----------|-----------|---------|
| Functions | camelCase | `evaluateScoreSubmission()` |
| DB tables/columns | snake_case (Drizzle maps camelCase TS to snake_case SQL) | `achievement_awards` |
| React components (admin) | PascalCase | `UserDrillDown` |
| Route handler files | Next.js convention | `app/api/scores/submit/route.ts` |
| Transaction `reason` strings | Match UX Copy & Tone table exactly | `"High Score: Dino Run"` |

### Error Handling Pattern

```ts
// All route handlers validate with zod, then delegate to lib/ functions
// that throw typed domain errors, caught once at the handler boundary.
export async function POST(req: Request) {
  const body = SpendRequestSchema.parse(await req.json()); // throws ZodError -> 400
  try {
    const result = await spendTokens(session.userId, body.gameId);
    return Response.json({ ok: true, newBalance: result.newBalance });
  } catch (e) {
    if (e instanceof InsufficientBalanceError) {
      return Response.json({ ok: false, error: 'insufficient_balance', ...e.details }, { status: 402 });
    }
    throw e; // unhandled -> 500, logged
  }
}
```

**Rules:**
- Never swallow an error silently — domain errors are typed and mapped to specific HTTP statuses; anything unmapped bubbles to a logged 500.
- Every user-facing error response includes enough detail for the client to render the exact copy defined in the UX doc (e.g. `insufficient_balance` includes `required`/`balance` for the `"Need {N} tokens"` veil).

### Testing Pattern

```ts
// Achievement evaluation is pure business logic — test at the lib/ level, not via HTTP.
describe('evaluateScoreSubmission — interval_gap mode', () => {
  it('does not re-award between the last award and the next gap threshold', async () => {
    // seed: lastAwardedHighScore = 1000, gap = 100
    const first = await evaluateScoreSubmission({ score: 1050, ... });
    expect(first).toEqual([]); // updates currentHighScore, no award
    const second = await evaluateScoreSubmission({ score: 1100, ... });
    expect(second).toContainEqual(expect.objectContaining({ amount: expect.any(Number) }));
  });
});
```

**Coverage expectations:** 100% on `lib/ledger.ts`, `lib/achievements.ts`, `lib/leaderboard.ts` (these are the correctness-critical paths called out in PRD Quality Gates); no fixed target for admin UI components.
**Mocking strategy:** Mock at the DB client boundary (a test Postgres instance or Drizzle's in-memory-compatible test setup) — not at the `lib/` function boundary, since the whole point is verifying real constraint-driven idempotency (ADR-3).

---

## Security & Performance

### Security

| Concern | Mitigation |
|---------|-----------|
| Input validation | `zod` schemas on every route handler request body/query params |
| Auth/Authz (user routes) | Auth.js session cookie, verified server-side per request; admin routes additionally check `users.isAdmin` |
| Auth/Authz (bot routes) | Static service API key in an `Authorization` header, compared via constant-time check; bot key scoped only to bot-relevant routes |
| Secrets | Vercel environment variables only (`DATABASE_URL`, `NEXTAUTH_SECRET`, `BOT_API_KEY`, OAuth client secrets) — never logged |
| SQL injection | Drizzle parameterized queries throughout; no raw string-interpolated SQL |
| CORS | Backend allow-lists only the arcade site's production + preview origins for browser-originated requests; bot calls are server-to-server (no CORS relevance) |

### Performance

| Concern | Target | Approach |
|---------|--------|---------|
| Balance/transaction-log fetch | < 1s (PRD Measurable Outcome) | Index on `transactions(user_id, created_at)`; `SUM()` over a low-thousands-row table is trivial at this scale, no cache needed for v1 |
| Score submission (incl. achievement check) | < 500ms p99 | Single DB round-trip transaction wrapping the score update, achievement evaluation, and award insert |
| Admin dashboard page load | < 1s | Server-rendered Next.js pages with direct DB queries; no client-side waterfall |

### Observability

- **Logs:** Every transaction write logs `{ userId, amount, reason, source }` at info level; every failed auth attempt (bad service API key, expired session) logs at warn level.
- **Metrics:** None beyond Vercel's built-in function metrics for v1 — explicitly deferred given the ~5-20 user scale; revisit if the Growth Features (v2 analytics/heatmaps) demand it.
- **Traces:** Not needed at this scale/complexity — single-service, single-DB architecture with no distributed call chains to trace.

---

## Implementation Sequence

1. **Foundation** *(blocking)* — Next.js project scaffold, Drizzle schema + initial migration, Neon DB provisioning, Auth.js config (Google provider first), `lib/ledger.ts` core write helper.
2. **Core logic** *(depends on 1)* — `lib/achievements.ts` (threshold + interval-gap evaluation, ADR-3/ADR-5), `lib/leaderboard.ts` (midnight cutoff, 2+-submitter gating, default-award fallback via `games.default_top_score_award`), `lib/content.ts` (riddle/trivia/task completion + once-per-day enforcement for riddle/trivia, unlimited for task — content rows themselves are seeded, not authored in-app).
3. **API layer** *(depends on 2)* — all `/api/*` route handlers, `zod` schemas, service-API-key middleware for bot routes.
4. **Admin dashboard** *(depends on 2, can overlap with 3)* — users list/drill-down, achievement builder, game config, leaderboard edit/delete, bot log view, basic analytics.
5. **Arcade site integration** *(depends on 3)* — balance/toast widget (UX Mock-Up 2), API client module, spend-before-play wiring on existing cartridge/cabinet start flows, Discord-link step in Account surface.
6. **Discord bot API contract handoff** *(depends on 3)* — publish the finalized `/api/scores/submit`, `/api/bounty/*`, `/api/users/by-discord-id` contract to Carter for his separate bot build; this is a documentation/communication milestone, not a code deliverable of this initiative.
7. **Testing** *(parallel with 2-4)* — unit tests on `lib/ledger.ts`, `lib/achievements.ts`, `lib/leaderboard.ts` per Testing Pattern coverage expectations.
8. **Polish** *(depends on 3-5)* — error message copy alignment with UX doc, logging per Observability section, CORS lockdown.

**Parallel work opportunities:** Admin dashboard (4) and arcade site integration (5) can be built concurrently once the API layer (3) contract is stable, since both are pure consumers of it.

**Known implementation risks:**
- Neon/Vercel Marketplace Postgres provisioning and connection-pooling behavior under Vercel Fluid Compute is worth a quick spike before Foundation is considered done — confirm the serverless driver handles connection reuse correctly rather than exhausting Neon's connection limit under bursty admin-dashboard + API traffic.
- CORS + cookie-based session auth across two different subdomains (arcade site's domain vs. `dev.cartercripe.com`) needs verification early — cross-subdomain cookie/session handling is a common source of silent auth failures.
