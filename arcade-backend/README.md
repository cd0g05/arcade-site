# arcade-backend

Token system backend + admin dashboard for Carter's Arcade. Lives in this repo but deploys
as its **own separate Vercel project** (see Tech Design ADR-1), hosted at
`dev.cartercripe.com/arcade`.

## One-time manual setup (Builder — cannot be automated by an agent)

These steps require account access this environment doesn't have. Do them once, then local
dev and CI can proceed normally.

1. **Neon Postgres**: In the Vercel dashboard, add the Neon integration from the Marketplace
   and create a database for this project. Copy the connection string into `DATABASE_URL`.
2. **Google OAuth**: In Google Cloud Console, create an OAuth 2.0 Client ID (Web application).
   Add `http://localhost:3001/arcade/api/auth/callback/google` and the production callback URL
   (`https://dev.cartercripe.com/arcade/api/auth/callback/google`) as
   authorized redirect URIs. Copy the client ID/secret into `.env.local`.
3. **Discord OAuth** (optional account-link provider): In the Discord Developer Portal,
   create an application, enable OAuth2, add the matching callback URLs. Copy the client
   ID/secret into `.env.local`.
4. **Vercel project**: Create a new Vercel project pointing at this repo with **Root
   Directory set to `arcade-backend`**, so it deploys independently from the static arcade
   site's own Vercel project. Assign it the `dev.cartercripe.com/arcade` domain/route.
5. **`BOT_API_KEY`**: Generate one (`openssl rand -hex 32`) and set it in this project's env
   vars. Hand the same value to the separate Discord bot project when Carter builds it.
6. **`AUTH_SECRET`**: Generate one (`openssl rand -base64 32`) and set it locally **and** in
   the Vercel project's env vars. Auth.js v5 requires it — without it every auth
   route returns HTTP 500 (`"There was a problem with the server configuration"`) rather than
   a useful error, which is an easy hour to lose.

## Local development

```
cp .env.example .env.local   # then fill in the values from steps above
npm install
npm run db:generate   # generate a migration from lib/db/schema.ts (only needed after schema changes)
npm run db:migrate    # apply migrations to DATABASE_URL
npm run db:seed       # seed the games table from the current arcade roster
npm run dev           # http://localhost:3001/arcade  (the app is served under /arcade)
```

## Notes

- `lib/ledger.ts` is the only file permitted to write `transactions` rows (ADR-2) — balance
  is always `SUM(amount)`, never a stored field.
- The DB client uses Drizzle's **`neon-http`** driver, which has **no `db.transaction()`
  support** (it throws). Use `db.batch([...])` or a single-statement data-modifying CTE where
  atomicity matters — see tech-design.md "Spike result: Neon pooling under Fluid Compute".
  `scripts/spike-neon-pooling.ts` re-runs the connection-pooling verification if the driver
  or Neon plan ever changes.
- See `.cicadas/active/token-system/tech-design.md` for the full architecture and
  `docs/discord-bot-api.md` (added in `feat/api-and-bot-contract`) for the bot-facing API
  contract.
