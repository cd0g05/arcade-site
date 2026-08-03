# Discord Bot API Contract

The API surface the Discord bot codes against. The bot is a separate codebase, so this
document is the only thing keeping the two sides in sync — if a route changes, change this
file in the same commit.

**Base URL:** the `arcade-backend` deployment (`https://dev.cartercripe.com/arcade` in
production; `http://localhost:3001/arcade` in local dev). Every path below is
relative to it — the `/arcade` prefix is part of the base, not repeated per route.

---

## Authentication

Bot routes use a **static service API key**, not a user session:

```
Authorization: Bearer $BOT_API_KEY
```

A bare `Authorization: <key>` without the `Bearer` prefix is also accepted.

- The key is compared in **constant time** (`lib/bot-key.ts`) — do not assume a wrong key
  fails faster or slower than a right one.
- A missing or wrong key returns **`401 {"error": "unauthorized"}`** on every bot route.
- An admin *user session* is **not** a substitute for the key on bot-only routes.
- Bot calls are server-to-server and send no `Origin` header, so CORS never applies to
  them. CORS is only relevant to the arcade site's browser calls.

| Route | Auth |
|---|---|
| `POST /api/scores/submit` | service key **or** user session |
| `GET /api/bounty/pending` | service key only |
| `POST /api/bounty/set` | service key only |
| `GET /api/users/by-discord-id` | service key only |
| `POST /api/bot/log` | service key only |
| `GET /api/balance`, `POST /api/spend`, `GET /api/content`, `POST /api/content/complete` | user session only — **not callable by the bot** |

---

## Errors

Every route shares one error boundary:

| Status | Body | Meaning |
|---|---|---|
| `400` | `{"error": "invalid_request", "issues": [...]}` | Failed zod validation; `issues` is the raw zod issue list |
| `400` | `{"error": "invalid_json"}` | Body was not parseable JSON |
| `401` | `{"error": "unauthorized"}` | Missing/invalid key or session |
| `404` | `{"error": "unknown_discord_id"}` | Discord account is not linked to an arcade account |
| `500` | `{"error": "internal_error"}` | Unmapped failure; details are logged server-side only |

Some routes model an expected negative outcome as a **`200`** with `ok: false` rather than
an error status — see `/api/content/complete`. Those are outcomes, not failures.

---

## `POST /api/scores/submit`

Logs a score and returns every award it triggered. **The bot's primary endpoint.**

```jsonc
// Request
{
  "discordId": "123456789012345678",  // bot path: resolve the player by Discord ID
  "userId": "uuid",                   // alternative to discordId if already resolved
  "gameId": "dino-run",
  "score": 1200,
  "isDailySubmission": true           // default false
}
```

```jsonc
// 200
{
  "recorded": true,
  "awards": [
    { "amount": 5,  "reason": "Daily Submission: Dino Run", "source": "daily_submission" },
    { "amount": 25, "reason": "High Score: Dino Run",       "source": "achievement" }
  ]
}
```

- Exactly one of `discordId` / `userId` is required **on the bot path**; omitting both
  returns `400 {"error": "discord_id_or_user_id_required"}`.
- `404 {"error": "unknown_discord_id"}` when the Discord account is not linked — this is
  the expected signal to prompt the player to link their account, not an error to retry.
- `400 {"error": "unknown_game"}` for a `gameId` not in the roster.
- `score` must be a **non-negative integer**.
- `awards` may be an empty array — a submission that beats nothing still records the score.
- **Safe to retry.** Award idempotency is enforced by database constraints (ADR-3), so
  resending after a timeout will not double-award. Note the daily *participation* award is
  paid per submission by design, so genuinely resubmitting a second score for the same day
  pays `+5` again.
- On a session-authenticated call the subject is always the session's own user; a `userId`
  in the body is ignored.

---

## `GET /api/bounty/pending?gameId=&date=`

Asks whether a bounty is **awaiting Carter's input** for a game/day (FR-6.1).

```jsonc
// 200 — Carter posted a score and has not yet named an amount
{ "pending": true, "gameId": "dino-run", "gameDate": "2026-07-25" }

// 200 — nothing to prompt for
{ "pending": false }
```

- `date` is `YYYY-MM-DD`, defaulting to today.
- "Pending" specifically means *a bounty row exists with no amount set*. That row is opened
  automatically when Carter (the admin account) submits a daily score. It is **not** a
  general "an unclaimed bounty exists" check — once the amount is set, `pending` is `false`.

### Bounty flow

1. Carter posts his daily score; the bot submits it via `/api/scores/submit` with
   `isDailySubmission: true`. The backend opens the pending bounty row.
2. Bot polls `/api/bounty/pending` → `pending: true`.
3. Bot DMs Carter for an amount, then calls `/api/bounty/set`.
4. Bot deletes the DM exchange and posts the public
   "Beat Carter's score for a {N} token bounty" message.
5. After midnight the backend's own cron settles the day and pays the winner. **The bot
   does not settle anything.**

---

## `POST /api/bounty/set`

```jsonc
// Request
{ "gameId": "dino-run", "gameDate": "2026-07-25", "amount": 25 }

// 200
{ "ok": true }
```

- `amount` must be a **positive integer**.
- Upsert: calling twice for the same game/day overwrites the amount rather than creating a
  second bounty. Safe to retry.
- `400 {"error": "unknown_game"}` for an unknown `gameId`.
- No user identity is checked beyond the key — the bot is trusted to have verified this is
  Carter on the Discord side.

---

## `GET /api/users/by-discord-id?discordId=`

```jsonc
// 200
{ "userId": "uuid", "displayName": "Player Name" }

// 404
{ "error": "unknown_discord_id" }
```

`404` is a normal answer, not a fault: Discord linking is optional. Use it to decide
whether to prompt someone to link before their scores can count.

---

## `POST /api/bot/log`

Records a bot-originated event for the admin's read-only action log (FR-5.4).

```jsonc
// Request
{
  "eventType": "score_submitted",   // free-form; conventionally one of
                                    // score_submitted | bounty_set | message_posted
  "payload": { "discordId": "123", "gameId": "dino-run", "score": 1200 }
}

// 200
{ "ok": true, "id": "uuid" }
```

- `payload` is stored as opaque JSON — record whatever is useful for debugging.
- `eventType` is intentionally not a closed enum; a new event type will be accepted and
  shown in the admin log rather than rejected.
- Fire-and-forget: **never** let a logging failure block a user-facing bot action.

---

## Award reference

`reason` strings are user-facing copy and are rendered verbatim by the site's toasts, so
the bot should echo them rather than composing its own.

| Earn | Amount | `source` |
|---|---|---|
| Daily login | `10` | `login` |
| Daily-game participation | `5` (every submission) | `daily_submission` |
| Daily top score, no bounty set | per-game default (`10` unless configured) | `daily_submission` |
| Daily top score, bounty set | the bounty amount | `bounty` |
| Achievement | per-achievement, admin-configured | `achievement` |
| Riddle / trivia | per-item, once per day | `riddle` |
| Task | per-item, unlimited | `task` |

The daily top-score award requires **2+ distinct submitters** for that game/day (FR-3.3).
With only one submitter, the participation award is still paid but no top-score award is.

---

## Notes for the bot implementation

- **Do not call any settle endpoint.** `POST /api/cron/settle-daily` is triggered by a
  Vercel cron at 00:15 UTC and is one-shot per game/day by database constraint — calling it
  mid-day would award the day to whoever happened to be leading at that moment, with no way
  to re-settle.
- **Day boundaries are server-local (UTC on Vercel).** `gameDate` values are plain
  `YYYY-MM-DD` with no timezone. If the bot computes a date itself, compute it in UTC or
  the two sides will disagree for a few hours each day.
- **Balance and spend are session-only.** The bot cannot read a user's balance or spend on
  their behalf; those require a browser session on the arcade site.
- **Log liberally.** `POST /api/bot/log` is the only window Carter has into what the bot did
  when something looks wrong — the admin Bot Log page reads nothing else.
