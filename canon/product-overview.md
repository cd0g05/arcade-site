# Product Overview

> Canon document. Updated by the Synthesis agent at the close of each initiative.

## What This Is

Carter's Arcade (arcade.cartercripe.com) is a personal portfolio site built as a real, playable arcade: a hub page of six click-to-wake mini-games plus six full-page cabinet games, all handmade pixel graphics with zero game engines and zero runtime npm dependencies.

## Why It Exists

Carter wanted a portfolio piece that demonstrates craft rather than describes it — a site visitors actually play with instead of read. The starting point was a single self-contained HTML mockup (`Arcade Mockup Claude.html`) with hand-drawn visual language and a click-to-wake interaction model; the `arcade-buildout` initiative turned that mockup into a real Vite + TypeScript site with working game logic, persistence, and a deployable cabinet system, while preserving the mockup's look and feel exactly.

---

## Users & Journeys

### Visitor — Portfolio Browser

**Who they are:** Someone who lands on arcade.cartercripe.com from a resume, LinkedIn, or word of mouth, evaluating Carter's work.

**Their journey:** Arrives at the hub, sees a wall of "live" cabinet cards and six playable games embedded right on the page. Clicks a card, it wakes with a beep and starts responding to clicks/keys immediately — no loading screen, no login. Plays a couple of games, maybe checks the high-score table, leaves with "oh, these are all real" as the takeaway.

**Key needs:**
- Instant, frictionless play — no accounts, no permission prompts beyond browser default
- Confidence that a card is playable before clicking it (LIVE vs SOON must be honest)
- The experience should not feel like a tech demo — it should feel like a finished small arcade

### Carter — Owner / Sole Developer

**Who they are:** The site's builder and only maintainer, using this repo to keep sharpening game-dev and site-craft skills over time.

**Their journey:** Periodically adds a new cabinet or hub game following the documented "add a game" recipe in `README.md`, extends the sprite palette, and keeps the deploy pipeline (Vercel, static) simple enough to not think about.

**Key needs:**
- A contract stable enough that adding game #14 doesn't require touching the hub, input routing, or card chrome
- Confidence that a new game can't accidentally break another game's keyboard input (the click-to-wake invariant)
- Cheap iteration: no build step beyond `npm run dev`, no backend to run locally

---

## Core Features (Current)

| Feature | Description | Status |
|---------|-------------|--------|
| Hub cartridges | Six games embedded directly in cards on the hub page (Dino Run, 2048, Token Miner, Echo, Memory, Lights Out) | Shipped |
| Cabinet games | Six full-page games on a shared scaffold (Snake, Bricks, Aim Trainer, Minesweeper, Water Sort, Setrit) | Shipped |
| Click-to-wake model | A card/page starts asleep (scrolling normally); clicking wakes it and routes keyboard input to it; clicking away or Esc pauses without losing state | Shipped |
| CSS-takeover fullscreen | Any game can go fullscreen via `F` or the ⛶ button — a CSS position:fixed takeover, not the browser Fullscreen API | Shipped |
| Local high scores | Every game persists a best score / fewest-moves / best time under an `arcade:`-prefixed localStorage key | Shipped |
| Live scoreboard + ticker | Hub-page scoreboard table and marquee ticker read current bests every 2s | Shipped |
| Reset save data | Inline (no browser dialog) confirm flow wipes all `arcade:*` keys and re-zeroes every card | Shipped |
| Token Miner (idle game) | The one `alwaysOn` cartridge — runs continuously, accrues offline earnings capped at 4 hours | Shipped |
| Style guide page | `/style-guide/` — living reference for the palette, type tiers, pixel-shadow/steps() system, and sprite sheet | Shipped |
| Sprite pipeline | ASCII palette maps (`src/sprites/maps.ts`) compile to committed inline-SVG modules via `npm run sprites` | Shipped |
| Vercel deploy + analytics | Static Vite build, `/_vercel/insights/script.js` on every page | Shipped |
| Accounts / login | — | Out of scope (see below) |

## Out of Scope (Intentional)

- **User accounts, multiplayer, leaderboards across users** — this is a single-visitor, local-storage-only site; no backend, no auth. (A token-economy/Discord-bot concept has been sketched by Carter post-initiative but is not part of this canon yet — see Open Questions.)
- **A game engine (Phaser, PixiJS, etc.)** — every game is hand-rolled canvas/DOM + the shared `src/lib` runtime, by design (the site's whole pitch is "no engines").
- **Server-side score verification / anti-cheat** — localStorage is trivially editable; scores are for fun, not competition integrity.
- **Full SRS Tetris rotation system** — Setrit's rotation/kick table is intentionally simplified ("standard-feeling," not guideline-perfect) per an explicit tech-design timebox.

---

## Success Criteria

- All 12 games playable end-to-end with persisted bests surviving reload.
- Zero regressions in the key-routing invariant (asleep games never eat page scroll; only `hub.ts` calls `preventDefault` on nav keys).
- Lighthouse Accessibility ≥ 95 on hub and cabinet pages (currently 100 on every audited page).
- Hub JS payload well under the 100 KB gzip budget (currently ~11.5 KB).
- Site live at arcade.cartercripe.com with Vercel Web Analytics recording page views.

---

## Open Questions

- **Vercel production cutover** — project link, Web Analytics enablement, and the `arcade.cartercripe.com` domain point-over are still manual Builder (Carter) steps as of initiative close.
- **Token economy concept** — Carter has drafted a `TOKEN_SYSTEM_SPEC.md` (earn/spend tokens, Discord-bot score scraping, daily bounties, achievements, possibly login/auth). This is real future scope but has not been through clarify/PRD yet; it is **not** reflected elsewhere in this canon and should not be assumed available until its own initiative lands. — Owner: Carter, no urgency set.
- **7th+ cabinet card** — 7 "flavor" SOON cards remain on the hub (including a Sudoku DAILY-pill mockup) with no committed roadmap to build them.
