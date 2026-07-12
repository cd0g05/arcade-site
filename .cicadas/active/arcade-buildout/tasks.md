---
summary: "Execution checklist for arcade-buildout across five partitions: foundation (scaffold, runtime, styles, sprites, deploy), hub-games (chrome + 6 cartridges), cabinets-action (Snake/Bricks/Aim), cabinets-puzzle (Minesweeper/Water Sort/Setrit), launch (integration, checklists, domain). No PR boundaries (lifecycle: all direct merges with Builder approval)."
phase: "tasks"
when_to_load:
  - "When selecting the next implementation task or reviewing completion state."
  - "When checking partition progress or execution sequencing."
depends_on:
  - "prd.md"
  - "ux.md"
  - "tech-design.md"
  - "approach.md"
modules:
  - "src/lib"
  - "src/ui"
  - "src/games"
  - "games/*"
  - "index.html"
index:
  foundation: "## Partition: feat/foundation"
  hub_games: "## Partition: feat/hub-games"
  cabinets_action: "## Partition: feat/cabinets-action"
  cabinets_puzzle: "## Partition: feat/cabinets-puzzle"
  launch: "## Partition: feat/launch"
  initiative_boundary: "## Initiative Boundary"
next_section: "## Partition: feat/foundation"
---

# Tasks: arcade-buildout

<!-- Lifecycle: no PR boundaries — features merge directly to initiative branch and the
     initiative merges directly to main, each on explicit Builder approval. -->

## Partition: feat/foundation

- [x] Scaffold Vite MPA project: `package.json`, `vite.config.ts` (rollup inputs for hub + 6 cabinet pages + style-guide), strict `tsconfig.json`, Vitest config; remove vestigial `pyproject.toml`; commit lockfile <!-- id: 1 --> <!-- done: also removed vestigial .python-version and replaced the Python-era .gitignore (its `lib/` rule would have ignored src/lib); added demo/index.html MPA input for the task-10 demo cartridge; toolchain resolved to vite 8 / typescript 7 (native tsc) / vitest 4 -->
- [x] Port CSS system from mockup + `style-guide copy/design.md`: `tokens.css` (palette, type tiers, graph-paper grid), `base.css` (shell, panels, buttons, pills), `arcade.css` (offset shadows, steps() timing, scanlines, LEDs, veils, .fs takeover), `fonts.css` via Fontsource <!-- id: 2 --> <!-- done: entire mockup CSS ported (incl. dino/2048/clicker/cabinets/style-guide styles so src/styles can freeze); mockup's .gcard[data-game="clicker"] generalized to .gcard--always-on; NEW additions: .sr-only, .gcard.active .screen{touch-action:none}, cabinet-page scaffold classes; 2048 ramp lifted into --ramp-* tokens -->
- [x] Build `storage.ts` (arcade: prefix, tolerant get/set/clearAll) with Vitest specs for corrupt-JSON fallback and clearAll scoping <!-- id: 3 --> <!-- done: 8 specs green; get() takes an optional shape validator (returns fallback + console.warn on rejection, per tech-design error-handling pattern); also exposes remove() -->
- [x] Build `audio.ts` (lazy AudioContext, beep(), persisted sound toggle) and `screen.ts` (low-res pixelated canvas setup with DPR handling) <!-- id: 4 --> <!-- done: sound toggle persisted under arcade:sound (tech-design key; mockup used arcade:snd — no migration, fresh default true); screen.ts scales backing store by integer DPR (cap 2), ctx pre-scaled to logical units -->
- [ ] Build `loop.ts` (fixed-timestep accumulator, rAF render, start/stop) with a deterministic-step unit test <!-- id: 5 -->
- [ ] Build `input.ts` gesture helper (tap/swipe/long-press with scroll-vs-swipe discrimination) <!-- id: 6 -->
- [ ] Build `cartridge.ts` + `hub.ts`: registration, wake/sleep arbitration, alwaysOn exemption, Esc/F handling, CSS fullscreen toggle, and the key-routing invariant (sole preventDefault owner) <!-- id: 7 -->
- [ ] Build `card.ts` (veil, LED, stats row, ⛶ button, aria-live status) and `cabinet.ts` (page scaffold: header, ← HUB, screen, legend) <!-- id: 8 -->
- [ ] Port sprite pipeline: `scripts/gen-sprites.ts` + `maps.ts` (from mockup/build.py ASCII maps) emitting committed `generated.ts`; add `npm run sprites` <!-- id: 9 -->
- [ ] Demo cartridge page exercising the full contract; run the manual key-routing + touch smoke checklist from approach.md acceptance criteria <!-- id: 10 -->
- [ ] Create Vercel project (static preset, no functions), add `vercel.json` if needed, verify preview deploy URL serves the build; enable Vercel Web Analytics and add the deferred `/_vercel/insights/script.js` tag to all HTML entries <!-- id: 11 -->
- [ ] Reflect: update specs to match implementation reality; confirm foundation acceptance criteria; request Builder approval to merge feat/foundation → initiative/arcade-buildout <!-- id: 12 -->

## Partition: feat/hub-games

- [ ] Build hub page structure + chrome from mockup: header (SND toggle, credits, INSERT COIN), ticker, hub-games grid, Cabinets grid (SOON pills), high-scores panel, controls legend (touch-aware copy) <!-- id: 20 -->
- [ ] Port Dino Run to a cartridge (canvas, procedural obstacles, jump physics, speed ramp, best persisted; click/tap/space/↑/W) <!-- id: 21 -->
- [ ] Port 2048: `logic.ts` (slide/merge/spawn/game-over) with unit tests + cartridge UI (arrows/WASD/swipe, board persistence, NEW GAME, NO MOVES LEFT overlay) <!-- id: 22 -->
- [ ] Port Token Miner as alwaysOn cartridge: `logic.ts` (rates, costs, offline earnings with 4h cap and negative-delta clamp) with tests + UI (mine button, BUY MINER, toast) <!-- id: 23 -->
- [ ] Build Simon (sequence playback with per-pad tone+flash, click/tap input, best streak) <!-- id: 24 -->
- [ ] Build Memory (card-flip pairs with pipeline sprites, move counter, best) <!-- id: 25 -->
- [ ] Build Lights Out: `logic.ts` (solvable-board generation via random press sequence) with tests + 5×5 UI <!-- id: 26 -->
- [ ] Wire scoreboard live updates + reset-save-data inline confirm flow + toasts; build `/style-guide` page from mockup's design-tokens section <!-- id: 27 -->
- [ ] Run hub key-routing checklist (per approach.md acceptance criteria) and mockup side-by-side visual pass <!-- id: 28 -->
- [ ] Reflect: update specs; confirm partition acceptance criteria; request Builder approval to merge feat/hub-games → initiative/arcade-buildout <!-- id: 29 -->

## Partition: feat/cabinets-action

- [ ] Build `cabinet-entry.ts` bootstrapper + Snake cabinet end-to-end (grid movement, arrows/WASD + swipe, speed ramp, best persisted) proving the scaffold <!-- id: 40 -->
- [ ] Build Bricks cabinet (paddle via pointer + arrows, ball physics, lives, brick layouts, speed-up, best) <!-- id: 41 -->
- [ ] Build Aim Trainer cabinet (timed target mode, hits/accuracy/best persisted, pointer + touch) <!-- id: 42 -->
- [ ] Touch + key-routing pass on all three cabinets (veil states, Esc, fullscreen, scroll never stolen while asleep) <!-- id: 43 -->
- [ ] Reflect: update specs; confirm partition acceptance criteria; request Builder approval to merge feat/cabinets-action → initiative/arcade-buildout <!-- id: 44 -->

## Partition: feat/cabinets-puzzle

- [ ] Build Minesweeper `logic.ts` (board gen, first-click-safe relocation, flood reveal, win/lose detection) with unit tests <!-- id: 50 -->
- [ ] Build Minesweeper cabinet UI (3 difficulties, flags incl. long-press, timer gated on awake state, best times per difficulty) <!-- id: 51 -->
- [ ] Build Water Sort `logic.ts` (reverse-pour solvable generation, legal-pour validation, undo stack) with unit tests <!-- id: 52 -->
- [ ] Build Water Sort cabinet UI (tube rendering, pour animation within steps() idiom, level counter) <!-- id: 53 -->
- [ ] Build Setrit `logic.ts` (7 pieces, rotation + basic kicks, collision, line clear, scoring/levels) with unit tests — timeboxed to "standard-feeling" <!-- id: 54 -->
- [ ] Build Setrit cabinet UI (playfield + next preview, soft/hard drop, level speed ramp, touch controls, best persisted) <!-- id: 55 -->
- [ ] Touch + key-routing pass on all three cabinets <!-- id: 56 -->
- [ ] Reflect: update specs; confirm partition acceptance criteria; request Builder approval to merge feat/cabinets-puzzle → initiative/arcade-buildout <!-- id: 57 -->

## Partition: feat/launch

- [ ] Flip six cabinet cards to LIVE with correct links; verify remaining mockup cards stay SOON; add cabinet bests to scoreboard + ticker stats <!-- id: 70 -->
- [ ] Full key-routing checklist on Chrome, Firefox, Safari + one touch device; fix findings <!-- id: 71 -->
- [ ] Accessibility pass: focus order, Enter/Space wake on focused cards, aria-labels, aria-live veil announcements, reduced-motion audit; Lighthouse a11y ≥ 95 on hub + one cabinet <!-- id: 72 -->
- [ ] Payload audit: hub JS < 100 KB gz (record numbers in this task); font preload check <!-- id: 73 -->
- [ ] Naming double-check per resolved PRD policy (normal names unless protected — verify Simon; Setrit/Bricks stay renamed); README game-addition guide <!-- id: 74 -->
- [ ] Point `arcade.cartercripe.com` at the Vercel project, production smoke test, confirm Vercel Web Analytics records page views <!-- id: 75 -->
- [ ] Reflect: update specs; confirm launch acceptance criteria; request Builder approval to merge feat/launch → initiative/arcade-buildout <!-- id: 76 -->

## Initiative Boundary

- [ ] With Builder approval, merge initiative/arcade-buildout → main (direct merge; no PR per lifecycle) <!-- id: 100 -->
- [ ] Synthesize canon on main (product/ux/tech overviews, module snapshots, canon/summary.md) and present for Builder review before committing <!-- id: 101 -->
- [ ] Archive specs (`cicadas.py archive arcade-buildout --type initiative`), update index, clean up initiative + feature branches <!-- id: 102 -->
