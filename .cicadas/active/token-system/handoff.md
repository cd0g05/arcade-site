---
boundary: partition-complete
initiative: token-system
---

# Handoff: feat/economy-engine complete → Partitions 3 & 4 next (parallel)

## Just completed

**Partition 2 (`feat/economy-engine`) — tasks 20-39.** Merged into `initiative/token-system` as `1881bdf` and pushed. Partition 1 (`feat/backend-foundation`, ids 1-17) was completed and merged earlier in the same session (`2b4f861`).

45 tests green against the live Neon instance. 100% statement/line/function coverage on `ledger.ts`, `achievements.ts`, `leaderboard.ts`, `content.ts`, `spend.ts` (residual branch gaps are unreachable defensive `??` fallbacks, not missing tests).

Two schema additions beyond the original plan, both replacing a racy read-then-write guard with a DB constraint per ADR-3 — recorded as tasks 38 and 39. Task 39 was found by a failing test, not by inspection.

## Approved/authoritative state

- `tasks.md` → `## Partition: feat/api-and-bot-contract` (ids 40-52) and `## Partition: feat/admin-dashboard` (ids 60-70). Front matter `next_section` points at Partition 3.
- `tech-design.md` → `### Spike result: Neon pooling under Fluid Compute` (driver constraint), `## API & Interface Design` → `### New Endpoints` + `### Interface Contracts` (the routes to build), `### Error Handling Pattern` (zod → typed domain error → HTTP status), `## Data Models` → `### Schema / Migration Notes` (as-built migration table + both deviations).
- `approach.md` → `### Partition 3` / `### Partition 4` scope + acceptance criteria; `## Risks & Mitigations`.
- `ux.md` → Copy & Tone table (exact `reason` strings), Mock-Up 1 `admin-users.html` for Partition 4.
- Code: `arcade-backend/lib/{ledger,achievements,leaderboard,spend,content}.ts` — the frozen library layer Partitions 3 and 4 consume.

## Next action

`approach.md` says **Partitions 3 and 4 can now run in parallel**, since both only read the `lib/` layer and don't depend on each other.

- **Partition 3 — `feat/api-and-bot-contract`** (ids 40-52): bot API-key middleware (constant-time, `isValidBotApiKey` already exists in `lib/auth.ts`), the 8 routes, zod schemas on every route, CORS allow-list, integration tests, and `docs/discord-bot-api.md`.
- **Partition 4 — `feat/admin-dashboard`** (ids 60-70): `/admin` guard on `users.isAdmin`, Users list + drill-down, balance-adjust confirm flow, achievement builder, games/leaderboards/bot-log/analytics pages.

Register the branch off `initiative/token-system` before implementing. Run `npm run db:migrate` first — migrations `0001` and `0002` are new.

## Reload list

1. `canon/summary.md`
2. `tasks.md` front matter + the target partition's section
3. `tech-design.md` front matter + `### New Endpoints` + `### Interface Contracts` + `### Error Handling Pattern`
4. `approach.md` front matter + the target partition's section
5. The frozen lib signatures — see the "PARTITION 2 COMPLETE" signal on the initiative, which lists every exported function and its shape

## Carry forward

- **Open Builder question (flagged inline in `approach.md`)** — interval-gap achievement awards intentionally write **no** `achievement_awards` row, because that table's unique `(user_id, achievement_id)` key means "once ever", which is wrong for awards that repeat at every gap multiple. They are guarded by a compare-and-set on `high_scores.last_awarded_high_score` instead. This diverges from one Partition 2 acceptance criterion as literally written. If a full audit trail of every gap award is wanted, `achievement_awards` needs its constraint relaxed — a schema change deliberately not made unilaterally.
- **`settleDailyTopScore()` is one-shot per game/day by constraint.** Whoever leads at the first successful call keeps the award; there is no re-settle. Call it only after the day closes. Whatever triggers it (cron, admin action, bot) is a Partition 3/4 decision that has not been made.
- **`db.transaction()` is unavailable** on the neon-http driver. Any new atomic multi-write must be a single-statement CTE or `db.batch()`, and per ADR-2 the `transactions` INSERT must live in `lib/ledger.ts`.
- **Per-row query loops are the performance trap** for Partition 4 — each neon-http query is its own HTTPS round trip (100 concurrent showed ~13× per-query latency degradation). Batch/join in SQL on the Users list and Analytics pages.
- **Task id:99** (verify both Vercel projects' Root Directory scoping, no env var leakage) is Builder-manual and still open. `DATABASE_URL` and `AUTH_SECRET` are currently set in local `.env.local` only — the Vercel project needs its own.
- **Uncommitted, deliberately left alone**: `instructions.md` (modified) and `TOKEN_SYSTEM_SPEC.md` (untracked) are the Builder's raw brain-dump inputs, not agent work product.
- **Branch topology**: `main` intentionally does not have Partition 1 or 2 (per the Builder's merge decision this session — initiative-only). `main` is behind and catches up at initiative completion.
