---
summary: "Vite + vanilla TypeScript multi-page static app: index.html hub plus one HTML entry per cabinet, sharing a src/lib runtime (Hub cartridge manager owning wake/sleep/fullscreen/key-routing, storage wrapper over arcade:-prefixed localStorage, WebAudio beep synth, input helpers, fixed-timestep loop, pixelated canvas helper) and a build-time sprite pipeline generating crisp-edges SVG from ASCII maps. No runtime dependencies; Vitest for pure game-logic tests; static dist/ deployed on Vercel."
phase: "tech"
when_to_load:
  - "When implementing or reviewing architecture, interfaces, data models, conventions, and sequencing."
  - "When checking whether changes still conform to the agreed technical approach."
depends_on:
  - "prd.md"
  - "ux.md"
modules:
  - "src/lib (runtime: hub, storage, audio, input, loop, canvas)"
  - "src/games (one module per game)"
  - "src/styles (tokens + arcade layer)"
  - "scripts/sprites (build-time sprite generation)"
  - "vite config / Vercel deploy"
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
next_section: "Complete — awaiting Builder review"
---

# Tech Design: arcade-buildout

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

**Summary:** A Vite multi-page application in vanilla TypeScript. The hub (`index.html`) hosts six cartridge games managed by a `Hub` singleton that owns waking, sleeping, fullscreen, and global key routing — a typed port of the mockup's proven pattern. Each cabinet is its own Vite HTML entry sharing the same runtime: on a cabinet page the Hub manages exactly one registered game. Everything compiles to a static `dist/` with zero runtime dependencies, deployed on Vercel.

The mockup (`Arcade Mockup Claude.html`) is the reference implementation: its Hub semantics, three working games, CSS system, and localStorage conventions are ported, not redesigned. Where the mockup and this document disagree on behavior, the mockup wins for the three ported games.

### Cross-Cutting Concerns

1. **Input routing is centralized** — only `hub.ts` calls `preventDefault()` on navigation keys, and only while a game is awake and claims the key. No game module may attach its own `document`-level key listeners. This is the #1 flagged bug class (PRD FR-2.5).
2. **All persistence goes through `storage.ts`** — no direct `localStorage` access anywhere else; every read tolerates missing/corrupt values.
3. **All sound goes through `audio.ts`** — every beep respects the global toggle; no game owns an AudioContext.
4. **Games register, never orchestrate** — a game module implements the `Cartridge` interface and touches nothing outside its own card/canvas.
5. **Reduced motion** — decorative animation is CSS-gated behind `prefers-reduced-motion`; game loops are exempt (they're content).

### Brownfield Notes

The repo has no site code — only the mockup, handoff, and `style-guide copy/` (Light Film Room reference: `design.md`, `example.html`, fonts). The Light Film Room visual tokens must be reproduced faithfully in `tokens.css`; the Druk font files in `style-guide copy/fonts` are trial licenses and **must not ship** (Press Start 2P replaces Druk here, per handoff §5). `pyproject.toml` is vestigial (empty deps) and will be removed; the mockup and handoff stay in the repo as reference docs.

---

## Tech Stack & Dependencies

| Category | Selection | Rationale |
|----------|-----------|-----------|
| **Language/Runtime** | TypeScript 5.x, strict; browser ES2020 target | Type safety across 12 game modules sharing one runtime contract |
| **Framework** | None (vanilla DOM + canvas) | Games are canvas/DOM; a UI framework adds payload and ceremony for zero benefit |
| **Build** | Vite 7.x, MPA via `rollupOptions.input` | One config, per-page code splitting, static output, instant dev server |
| **Database** | None — localStorage via `storage.ts` | PRD decision: client-only persistence |
| **Testing** | Vitest | Vite-native; unit tests for pure game logic |
| **Fonts** | `@fontsource/press-start-2p`, `@fontsource/jetbrains-mono` | Self-hosted woff2, versioned via npm, no Google Fonts request |
| **Deploy** | Vercel (static output, no functions) | Builder decision; preview URLs per push; production = `arcade.cartercripe.com` |
| **Analytics** | Vercel Web Analytics (first-party script tag) | Builder decision; cookieless, zero npm deps, free with hosting (see Observability) |

**New dependencies introduced:**
- `vite`, `typescript`, `vitest` (dev) — toolchain.
- `@fontsource/press-start-2p`, `@fontsource/jetbrains-mono` — font files only; imported as CSS, contribute no JS.

**Dependencies explicitly rejected:**
- `matter.js` — physics cluster is v2; do not add speculatively.
- Any UI framework / state library — the Hub singleton and DOM are sufficient at this scale.
- Sound/asset libraries — WebAudio synth only (ADR-6).
- Python (`build.py`) — sprite generation moves to a TypeScript script so the toolchain is single-language (ADR-5).

---

## Project / Module Structure

```
arcade/
├── index.html                    # Hub entry
├── games/
│   ├── snake/index.html          # Cabinet entries (thin shells; content
│   ├── minesweeper/index.html    #   rendered by the shared scaffold)
│   ├── bricks/index.html
│   ├── aim/index.html
│   ├── water-sort/index.html
│   └── setrit/index.html
├── style-guide/index.html        # Design-tokens page (ported from mockup)
├── src/
│   ├── lib/
│   │   ├── hub.ts                # Hub: registration, wake/sleep, fullscreen, key routing
│   │   ├── cartridge.ts          # Cartridge + GameCard interfaces (contract only)
│   │   ├── storage.ts            # arcade:-prefixed LS wrapper (get/set/clearAll)
│   │   ├── audio.ts              # WebAudio beep synth + sound-toggle state
│   │   ├── input.ts              # Touch helpers: tap / swipe / long-press → semantic events
│   │   ├── loop.ts               # Fixed-timestep rAF loop helper
│   │   └── screen.ts             # Low-res canvas setup (scale, image-rendering: pixelated, DPR)
│   ├── ui/
│   │   ├── card.ts               # Game-card DOM: veil, LED, stats row, ⛶ button
│   │   ├── cabinet.ts            # Cabinet page scaffold (header, ← HUB, legend, screen)
│   │   ├── ticker.ts             # Hub ticker
│   │   └── scoreboard.ts         # High-scores panel + reset-save-data flow
│   ├── games/
│   │   ├── dino/  {dino.ts}                    # Hub games: module per game;
│   │   ├── g2048/ {logic.ts, g2048.ts}         #   pure logic split out where non-trivial
│   │   ├── miner/ {logic.ts, miner.ts}
│   │   ├── simon/ {simon.ts}
│   │   ├── memory/{memory.ts}
│   │   ├── lightsout/{logic.ts, lightsout.ts}
│   │   ├── snake/ {snake.ts}                   # Cabinet games
│   │   ├── minesweeper/{logic.ts, minesweeper.ts}
│   │   ├── bricks/{bricks.ts}
│   │   ├── aim/   {aim.ts}
│   │   ├── watersort/{logic.ts, watersort.ts}
│   │   └── setrit/{logic.ts, setrit.ts}
│   ├── styles/
│   │   ├── tokens.css            # Light Film Room palette/type/grid variables
│   │   ├── base.css              # Reset, page shell, panels, buttons, pills
│   │   ├── arcade.css            # Pixel layer: offset shadows, steps(), scanlines, LEDs, veils
│   │   └── fonts.css             # Fontsource imports
│   ├── sprites/
│   │   ├── maps.ts               # ASCII pixel maps (ported from build.py SPRITES dict)
│   │   └── generated.ts          # [GENERATED] SVG strings — do not edit
│   ├── pages/
│   │   ├── hub.ts                # Hub entry module: builds cards, registers 6 games
│   │   └── cabinet-entry.ts      # Shared cabinet bootstrapping (reads per-page game id)
│   └── tests/                    # Vitest specs for src/games/*/logic.ts + lib
├── scripts/
│   └── gen-sprites.ts            # ASCII maps → src/sprites/generated.ts (prebuild step)
├── vite.config.ts                # MPA inputs, base path
├── vercel.json                   # Static build config (framework preset covers most of it)
├── tsconfig.json
└── package.json
```

**Key structural decisions:**
- Non-trivial rules live in `logic.ts` files with zero DOM/canvas imports — this is what makes them unit-testable.
- Cabinet HTML files are near-empty shells; `cabinet-entry.ts` + `cabinet.ts` render the scaffold so cabinet chrome cannot drift between games.
- `generated.ts` is committed (build works without running the generator) but regenerated by `npm run sprites`.

---

## Architecture Decisions (ADRs)

### ADR-1: MPA (one HTML entry per cabinet), not SPA routing

**Decision:** Vite multi-page build; each cabinet is its own document. No client-side router.

**Rationale:** Matches the handoff's "each cabinet as its own route/subpage," keeps browser back/bookmarks trivially correct, gives per-game code splitting for free, and avoids a router dependency. Navigation between games is infrequent enough that full page loads (of tiny static pages) are imperceptible.

**Affects:** `vite.config.ts`, `games/*/index.html`, `cabinet-entry.ts`, all hub↔cabinet links.

### ADR-2: Hub is a per-page singleton owning ALL global input

**Decision:** Port the mockup's `Hub` object as a typed module-level singleton. Exactly one `keydown`, one `mousedown` document listener per page, both owned by `hub.ts`. Games receive keys only via `onKey`.

**Rationale:** The single most important correctness property (FR-2.5: never steal page scroll) is only enforceable if one place decides `preventDefault`. The mockup proved the pattern; distributing listeners across 12 games is how the bug class gets reintroduced.

**Affects:** `hub.ts`, `cartridge.ts`, every game module (they must NOT add document listeners).

### ADR-3: Fullscreen is CSS takeover, not the Fullscreen API

**Decision:** `F`/⛶ applies a `.fs` class → `position: fixed; inset: 0` on the card plus body scroll lock. Carried verbatim from the mockup.

**Rationale:** Deliberate mockup choice (handoff §2): no permission prompt, predictable across browsers, and "make the game the whole page" is literally the requirement.

**Affects:** `hub.ts` (toggle/exit), `arcade.css` (`.fs`, `body.has-fs`), `card.ts`.

### ADR-4: Storage schema — `arcade:` prefix, JSON values, tolerant reads

**Decision:** `storage.ts` exposes `get<T>(key, fallback)`, `set(key, value)`, `clearAll()`. Keys are `arcade:{name}` (game data adds a game prefix: `arcade:2048:state`). Reads JSON-parse with try/catch and return the fallback on any failure. `clearAll()` removes only `arcade:*` keys.

**Rationale:** Continuity with the mockup means returning visitors keep their mockup-era bests if key names match (keep `best:dino`, `2048:state`, etc. where practical). Tolerant reads satisfy the reliability NFR — corrupt storage must never crash a game.

**Affects:** `storage.ts`, every game module, scoreboard, reset flow.

### ADR-5: Sprite pipeline is a build-time TypeScript script emitting a committed module

**Decision:** `scripts/gen-sprites.ts` transforms ASCII maps (`maps.ts`, ported from `build.py`'s `SPRITES` dict, run-length encoding rows into `<rect>`s) into `src/sprites/generated.ts` exporting typed SVG strings. Run via `npm run sprites`; output is committed.

**Rationale:** Keeps the "add a sprite without an image editor" property the handoff praises, in one language (drops the Python dependency), with no runtime cost — sprites are static strings inlined into markup at build time.

**Affects:** `scripts/gen-sprites.ts`, `src/sprites/*`, card/cabinet markup, memory game.

### ADR-6: All audio is synthesized WebAudio beeps behind one module

**Decision:** `audio.ts` owns a lazily-created AudioContext (first user gesture) and exposes `beep(freq, dur, wave?, gain?)` mirroring the mockup, plus the persisted sound toggle. No audio files.

**Rationale:** Zero assets, matches the mockup's aesthetic, and one gate for the SND toggle. Lazy creation avoids autoplay-policy warnings.

**Affects:** `audio.ts`, header toggle, every game with sound.

### ADR-7: Fixed-timestep update, rAF render

**Decision:** `loop.ts` provides a helper running game `update(dt)` at a fixed step (accumulator pattern, 60 Hz) with rendering per animation frame; games opt in (`dino`, `snake`, `bricks`, `setrit`, `aim`). Turn-based games (2048, Minesweeper, Water Sort, Simon, Memory, Lights Out) skip the loop entirely and render on input.

**Rationale:** The mockup's per-frame stepping ties game speed to display refresh (wrong on 120 Hz screens). A shared helper fixes this once; event-driven games shouldn't burn rAF at all.

**Affects:** `loop.ts`, real-time game modules. (Deviation from mockup internals — behavior parity, better timing.)

---

## Data Models

### Core contract

```ts
// cartridge.ts
export interface Cartridge {
  keys?: string[];                 // keys this game claims while awake
  onKey?(key: string): void;
  alwaysOn?: boolean;              // idle games: exempt from wake/sleep
  start(): void;                   // called on wake (or once at load if alwaysOn)
  stop(): void;                    // called on sleep; MUST be state-preserving
}

export interface RegisteredGame {
  id: string;
  api: Cartridge;
  card: HTMLElement;               // owns veil, LED, ⛶, stats row
}
```

### Storage keys (v1 schema)

| Key | Value | Notes |
|-----|-------|-------|
| `arcade:best:{game}` | `number` | one per scored game (`dino`, `2048`, `snake`, `setrit`, …) |
| `arcade:2048:state` | `{ b: number[16], s: number }` | mockup-compatible |
| `arcade:miner:state` | `{ tokens: number, miners: number, last: epochMs }` | `last` drives offline earnings |
| `arcade:minesweeper:times` | `{ beginner?: number, intermediate?: number, expert?: number }` | best seconds |
| `arcade:sound` | `boolean` | SND toggle |
| `arcade:credits` | `number` | decorative |

**Key field decisions:**
- `miner.last` as epoch ms — offline earnings = `clamp(now - last, 0, 4h) × rate`; negative deltas (clock skew) clamp to 0.
- Mockup key names retained where formats match, so existing localStorage carries over.

### Modified Models

None — greenfield. No migrations.

---

## API & Interface Design

No network APIs. The interfaces that matter are module contracts:

```ts
// hub.ts
export const Hub: {
  register(id: string, api: Cartridge, card: HTMLElement): void;
  wake(id: string): void;      // sleeps current non-alwaysOn game first
  sleep(): void;               // pause current; veil on
  toggleFs(id: string): void;
  exitFs(): void;
  readonly current: string | null;
};

// storage.ts
export const store: {
  get<T>(key: string, fallback: T): T;
  set(key: string, value: unknown): void;
  clearAll(): void;            // arcade:* only
};

// audio.ts
export function beep(freq: number, dur: number, wave?: OscillatorType, gain?: number): void;
export function soundEnabled(): boolean;
export function toggleSound(): boolean;

// input.ts — attaches to a surface, emits semantic gestures
export function gestures(el: HTMLElement, handlers: {
  tap?(x: number, y: number): void;
  swipe?(dir: 'up' | 'down' | 'left' | 'right'): void;
  longPress?(x: number, y: number): void;
}): () => void;  // returns detach
```

Key-routing invariant (normative restatement of mockup behavior): on `keydown` — `Escape` → exit fullscreen else sleep; `f`/`F` (unmodified, game awake) → toggle fullscreen; if a game is awake and claims `e.key` → `preventDefault()` + `onKey`; if a game is awake and the key is a nav key (arrows/space) it doesn't claim → `preventDefault()` only; **otherwise never `preventDefault()`**.

### Backward Compatibility

N/A (no existing consumers). LocalStorage compatibility with the mockup is best-effort per ADR-4.

---

## Implementation Patterns & Conventions

### Naming Conventions

| Construct | Convention | Example |
|-----------|-----------|---------|
| Files/dirs | kebab-case / short lowercase | `water-sort/`, `gen-sprites.ts` |
| Functions/vars | camelCase | `offlineEarnings()` |
| Types/interfaces | PascalCase | `Cartridge`, `SetritPiece` |
| Constants | UPPER_SNAKE | `MAX_OFFLINE_MS` |
| Storage keys | `arcade:{game}:{item}` | `arcade:miner:state` |
| Game ids / slugs | short lowercase | `dino`, `g2048`, `water-sort` |

### Game Module Pattern

Every game exports one `mount(container: HTMLElement): void` that builds its DOM/canvas inside the provided card/screen and calls `Hub.register`. Non-trivial rules live in a sibling `logic.ts` that imports nothing from the DOM. `stop()` must cancel its rAF handle and preserve state — verified in review for every game.

### Error Handling Pattern

```ts
// storage.ts is the model: never throw on bad persisted data
get<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(PREFIX + key);
        return raw === null ? fallback : (JSON.parse(raw) as T); }
  catch { return fallback; }
}
```

**Rules:**
- Persisted data is untrusted: validate shape (e.g. 2048 restores only if `b` is a 16-length number array — as the mockup does) before adopting it.
- No silent catch anywhere else; game logic should not throw in normal play, and there is no error UI to hide behind.

### Testing Pattern

```ts
// src/tests/g2048.spec.ts
import { slideRow } from '../games/g2048/logic';
test('merges pairs once per move', () => {
  expect(slideRow([2, 2, 2, 2])).toMatchObject({ row: [4, 4, 0, 0], gained: 8 });
});
```

**Coverage expectations:** every `logic.ts` (2048 slide/merge/game-over, miner offline math, Lights Out solvability, Minesweeper generation/flood-reveal/first-click-safe, Water Sort legality/undo/solvable generation, Setrit rotation/collision/line-clear) plus `storage.ts` fallbacks. Rendering/loop code is exercised manually via the key-routing checklist, not unit-tested.
**Mocking strategy:** none needed beyond a localStorage stub for `storage.ts` tests.

---

## Security & Performance

### Security

| Concern | Mitigation |
|---------|-----------|
| XSS / injection | No user-generated content rendered; all dynamic text is numeric or from constants; no `innerHTML` with variables (sprite SVG strings are build-time constants) |
| Supply chain | Runtime dependency count is zero; dev deps are Vite/TS/Vitest/Fontsource only; lockfile committed |
| Data privacy | localStorage only; analytics is Vercel Web Analytics via the first-party `/_vercel/insights/script.js` snippet (same-origin, cookieless — FR-7.2); no other external requests at runtime |
| Font licensing | Press Start 2P + JetBrains Mono (OFL); Druk trial files never referenced by the site |

### Performance

| Concern | Target | Approach |
|---------|--------|---------|
| Hub payload | < 100 KB gz JS | No framework; per-page splitting; fonts as woff2 not base64; measure in CI build output |
| Frame rate | 60 fps on mid-tier laptop | Low-res canvases (~240×160 logical) scaled up; fixed-timestep updates; event-driven games idle at 0 rAF |
| Idle cost | ~0 when no game awake | Only alwaysOn miner ticks (1 Hz interval, not rAF); asleep games cancel their loops in `stop()` |
| Font flash | Minimal | `font-display: swap` (Fontsource default); Press Start 2P preloaded on hub |

### Observability

**Analytics:** Vercel Web Analytics (Builder decision) — enabled on the Vercel project, with `<script defer src="/_vercel/insights/script.js"></script>` in every HTML entry (hub, cabinets, style-guide). Chosen over the `@vercel/analytics` npm package because the plain script tag is the documented path for non-framework static sites and keeps runtime npm deps at zero; chosen over Plausible/GoatCounter because it's first-party on the same domain, cookieless, and free with the existing hosting. The script 404s harmlessly on local dev.

Beyond that: `console.warn` on storage-shape rejections (helps debugging saves) and a `window.__arcade` dev handle exposing Hub state in dev builds only.

---

## Implementation Sequence

1. **Foundation** *(blocking)* — Vite MPA scaffold, tsconfig strict, `tokens/base/arcade/fonts` CSS, `storage/audio/input/loop/screen` libs, `hub.ts` + `cartridge.ts`, `card.ts`/`cabinet.ts` scaffolds, sprite pipeline, Vitest wiring, `vercel.json` + first preview deploy.
2. **Hub page** *(depends on 1)* — hub layout + chrome (header, ticker, panels, cabinets grid with pills), port Dino/2048/Miner, build Simon/Memory/Lights Out, `/style-guide` page.
3. **Cabinets: action** *(depends on 1, parallel with 2)* — Snake, Bricks, Aim Trainer on the cabinet scaffold.
4. **Cabinets: puzzle** *(depends on 1, parallel with 2–3)* — Minesweeper, Water Sort, Setrit.
5. **Integration & launch** *(depends on 2–4)* — hub↔cabinet score wiring, ticker stats, LIVE pill flips, cross-browser + touch key-routing checklist, a11y pass, payload audit, production domain cutover.

**Parallel work opportunities:** partitions 2, 3, 4 are independent after foundation lands (separate directories; shared runtime is frozen by then — changes to `src/lib` after foundation require a Signal to peer branches).

**Known implementation risks:**
- Setrit is the largest single game (rotation system, kicks, scoring) — timebox to "standard-feeling," not guideline-perfect; logic.ts tests keep it honest.
- Touch + `mousedown`-based pause interplay (ghost clicks, scroll-vs-swipe) needs early real-device testing in foundation, not discovered in partition 5.
- Water Sort solvable-level generation can rabbit-hole; generate-by-reverse-pouring from a solved state is the required approach (guaranteed solvable by construction).

---

## Foundation Reflect Notes (feat/foundation, 2026-07-12)

Implementation reality vs. this design — recorded at partition completion:

- **Toolchain versions**: resolved to Vite 8.x / TypeScript 7.x (native tsc) / Vitest 4.x (doc said "Vite 7.x"; semantics unchanged). `npm run sprites` runs via plain `node` — Node 24's native type stripping — so no ts-runner dependency was added.
- **No @types/node**: build-time scripts + vite.config type against a minimal ambient shim (`scripts/node-shim.d.ts`) to keep the dev-dependency list exactly vite/typescript/vitest/fontsource.
- **storage.ts API extension**: `get<T>(key, fallback, validate?)` — optional type-guard third parameter; rejection warns and returns the fallback (implements the "validate shape before adopting" rule centrally). `remove(key)` also exposed.
- **Sound pref key**: `arcade:sound` per this doc's table; the mockup used `arcade:snd`, so mockup-era sound prefs don't carry (scores/state keys are unaffected).
- **`.gcard--always-on`**: replaces the mockup's `.gcard[data-game="clicker"]` selector; card.ts/hub.ts apply the class for any `alwaysOn` cartridge (miner in partition 2 gets it for free).
- **Scroll-vs-swipe mechanism**: decided by CSS `touch-action` (`.gcard.active .screen { touch-action: none }` in arcade.css), not preventDefault — input.ts classifies gestures via a pure, unit-tested `classifySwipe`. Veiled cards scroll naturally because the veil overlays the surface.
- **Sprite maps**: `build.py` is not in the repo; 4 maps (joystick, token, snake, target) were recovered by decoding the mockup's inline SVG rects — generated output is rect-identical to the mockup. Partitions add sprites by extending `maps.ts` + `npm run sprites`.
- **Hub extras vs. mockup** (all additive): Enter/Space wakes a focused veiled card, aria-live `[data-status]` announcements on wake/sleep/fullscreen, `Hub.fullscreen` getter, listeners attach lazily on first `register()` (keeps hub.ts importable under node/vitest).
- **Demo cartridge**: throwaway `/demo/` page (DEMO ROVER) on the cabinet scaffold — slated for removal when a later partition needs the slot; its vite input lives in `vite.config.ts` under `demo`.

---

## Hub-Games Reflect Notes (feat/hub-games, 2026-07-12)

Implementation reality vs. this design — recorded at partition completion:

- **New storage keys** (all tolerant reads with validators): `arcade:best:simon` (streak, higher wins), `arcade:best:memory` and `arcade:best:lightsout` (fewest moves, lower wins — `0` is the "unset" sentinel, rendered as `—`). `arcade:miner:state {tokens, miners, last}` adopted exactly per this doc; the mockup's `arcade:clicker {c,m,t}` shape is rejected by the validator and falls back fresh (no migration, per the no-legacy-data call in Foundation notes).
- **Game-owned CSS**: `src/styles` is frozen, so the three new games ship their own scoped stylesheets (`src/games/{simon,memory,lightsout}/*.css`, imported by their modules). Palette/token usage only — no new global classes.
- **New shared modules in owned dirs**: `src/ui/ticker.ts` (fills the two ticker halves), `src/ui/scoreboard.ts` (generic `{cellId → reader}` refresher; hub page supplies readers and a 2 s interval), `src/games/format.ts` (`pad`/`fmt` readouts), `src/games/types.ts` (`MountedGame = { api: Cartridge; onReset() }` — the reset-flow hook every hub game implements).
- **Sprite pipeline additions** (additive to `src/sprites/maps.ts`): `tube`, `bricks`, `invader` decoded from the mockup's inline SVGs; `setrit` drawn fresh (mockup had no Setrit icon). Memory uses all 8 sprites as its pair faces; the hub's cabinet grid and `/style-guide` sprite sheet render from `generated.ts`.
- **Hub page architecture**: static structure (header, ticker shell, cabinets grid, panels, footer) lives in `index.html` for mockup parity; the six game cards are built at runtime by `card.ts` into `#live-grid` (single source of card DOM). Cabinet cards: 13 total, ALL `SOON` until the launch partition flips the roster six (mockup's Sudoku card kept as flavor with its DAILY pill).
- **Wake-click gating**: mouse games (Simon, Memory, Lights Out) ignore pointer input until `start()` has run, so the click that wakes a card never counts as a move. Dino gates its canvas-jump on `Hub.current === "dino"`; 2048 gates swipes the same way.
- **Turn-based games skip the loop** as designed — only Dino uses `createLoop` (fixed 60 Hz; mockup's per-frame speeds now correct on 120 Hz displays).
- **Simon resume semantics**: `stop()` clears playback timers and keeps the sequence; `start()` re-shows the in-progress round from the top (state-preserving, no lost streak).
- **Known deferral to launch a11y pass (task 72)**: interactive elements behind a veil (pads/cells/NEW GAME) remain keyboard-focusable while the card is asleep; input is gated but focus order should skip veiled controls — fix belongs to the launch partition.
- **Payload**: hub entry 17.5 kB JS (6.6 kB gz) — well under the 100 kB gz budget.

---

## Launch Reflect Notes (feat/launch, 2026-07-12 — pre-cabinets run)

Builder-directed sequencing deviation: launch ran immediately after hub-games, before the cabinet partitions (signal board 2026-07-12). Branched from `feat/hub-games` (unmerged at the time) so nothing was merged by the agent. Cabinet-dependent scope (LIVE flips, cabinet scoreboard/ticker rows, cabinet halves of the browser checklist) is deferred and stays unchecked in tasks.md.

- **Simon → ECHO**: SIMON is a live Hasbro trademark (US Reg. 1211692) for the electronic memory game — exactly our category — so it renamed per the Setrit doctrine. Module `src/games/echo/`, game id `echo`, storage key `arcade:best:echo`, all copy updated. No save migration (nothing deployed before the rename).
- **A11y fixes (Lighthouse 100 on hub, /demo/, /style-guide/, headless Chrome)**:
  - Asleep game surfaces are `inert` (echo/memory/lightsout toggle it in start/stop) — closes the focus-behind-veil advisory from the hub-games Reflect.
  - `--sub` darkened `#a1a1aa` → `#52525b` (small-text AA contrast on base and panel). This is the one visible design change; the palette's seven hero colors are untouched.
  - `.cab--soon` dims the sprite (and sub-colors the name) instead of fading the whole card — full-contrast pills.
  - Links inside `.tiny`/footer are underlined; cabinet legend heading is `h2.panel-heading` (order); cabinet SND button relies on its visible text for its accessible name; dino canvas has `role="img"` + label.
  - Frozen-layer touches (tokens/arcade/base.css, src/ui/cabinet.ts) broadcast on the signal board for the cabinet partitions.
- **Payload (production build, gzip)**: hub-page JS total 11.1 kB (budget 100 kB); CSS 27.4 kB; HTML 3.2 kB; ~55 kB latin woff2 actually fetched (unicode-range). Font preload deliberately skipped: hashed asset URLs would need a build plugin, `font-display: swap` + dino's `document.fonts.load` warm-up cover the need at 12.5 kB.
- **README.md**: commands, the key-routing invariant, 7-step add-a-game guide, naming doctrine, style-system summary.
- **Still Builder-manual**: browser/touch checklists (tasks 28/71 lists), Vercel project link + Web Analytics enable + `arcade.cartercripe.com` cutover (task 75).
- **/demo/ page**: kept for now — it's the only cabinet-scaffold exercise page until real cabinets land; remove in the cabinets or post-cabinets launch wrap-up.

## Cabinets-Action Reflect Notes (feat/cabinets-action, 2026-07-13)

- **cabinet-entry.ts** (new, src/pages): reads `<body data-game>`, dynamic-imports the game from a `LOADERS` map (each game its own chunk), renders `createCabinet`, registers with the Hub. Cabinet HTML shells are now 3-line bodies. New shared type `CabinetDef { options, mount }` in src/games/types.ts. Puzzle partition extends `LOADERS` with its three ids.
- **Game-over key release**: the Hub reads `api.keys` per keydown but swallows unclaimed nav keys while any game is awake, so "release nav keys on game over" is implemented as: the cartridge sleeps itself (`Hub.sleep()`) ~1s after death and restyles the veil (`GAME OVER · SCORE n` / `▶ CLICK TO PLAY AGAIN`); next wake resets. This is the standard cabinet game-over pattern.
- **Awake-gating on cabinets**: surface `pointerdown` fires before the Hub's wake `mousedown`, so gating on `Hub.current === id` makes the waking click a no-op for game input (bricks serve, aim shots) for free.
- **Aim claims no keys** (pure pointer game) — arrows/space always scroll its page; snake claims arrows+WASD, bricks claims space/arrows/A-D.
- **LIVE cabinet cards** carry no aria-label (the visible link text is the accessible name — a label duplicating it tripped Lighthouse label-content-name-mismatch).
- Storage: `best:snake` (foods), `best:bricks` (score), `best:aim` (hits in a 30s round), all number-validated.

## Cabinets-Puzzle Reflect Notes (feat/cabinets-puzzle, 2026-07-13)

- **Minesweeper**: mines are placed lazily on the first reveal, excluding the clicked cell and its neighbor halo — first-click-safe without any "relocation" step, and the opener always floods. Storage `arcade:minesweeper:times` per tech-design. The timer is a setInterval that only exists between `start()`/`stop()` and only once the board is `playing` — pausing freezes the clock by construction.
- **Water Sort**: levels generated by reverse-pouring from solved with every step exactly invertible (source keeps its color on top or empties; destination never topped with the same color). `generate()` returns the forward solution; the spec suite replays it to prove solvability. `arcade:watersort:level` persists the level counter.
- **Setrit**: rotations derived by quarter-turn inside each piece's bounding box (I in a 4-box ≈ SRS, O fixed); kick list [0,0]/[±1,0]/[0,-1]/[±2,0] per the "standard-feeling" timebox. 7-bag randomizer, ghost piece via `dropY`, guideline clear table × (level+1), gravity 800ms·0.8^level (floor 70ms).
- **TS narrowing gotcha** recorded: after a mutating call like `reveal(board, …)`, re-read unions via an IIFE (`((): MsPhase => board.phase)()`) — a plain annotated const still gets narrowed by CFA and trips TS2367 under strict.
- Payload after all six cabinets (gzip): hub page JS ≈ 11.5 kB; a cabinet page ≈ 9 kB (entry 1.2 + scaffold 0.9 + card 2.3 + game 1.7–2.9 + runtime slivers). Budget: 100 kB.
