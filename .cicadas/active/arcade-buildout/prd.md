---
summary: "Turn the self-contained Arcade mockup into the real Carter's Arcade site: a Vite + vanilla TypeScript static site hosted on a cartercripe.com subdomain via Vercel, shipping ~12 playable games (6 hub-embedded cartridges, 6 full cabinets) built on the mockup's click-to-wake Hub/cartridge interaction model, Light Film Room + pixel style system, and arcade:-prefixed localStorage persistence. No backend, no accounts."
phase: "clarify"
when_to_load:
  - "When defining or reviewing initiative goals, users, scope, success criteria, and risks."
  - "When validating that implementation still aligns with the intended problem and outcomes."
depends_on: []
modules:
  - "hub page (index)"
  - "cabinet game pages"
  - "shared game runtime (Hub/cartridge, storage, audio, input)"
  - "style system (Light Film Room + pixel layer)"
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
next_section: "Complete — awaiting Builder review"
---

# PRD: arcade-buildout

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

Carter's Arcade is a personal arcade page on a cartercripe.com subdomain (arcade.cartercripe.com) built for low-friction fidgeting: land, play a few rounds of one game, click into another, let an idle game tick in the background — no loading screens, menus, or friction between games. This initiative turns the finished single-file mockup (`Arcade Mockup Claude.html`) into the real production site: a Vite + vanilla TypeScript static build with ~12 fully playable games and the complete hub interface, deployed on Vercel.

### What Makes This Special

- **The click-to-wake cartridge model** — many live games coexist on one page without stealing keyboard input from each other or from page scroll. This is the design thesis and the primary thing that must survive the port intact.
- **Zero friction** — static site, no accounts, no loading screens; games are playable within a second of page load ("Chrome dino energy multiplied across a dozen games").
- **A real style system, not a costume** — pixel/arcade identity layered onto the existing Light Film Room design system, concentrated in game surfaces; the brand stays legible.
- **Built to grow** — the handoff lists ~80 target games. The cartridge pattern, cabinet scaffold, and sprite pipeline make each additional game cheap to add, which is what justifies investing in shared infrastructure now.

## Project Classification

**Technical Type:** Consumer web app (static site)
**Domain:** Entertainment / personal portfolio
**Complexity:** Medium-High — individual games are simple, but 12 of them plus a shared runtime, input-routing correctness, and a multi-page build add real surface area.
**Project Context:** Greenfield code with a strong prior artifact — the repo contains only the mockup, the handoff doc, and the Light Film Room style guide (`style-guide copy/`). The mockup's three working games and Hub object are reference implementations to port, not code to keep.

---

## Success Criteria

### User Success

A user achieves success when they can:

1. **Play within seconds** — land on the hub and be playing Dino Run within ~2 clicks and no perceptible load time.
2. **Fidget across games without friction** — switch between hub games with a single click; the previous game pauses (never resets), and the idle miner keeps ticking regardless.
3. **Never fight the page** — scrolling with arrow keys works everywhere except while a game is actively awake; clicking away always pauses; Escape always backs out.
4. **Return and resume** — best scores, 2048 board, and miner progress (with offline earnings) survive reload and return visits.

### Technical Success

The system is successful when:

1. The build produces a pure static `dist/` deployed on Vercel at the arcade subdomain, with no runtime server dependency.
2. Adding a new hub game or cabinet requires only a new game module + registration/page entry — no changes to shared runtime code.
3. All game-logic modules with non-trivial rules (2048 merge, Minesweeper generation, Water Sort legality, Setrit rotation/clear) have unit tests.

### Measurable Outcomes

- 12 playable games at launch (6 hub-embedded, 6 cabinets).
- Hub page initial JS payload < 100 KB gzipped; first playable < 1 s on a normal connection.
- 60 fps game loops on a mid-tier laptop; no dropped-input complaints in manual test passes.
- Lighthouse Accessibility ≥ 95 on hub and one representative cabinet.
- The key-routing checklist (see FR-2) passes 100% on Chrome, Firefox, Safari, and one touch device.

---

## User Journeys

### Journey 1: Carter — The Two-Minute Fidget

Carter is between tasks and wants two minutes of low-stakes play. He hits the arcade subdomain, the hub renders instantly, and he clicks the Dino Run card — it wakes, he plays three runs with the spacebar, dies, and clicks over to 2048, which wakes while Dino quietly pauses under a "click to resume" veil. The Token Miner has been ticking in the corner the whole time and greets him with capped offline earnings from yesterday. He presses `F` to take 2048 fullscreen for a serious attempt, `Esc` back out, and closes the tab; nothing is lost — the board, his bests, and his miner all persist.

**Requirements Revealed:** instant static load, click-to-wake / pause-on-click-away, single-active-game arbitration, alwaysOn idle exception, offline earnings, CSS fullscreen takeover, Escape/F key handling, localStorage persistence.

### Journey 2: A Visitor — From Portfolio to Cabinet

A visitor finds the arcade from cartercripe.com. She scrolls the hub — arrow keys scroll the page normally because no game is awake — skims the live ticker and score panel, and clicks the Setrit card in the Cabinets grid. It navigates to a dedicated cabinet page with the same visual language: a low-res pixelated canvas, score readout, controls legend, and a back-to-hub link. She plays on her laptop, later opens Snake on her phone and plays with touch controls. Cards for unbuilt games clearly read SOON and don't pretend to be playable.

**Requirements Revealed:** cabinet pages as separate routes sharing a scaffold, LIVE/SOON pill states, key routing that never steals page scroll, touch input support, consistent style system across hub and cabinets, hub↔cabinet navigation.

### Journey 3: Carter — Adding Game #13

A month after launch Carter wants to add Whack-a-Mole in an evening. He copies the game-module pattern, writes the game against the cartridge interface, adds a sprite via the ASCII-map sprite pipeline, registers it on the hub (or adds a cabinet page entry), and it inherits wake/sleep, fullscreen, audio, storage, and styling for free. He runs the unit tests and the dev server, checks the key-routing checklist, and deploys by pushing to main.

**Requirements Revealed:** cartridge interface as a stable contract, cabinet scaffold, sprite generation pipeline, shared audio/storage utilities, documented game-addition workflow, simple deploy pipeline.

### Journey Requirements Summary

| User Type | Key Requirements |
|-----------|-----------------|
| **Carter (player)** | instant load, wake/sleep arbitration, idle exception, fullscreen, persistence, offline earnings |
| **Visitor** | cabinet routes, LIVE/SOON states, scroll never hijacked, touch support, coherent styling |
| **Carter (maintainer)** | stable cartridge contract, cabinet scaffold, sprite pipeline, tests, push-to-deploy |

---

## Scope

### MVP — Minimum Viable Product (v1)

**Core Deliverables:**
- Vite + vanilla TypeScript project scaffold producing a static multi-page build; Vercel deployment config.
- Shared runtime: Hub/cartridge manager, `arcade:`-prefixed localStorage wrapper, WebAudio beep synth + sound toggle, keyboard/touch input helpers, fixed-timestep rAF loop, low-res pixelated canvas helper.
- Style system ported from the mockup: Light Film Room tokens + pixel layer (offset shadows, `steps()` timing, scanline overlay on game screens, LED indicators), self-hosted Press Start 2P + JetBrains Mono.
- Sprite pipeline: build-time generation of crisp-edges inline SVG from ASCII pixel maps (replacing the mockup's `build.py`).
- Hub page: header (sound toggle, decorative credits/insert-coin), live ticker, hub-game grid, Cabinets grid with LIVE/SOON pills, high-scores panel, controls legend, reset-save-data flow.
- **6 hub-embedded games:** Dino Run, 2048, Token Miner (ported from mockup) + ECHO (né Simon — renamed, protected mark), Memory (card-flip), Lights Out (new).
- **6 cabinets** on a shared cabinet scaffold: Snake, Minesweeper, Bricks (Breakout), Aim Trainer, Water Sort, Setrit (Tetris clone).
- `/style-guide` page preserving the mockup's Design Tokens section as an internal living reference.

**Quality Gates:**
- Key-routing checklist passes on Chrome/Firefox/Safari + one touch device (no inactive game ever eats page scroll).
- Unit tests green for all non-trivial game logic; `tsc --noEmit` clean under strict mode.
- Accessibility parity with the mockup: focus rings, aria-labels on icon buttons, `prefers-reduced-motion` respected.

### Growth Features (Post-MVP)

**v2: Physics & Dailies**
- Shared matter.js physics engine + first merge/physics games (Suika-style, Plinko, Pull the Pin).
- Date-seeded daily puzzles (Sudoku, nonogram) with DAILY #N pills.
- More cabinets from the classic-arcade and grid-logic lists (Invaders, Sokoban, Rush Hour, Blackjack…).

**v3: Wide Roster**
- Tower defense line, cards & dice cluster, skill trainers, beat-the-AI games, pseudo-3D racer.

### Vision (Future)

- The full ~80-game roster from the handoff; stretch goals (pinball, Lemmings) as standalone projects.
- Optional backend swap-in behind the storage module (accounts, shared leaderboards) — explicitly not designed now beyond keeping storage behind one module.

---

## Functional Requirements

### 1. Hub Shell & Chrome

**FR-1.1:** The hub page presents header (title, sound toggle, decorative credits counter + INSERT COIN button), a horizontally scrolling stats ticker, the hub-game grid, the Cabinets grid, a high-scores panel, and a controls legend, matching the mockup's layout and copy.
**FR-1.2:** Cabinet cards show pill states: `LIVE` (links to a real cabinet page) or `SOON` (visibly disabled, not a dead link). The DAILY pill state is defined in CSS but unused until v2.
**FR-1.3:** The high-scores panel reflects live localStorage values and updates when games write new bests.
**FR-1.4:** A "reset save data" action clears exactly the `arcade:`-prefixed keys after an explicit confirmation.
**FR-1.5:** A `/style-guide` page preserves the mockup's design-tokens documentation.

### 2. Cartridge System & Input Routing

**FR-2.1:** Games register with a per-page Hub via the cartridge contract (`keys`, `onKey`, `alwaysOn`, `start`, `stop`) as established in the mockup.
**FR-2.2:** Games are click-to-wake. Hover only highlights. At most one keyboard-driven game is awake at a time; waking one sleeps the previous. `alwaysOn` games are exempt from arbitration.
**FR-2.3:** Clicking outside the awake game's card pauses it under a "CLICK TO RESUME" veil; pausing never resets game state.
**FR-2.4:** `Escape` pauses the awake game, or exits fullscreen first if fullscreen. `F` toggles fullscreen for the awake game (ignored with meta/ctrl/alt modifiers).
**FR-2.5:** Arrow keys / WASD / space are `preventDefault()`'d **only** while a game is awake and claims them; otherwise the page scrolls normally. Acceptance: the key-routing checklist — (a) fresh load, arrows scroll; (b) game awake, arrows play; (c) click away, arrows scroll again; (d) game-over state doesn't capture keys it no longer needs.
**FR-2.6:** Fullscreen is a CSS takeover (`position: fixed; inset: 0` card expansion), not the browser Fullscreen API, toggled by `F` or a corner icon button.

### 3. Hub Games

**FR-3.1:** **Dino Run** — canvas runner ported at feature parity: procedural obstacles, jump physics (space/↑/W/click/tap), speed ramp, best score persisted.
**FR-3.2:** **2048** — full slide/merge/spawn/game-over logic, arrows + WASD + swipe, board state and best persisted, NEW GAME control, NO MOVES LEFT overlay.
**FR-3.3:** **Token Miner** — `alwaysOn` idle clicker: click-to-mine, buyable auto-miners with scaling cost, offline earnings on return capped at 4 h, state persisted.
**FR-3.4:** **ECHO** *(built as "Simon"; renamed at the launch naming pass — SIMON is a live Hasbro mark, US Reg. 1211692)* — pattern-echo memory game: growing sequence with distinct tone+flash per pad, click/tap input, best-streak persisted.
**FR-3.5:** **Memory** — card-flip pairs using pipeline sprites; move counter and best (fewest moves) persisted.
**FR-3.6:** **Lights Out** — 5×5 toggle-neighbors puzzle, always-solvable board generation, move counter and best persisted.

### 4. Cabinets

**FR-4.1:** All cabinets share a scaffold: cabinet header (title, score/best, fullscreen toggle, back-to-hub link), low-res canvas scaled with `image-rendering: pixelated`, controls legend, pause/game-over states, and the same key-routing discipline as the hub.
**FR-4.2:** **Snake** — grid snake with keyboard + swipe controls, speed ramp, best persisted.
**FR-4.3:** **Minesweeper** — beginner/intermediate/expert boards, first-click-safe generation, flagging (incl. long-press on touch), timer, best times persisted.
**FR-4.4:** **Bricks** — Breakout: paddle (keyboard + mouse/touch), lives, brick layouts, speed-up, best persisted.
**FR-4.5:** **Aim Trainer** — timed target-clicking mode with hits/accuracy/best persisted.
**FR-4.6:** **Water Sort** — color-sort puzzle with legal-pour validation, undo, level counter, generated solvable levels.
**FR-4.7:** **Setrit** — Tetris clone (renamed for trade-dress reasons; original naming/skin): 7 pieces with standard-feeling rotation, line clears, levels/speed ramp, next-piece preview, hard+soft drop, best persisted.

### 5. Persistence

**FR-5.1:** All persistence goes through one storage module using `arcade:`-prefixed localStorage keys (versioned key convention; JSON values with corruption-tolerant reads).
**FR-5.2:** Persisted at minimum: per-game bests, 2048 board, miner state + last-seen timestamp, sound preference, decorative credits.

### 6. Audio

**FR-6.1:** All game sounds are WebAudio-synthesized beeps (no audio asset files), routed through one module honoring the global sound toggle; preference persisted.

### 7. Deployment

**FR-7.1:** The project deploys on Vercel from this repo; production maps to `arcade.cartercripe.com`. Static output only — no serverless functions.
**FR-7.2:** Vercel Web Analytics is enabled: the first-party insights script (`/_vercel/insights/script.js`, deferred) is included on the hub and every cabinet page, and page views are visible in the Vercel dashboard after deploy. Cookieless; no consent banner required; no other analytics or tracking.

---

## Non-Functional Requirements

- **Performance:** hub initial JS < 100 KB gzipped (games code-split or cheap enough to inline — measured, not assumed); 60 fps loops; `steps()` animations and canvas draws must not jank scroll. Fonts self-hosted woff2, not base64.
- **Reliability:** corrupted/missing localStorage never crashes a game (fall back to fresh state); pausing/waking cycles are state-safe; offline-earnings math handles clock skew (negative deltas clamp to 0).
- **Security:** no backend, no user data beyond localStorage; the only non-app runtime script is Vercel's first-party analytics snippet (same-origin, cookieless); dependencies limited to build tooling + fonts.
- **Maintainability:** TypeScript strict mode; game logic separated from rendering where practical (pure logic modules unit-tested with Vitest); documented game-addition guide; sprite pipeline usable without an image editor.
- **Accessibility:** visible `:focus-visible` rings, `aria-label` on icon-only buttons, `prefers-reduced-motion` disables ticker scroll/veil blink/LED pulse, WCAG AA contrast for all text UI (game-canvas interiors exempt).

---

## Open Questions

All resolved by Builder (2026-07-12):

- **Subdomain name** — ✅ `arcade.cartercripe.com` confirmed.
- **Analytics** — ✅ Yes: **Vercel Web Analytics** (easiest/best given Vercel hosting — dashboard toggle + first-party `/_vercel/insights/script.js` tag on every page; cookieless, no third-party domain, no npm dependency). See FR-7.2.
- **Game naming** — ✅ Policy: use the normal name unless it's a protected trademark. Applied: Setrit stays (Tetris — protected), Bricks stays (Breakout — Atari mark); Snake, Minesweeper, 2048, Memory, Lights Out, Water Sort, Aim Trainer ship under their normal names. Launch naming pass 2026-07-12: Simon verified as a LIVE Hasbro mark (US Reg. 1211692) → shipped as **ECHO**.

---

## Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Scope creep toward the 80-game roster mid-initiative | High | High | Roster is frozen at the 12 MVP games; everything else is an explicit v2/v3 list in this PRD. |
| Key-routing regressions (inactive game eats page scroll) | Med | High | Single input-routing module owns all `preventDefault` decisions; explicit key-routing checklist is a quality gate per partition. |
| Touch support underdelivers (mockup was desktop-first) | Med | Med | Touch input is a shared helper (tap/swipe/long-press) built in the foundation partition, not per-game afterthoughts; one touch device in every test pass. |
| 12 games × polish each = long tail of tuning | Med | Med | Feature-parity bar for ported games; "playable and fair" bar for new ones — tuning beyond that is post-MVP. |
| IP/trade-dress issues on classic clones | Low | Med | Naming policy resolved (see Open Questions): rename only protected marks (Setrit, Bricks); original art everywhere; launch pass double-checks Simon. |
| Vercel/subdomain wiring surprises with existing DNS | Low | Low | Deploy config lands in the foundation partition, verified with a preview URL early rather than at the end. |
