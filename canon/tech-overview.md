# Tech Overview

> Canon document. Updated by the Synthesis agent at the close of each initiative.

## What This Is

A Vite + vanilla-TypeScript static multi-page site: one hub page with six embedded mini-games, six full-page cabinet games on a shared scaffold, plus a style-guide reference page. No frontend framework, no game engine, no backend, no runtime npm dependencies — everything ships as hand-written TS/canvas/DOM against a small shared runtime (`src/lib`).

---

## Tech Stack

| Category | Selection | Notes |
|----------|-----------|-------|
| **Language/Runtime** | TypeScript 7 (native `tsc`), strict mode | `noUncheckedIndexedAccess`, `noImplicitOverride`, `noUnusedLocals/Parameters`, `verbatimModuleSyntax` all on |
| **Framework** | None | Vanilla DOM/canvas per file; each page is its own Vite rollup entry (MPA, not SPA) |
| **Database** | None | All state is client-side `localStorage`, `arcade:`-prefixed |
| **Auth** | None | No accounts by design |
| **Build tool** | Vite 8 | 9 HTML rollup inputs (hub, demo, style-guide, 6 cabinets); `tsc --noEmit && vite build` |
| **Testing** | Vitest 4, node environment | Pure-logic modules only (`src/tests/**/*.spec.ts`); rendering/loop code is checked manually via a key-routing/touch checklist, not unit-tested |
| **Fonts** | `@fontsource/press-start-2p`, `@fontsource/jetbrains-mono` | Display + UI mono tiers; `font-display: swap` |
| **Deployment** | Vercel, static preset | `vercel.json`; `/_vercel/insights/script.js` (Web Analytics) on every HTML entry |

---

## Project Structure

```
arcade/
├── index.html                # hub page shell (static structure; script mounts games)
├── demo/index.html            # throwaway contract-proving cartridge (kept for reference)
├── style-guide/index.html     # living design-system reference
├── games/                     # cabinet page shells — near-empty, rendered by cabinet-entry.ts
│   ├── snake/index.html
│   ├── bricks/index.html
│   ├── aim/index.html
│   ├── minesweeper/index.html
│   ├── water-sort/index.html
│   └── setrit/index.html
├── src/
│   ├── lib/                   # frozen shared runtime — changes require a Signal broadcast
│   │   ├── hub.ts             # THE sole owner of document-level key/mouse listeners
│   │   ├── cartridge.ts       # the Cartridge contract type
│   │   ├── card.ts            # (actually in src/ui — see below)
│   │   ├── storage.ts         # tolerant arcade:-prefixed localStorage wrapper
│   │   ├── audio.ts           # lazy AudioContext, beep(), sound toggle
│   │   ├── screen.ts          # low-res pixelated canvas setup (DPR handling)
│   │   ├── loop.ts            # fixed-timestep accumulator + rAF render
│   │   └── input.ts           # tap/swipe/long-press gesture recognizer
│   ├── ui/                    # shared chrome — also frozen
│   │   ├── card.ts            # createCard(): the .gcard DOM (veil, LED, ⛶, stats)
│   │   ├── cabinet.ts         # createCabinet(): the cabinet-page scaffold
│   │   ├── scoreboard.ts      # createScoreboard(): live-refreshing stat cells
│   │   └── ticker.ts          # fillTicker(): marquee items
│   ├── games/                 # one directory per game — NOT frozen, this is where new games go
│   │   ├── {game}/logic.ts    # pure rules, no DOM, injectable rand (unit-tested)
│   │   ├── {game}/{game}.ts   # UI: mounts into a GameCard, returns a Cartridge
│   │   ├── {game}/{game}.css  # game-owned styles (imported by the module)
│   │   ├── types.ts           # MountedGame, CabinetDef shared shapes
│   │   └── format.ts          # pad()/fmt() number formatting helpers
│   ├── pages/                 # Vite entry scripts (one per rollup input)
│   │   ├── hub.ts             # hub chrome + mounts the 6 hub cartridges
│   │   ├── cabinet-entry.ts   # shared cabinet bootstrapper (data-game dispatch)
│   │   ├── style-guide.ts
│   │   └── demo.ts
│   ├── sprites/
│   │   ├── maps.ts            # ASCII palette maps (source of truth)
│   │   └── generated.ts       # committed inline-SVG output of `npm run sprites`
│   ├── styles/                # frozen global CSS (tokens, base, arcade, fonts)
│   └── tests/                 # Vitest specs, one file per logic.ts (+ storage, loop, input)
├── scripts/gen-sprites.ts      # ASCII map → SVG compiler (`npm run sprites`)
├── vite.config.ts              # 9 HTML rollup inputs
└── vercel.json                 # static Vite preset deploy config
```

---

## Architecture

### System Design

A **click-to-wake cartridge model**: every game — whether embedded in a hub card or living on its own cabinet page — implements a small `Cartridge` interface and registers with a single per-page `Hub` singleton. The Hub is the *only* code allowed to attach document-level keyboard/mouse listeners or call `preventDefault()` on navigation keys; games never touch `document` directly. This one invariant is what lets 12 independently-authored games coexist on a page (and, for cabinets, a whole separate page) without ever fighting over scroll or input.

Two runtime idioms carry the rest of the system: a **fixed-timestep loop** (`createLoop`, 60 Hz accumulator + rAF render) for real-time games, and pure, injectable-`rand` **`logic.ts` modules** for anything with rules worth unit-testing (2048, Snake, Minesweeper, Water Sort, Setrit, Lights Out, Miner economics).

### Key Components

| Component | Responsibility | Key Files |
|-----------|----------------|-----------|
| Hub | Wake/sleep arbitration, CSS fullscreen, the key-routing invariant | `src/lib/hub.ts` |
| Cartridge contract | The shape every game implements (`keys?`, `onKey?`, `alwaysOn?`, `start()`, `stop()`) | `src/lib/cartridge.ts` |
| Card / Cabinet scaffold | Shared DOM chrome (veil, LED, ⛶, stats row, aria-live status) so per-game UI can't drift | `src/ui/card.ts`, `src/ui/cabinet.ts` |
| Cabinet entry | Reads `<body data-game>`, dynamic-imports the matching game module as its own chunk, wires it into the scaffold + Hub | `src/pages/cabinet-entry.ts` |
| Storage | Tolerant `arcade:`-prefixed localStorage get/set/clearAll with optional shape validators | `src/lib/storage.ts` |
| Loop | Fixed 60 Hz update decoupled from render, so game speed is display-refresh-independent | `src/lib/loop.ts` |
| Input | Element-scoped tap/swipe/long-press, scroll-vs-swipe decided by CSS `touch-action` (never `preventDefault` fights) | `src/lib/input.ts` |
| Sprite pipeline | ASCII palette maps compiled to committed inline-SVG at build time (no runtime SVG generation) | `src/sprites/maps.ts` → `generated.ts` |

### Data Flow

```
Page load → page entry script (hub.ts / cabinet-entry.ts)
  → for each game: mount(card) → Cartridge { keys, onKey, start, stop }
  → Hub.register(id, cartridge, cardElement)
  → Hub attaches ONE set of document listeners (lazy, on first register)
User click/keydown → Hub arbitrates wake/sleep/fullscreen
  → if a game is awake and claims the key → Cartridge.onKey(key)
  → else if it's a nav key → preventDefault only (no game reacts)
  → else → nothing prevented, page scrolls normally
Game state changes → store.set("arcade:best:{game}", value) → localStorage
Every 2s → createScoreboard() re-reads localStorage → updates the hub table
```

### Key Architecture Decisions

- **Click-to-wake, not always-hot:** every game (except the one `alwaysOn` idle game, Token Miner) starts asleep and pauses on click-away — this is what makes 12 games on one page safe, and it's also the #1 flagged bug class in the PRD (input leaking to the wrong game / stealing page scroll), hence the single-owner `hub.ts` invariant.
- **CSS-takeover fullscreen, never the Fullscreen API:** `.fs` class + `body.has-fs`, `position: fixed; inset: 0`. Chosen for reliability across browsers/embeds over the native API's permission quirks.
- **Fixed-timestep loop decoupled from render:** ports from the original mockup ran physics per-animation-frame, which doubled speed on 120 Hz displays. `createLoop` fixes this with a classic accumulator (default 1000/60 ms step, `render(alpha)` separate).
- **Game-owned CSS, frozen shared CSS:** `src/styles/*` is frozen after foundation; every game since ships its own `{game}.css` imported by its own module. Any exception (the launch a11y pass touched a few frozen-layer rules) must be broadcast as a Signal.
- **Cabinet chrome via a shared scaffold + dynamic import, not copy-paste HTML:** `cabinet-entry.ts` + `createCabinet()` mean cabinet HTML files are ~3-line shells (`<body data-game="snake">`), so chrome cannot drift between games and each game's code is its own lazy-loaded chunk.
- **Storage is tolerant, not strict:** `store.get(key, fallback, validator?)` never throws on corrupt/missing data — it falls back and warns. This matters because localStorage is user-editable and this product has no server-side truth to fall back to.
- **Pure `logic.ts` + injectable `rand`:** every game with meaningful rules (2048, Minesweeper, Water Sort, Setrit, Lights Out, Snake, Miner economics) separates rules from rendering so the rules are deterministically testable. Water Sort in particular proves solvability by construction (reverse-pour generation) and the test suite replays the generator's own solution.
- **Naming doctrine — trademarks over cleverness:** games get their common name unless a lawyer would recognize it as a live mark. SIMON was verified as a live Hasbro trademark (US Reg. 1211692) mid-initiative and renamed to **ECHO**; Tetris → **Setrit**, Breakout → **Bricks** were resolved the same way from the start.

---

## Data Models

### Cartridge (the contract every game implements)

```ts
interface Cartridge {
  keys?: string[];              // keys this game claims while awake (mouse games: none)
  onKey?(key: string): void;    // called by the Hub, never wired by the game itself
  alwaysOn?: boolean;           // Token Miner only — never sleeps, no veil
  start(): void;                // resume — may reset if the previous run ended in game-over
  stop(): void;                 // MUST be state-preserving (pause, not reset)
}
```

**Key rules:**
- A game never attaches its own `document`/`window` input listeners; pointer/touch events attach only to elements it owns.
- Pointer input must gate on `Hub.current === id` so the click that wakes a card never counts as the first game input.
- `stop()` must never lose state — pausing mid-game and resuming must resume exactly where it left off.

### CabinetDef (cabinet-specific extension)

```ts
interface CabinetDef {
  options: CabinetOptions;      // title, veil copy, stats, legend — passed to createCabinet
  mount(card: GameCard): Cartridge;
}
```

### Storage keys (all `arcade:`-prefixed; game name in parens)

| Key | Shape | Notes |
|-----|-------|-------|
| `best:dino`, `best:2048`, `best:echo`, `best:snake`, `best:bricks`, `best:aim`, `best:setrit` | `number` | higher is better |
| `best:memory`, `best:lightsout` | `number` | fewest moves; `0` = unset, rendered `—` |
| `2048:state` | `{ b: number[16], s: number }` | board + score, restored on load |
| `miner:state` | `{ tokens, miners, last }` | Token Miner idle-sim state; offline gain capped at 4h |
| `minesweeper:times` | `{ beginner?, intermediate?, expert? }` (all `number`) | best seconds per difficulty |
| `watersort:level` | `number` | persistent level counter, ramps color count every 3 levels |
| `credits`, `sound` | `number`, `boolean` | hub chrome state |

---

## API & Interface Surface

No network API — this is a fully static site. The only "interface surface" is the localStorage key set above and the Vercel deploy config.

### External Dependencies

| Service / API | Purpose | Auth method |
|---------------|---------|-------------|
| Vercel (static hosting) | Deploy + hosting at arcade.cartercripe.com | Vercel account (Builder-manual project link) |
| Vercel Web Analytics | Page-view analytics via `/_vercel/insights/script.js` | None — first-party script tag |

---

## Implementation Conventions

### Naming

| Construct | Convention | Example |
|-----------|-----------|---------|
| Files/dirs | kebab-case / short lowercase | `water-sort/`, `gen-sprites.ts` |
| Types/interfaces | PascalCase | `Cartridge`, `CabinetDef` |
| Constants | UPPER_SNAKE | `MAX_OFFLINE_MS`, `GROW_PER_FOOD` |
| Game ids / slugs | short lowercase | `dino`, `g2048`, `water-sort` |

### Key Patterns

- **Error handling:** `storage.ts` never throws on bad data — validate, fall back, `console.warn`. Everywhere else, trust internal invariants (no defensive checks for states the type system already rules out).
- **Testing:** every `logic.ts` gets a Vitest spec file covering its rules with injected deterministic `rand` (an LCG, not `Math.random`) so specs are reproducible. Rendering/DOM/loop code is checked manually via the key-routing + touch checklist, not unit-tested.
- **Accessibility as a build gate, not an afterthought:** every new page/game is expected to keep Lighthouse Accessibility at 100 — verified via headless Chrome (`npx lighthouse --only-categories=accessibility --chrome-flags="--headless=new"`) as part of each partition's close-out, not deferred to a final pass.
- **No comments explaining what code does** — identifiers do that; comments only exist for non-obvious *why* (a TS narrowing gotcha, a trademark rationale, an awake-gating trick).

---

## Module Snapshots

- [`modules/lib.md`](../modules/lib.md) — the frozen shared runtime (Hub, Cartridge, storage, audio, screen, loop, input)
- [`modules/ui.md`](../modules/ui.md) — shared chrome (card, cabinet scaffold, scoreboard, ticker)
- [`modules/games.md`](../modules/games.md) — the 12 game modules and their `logic.ts`/UI split
- [`modules/sprites.md`](../modules/sprites.md) — the ASCII-map → SVG sprite pipeline

---

## Open Questions

- Whether `demo/` (the throwaway foundation contract-proving cartridge) should be removed now that 12 real games exist, or kept as a reference/regression fixture — no decision made.
- The Vercel production cutover (project link, Web Analytics verification, domain point-over) is still an outstanding Builder-manual step; canon here assumes it lands but does not treat it as done.
