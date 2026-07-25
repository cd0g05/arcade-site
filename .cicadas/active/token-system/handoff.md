---
boundary: partition-complete
initiative: token-system
---

# Handoff: Partitions 3 & 4 complete → Partition 5 (`feat/site-integration`) is the last one

## Just completed

**Partition 3 (`feat/api-and-bot-contract`, ids 40-57)** — merged as `512dbc8`.
**Partition 4 (`feat/admin-dashboard`, ids 60-73)** — merged as `b14cf69`.

Both into `initiative/token-system`, pushed. Partitions 1 and 2 landed earlier.

105 tests green against the live Neon instance (47 lib + 34 route + 16 admin server + 8
admin component). All 20 routes/pages compile under `next build`.

Three Builder decisions were taken at the start of this session and are recorded in the
specs: interval-gap achievements keep writing no `achievement_awards` row (criterion
amended, no schema change); the daily settle is triggered by a Vercel cron; partitions 3
and 4 ran back to back.

## Approved/authoritative state

- `tasks.md` → `## Partition: feat/site-integration`. Front matter `next_section` points at it.
- `tech-design.md` → `### As-built notes (feat/api-and-bot-contract)` and
  `### As-built notes (feat/admin-dashboard)` — read both before touching either layer;
  `### New Endpoints` is the contract the site consumes.
- `approach.md` → `### Partition 5` scope + acceptance criteria.
- `arcade-backend/docs/discord-bot-api.md` — the published contract. The session-only
  routes in it (`GET /api/balance`, `POST /api/spend`, `GET /api/content`,
  `POST /api/content/complete`) are exactly what the arcade site calls.
- Code: `arcade-backend/app/api/**` (frozen for consumers), `arcade-backend/lib/**`.

## Next action

**Partition 5 — `feat/site-integration`**, the only partition touching the existing
`src/` arcade site rather than `arcade-backend/`. Balance/toast widget (UX Mock-Up 2),
API client module, spend-before-play wiring on the existing cartridge/cabinet start flows,
Discord-link step in the Account surface.

Register the branch off `initiative/token-system` first. Migrations `0001`-`0003` are all
applied to the live DB already; run `npm run db:migrate` anyway if starting fresh.

## Reload list

1. `canon/repo-context.md` (note: there is no `canon/summary.md` yet — it gets written at
   initiative completion)
2. `tasks.md` front matter + `## Partition: feat/site-integration`
3. `approach.md` front matter + `### Partition 5`
4. `tech-design.md` → `### New Endpoints` + `### As-built notes (feat/api-and-bot-contract)`
5. `ux.md` → Mock-Up 2 (`site-balance-pill.html`), Copy & Tone table, the Token Balance
   Pill UI-states table
6. `arcade-backend/docs/discord-bot-api.md`

## Carry forward

- **CORS is credential-bearing.** `lib/cors.ts` allow-lists `https://arcade.cartercripe.com`
  plus localhost:5173 in dev. The site must fetch with `credentials: 'include'`, and the
  real production/preview origins need `CORS_ALLOWED_ORIGINS` /
  `CORS_ALLOWED_ORIGIN_SUFFIXES` set in the Vercel project.
- **Cross-subdomain cookie/session auth is still unverified** and was flagged in
  tech-design.md as a likely source of silent auth failures — the site and backend are on
  different subdomains. Worth testing early in Partition 5.
- **Don't change the spend `reason` copy.** Admin Analytics counts plays by matching
  `transactions.reason` against a reconstructed `"{Tier}: {Display Name}"` string, because
  `transactions` has no `game_id` (game-agnostic per ADR-2). A copy change silently zeroes
  that count. A `transactions.game_id` column is the durable fix.
- **`settleDailyTopScore()` now has a caller** (`/api/cron/settle-daily`, cron at 00:15
  UTC, settles *yesterday*). Nothing else should call it — it is one-shot per game/day.
- **`db.transaction()` is still unavailable** on the neon-http driver. New atomic
  multi-writes must be a single-statement CTE or `db.batch()`, and per ADR-2 the
  `transactions` INSERT must live in `lib/ledger.ts`.
- **Env vars the Vercel project still needs**: `DATABASE_URL`, `AUTH_SECRET`,
  `BOT_API_KEY`, `CRON_SECRET`, `CORS_ALLOWED_ORIGINS`, Google/Discord OAuth secrets.
  Currently local `.env.local` only. **Task id:99** (verify both Vercel projects' Root
  Directory scoping, no env var leakage) is Builder-manual and still open.
- **`achievement_awards` has an FK to `achievements`**, so admin criteria rows are
  deactivated, never deleted. Anything that "cleans up" achievements must respect this.
- **`@vitejs/plugin-react` is pinned to v4** — v6 requires Vite 8 and vitest 2.1.9 ships
  Vite 5. Component tests opt into jsdom per-file with an `@vitest-environment` docblock;
  `next-auth` cannot be imported under a node test env at all, so mock `@/lib/auth`
  wholesale rather than spreading `importOriginal`.
- **Uncommitted, deliberately left alone**: `instructions.md` (modified) and
  `TOKEN_SYSTEM_SPEC.md` (untracked) are the Builder's raw brain-dump inputs.
- **Branch topology**: `main` still has neither the backend nor the admin dashboard — it
  catches up at initiative completion, per the Builder's earlier initiative-only merge
  decision.
