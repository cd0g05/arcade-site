---
summary: "UX for Carter's Arcade: preserve the mockup's click-to-wake cartridge interaction model exactly (wake on click, pause on click-away under a CLICK TO RESUME veil, one keyboard game awake at a time, alwaysOn idle exception, Esc/F handling, CSS-takeover fullscreen), extend it to six cabinet pages sharing a scaffold, and keep the Light Film Room + pixel visual system with all-caps mono UI copy. The existing mockup file is the authoritative visual reference."
phase: "ux"
when_to_load:
  - "When designing or reviewing journeys, flows, states, copy, and interaction constraints."
  - "When implementation questions depend on experience details rather than product goals alone."
depends_on:
  - "prd.md"
modules:
  - "hub page (index)"
  - "cabinet pages + shared cabinet scaffold"
  - "game cards (wake/sleep/veil/fullscreen states)"
index:
  design_goals: "## Design Goals & Constraints"
  journeys: "## User Journeys & Touchpoints"
  information_architecture: "## Information Architecture"
  key_flows: "## Key User Flows"
  ui_states: "## UI States"
  copy_tone: "## Copy & Tone"
  visual_design: "## Visual Design Direction"
  mockups: "## HTML/CSS Mock-Ups"
  consistency: "## UX Consistency Patterns"
  accessibility: "## Responsive & Accessibility"
next_section: "Complete — awaiting Builder review"
---

# UX Design: arcade-buildout

## Progress

- [x] Design Goals & Constraints
- [x] User Journeys & Touchpoints
- [x] Information Architecture
- [x] Key User Flows
- [x] UI States
- [x] Copy & Tone
- [x] Visual Design Direction
- [x] HTML/CSS Mock-Ups
- [x] UX Consistency Patterns
- [x] Responsive & Accessibility

---

## Design Goals & Constraints

**Primary goal:** Low-friction fidgeting. The page should feel like a wall of live arcade cabinets you can walk up to — everything visibly ready to play, nothing demanding attention, nothing interrupting you. First use should produce "oh, they're all *real*" delight within seconds.

**Design constraints:**
- Desktop-first, but every game must be usable on touch (the interaction model was chosen partly because hover doesn't exist on touch).
- Existing design system: **Light Film Room** (`style-guide copy/`) is the base layer; the mockup's pixel layer sits on top of it. Neither is renegotiated in this initiative — the mockup *is* the visual spec.
- Static site: no loading states for data, no network dependency. The only async-ish moments are font loading and returning-visitor localStorage reads.
- **The interaction model in the mockup is the design thesis and is non-negotiable** (see PRD FR-2). Changes to it require Builder sign-off, not implementer judgment.

---

## User Journeys & Touchpoints

### Carter (player) — The Two-Minute Fidget

**Entry point:** Direct — bookmark / typed subdomain.
**First touchpoint:** The hub, fully rendered: Dino Run's canvas showing its idle frame, 2048's saved board, Token Miner already ticking.
**Key moment:** Clicking a second game and watching the first pause under its veil instead of resetting — "it remembers where I was."
**Exit state:** Closes the tab mid-game without ceremony; everything persists.
**Pain points to design around:** an inactive game stealing arrow keys while he scrolls (the flagged bug class); fear that clicking away loses a good run (the veil communicates "paused, not dead").

### Visitor — From Portfolio to Cabinet

**Entry point:** Link from cartercripe.com.
**First touchpoint:** Hub scroll-through; ticker and score panel signal a living site.
**Key moment:** A LIVE cabinet card opens a full page that plays a real, finished-feeling game in the same visual language.
**Exit state:** Plays a couple of cabinets, maybe on her phone later.
**Pain points to design around:** SOON cards must not read as broken links; cabinet pages need an obvious way back to the hub; touch controls must be discoverable (controls legend shows touch equivalents on touch devices).

### Carter (maintainer) — Adding Game #13

**Entry point:** The repo, a month later.
**First touchpoint:** The game-addition guide + an existing game module as a template.
**Key moment:** His new game inherits wake/sleep, fullscreen, veil, audio, and styling without writing any of it.
**Exit state:** Push to main → live.
**Pain points to design around:** shared-runtime behavior that games could accidentally opt out of (make the scaffold the easy path); sprite creation without an image editor (ASCII pipeline).

---

## Information Architecture

### Site Map

```
arcade.cartercripe.com/
├── /                      # Hub
│   ├── Header (title · SND toggle · CREDITS · INSERT COIN)
│   ├── Ticker (scrolling live stats)
│   ├── Hub games grid (6 live cartridge cards)
│   ├── Cabinets grid (LIVE cards → cabinet pages; SOON cards inert)
│   ├── High scores panel + RESET SAVE DATA
│   └── Controls legend panel
├── /games/snake/          # Cabinet pages — one route per game,
├── /games/minesweeper/    # all on the shared cabinet scaffold
├── /games/bricks/
├── /games/aim/
├── /games/water-sort/
├── /games/setrit/
└── /style-guide/          # Design-tokens reference (kept from mockup)
```

### Navigation Model

**Primary nav:** none — the hub *is* the nav. Cabinet cards are the only outbound links.
**Secondary nav:** each cabinet has a persistent `← HUB` link in its header. Browser back also works (plain MPA links).
**Key entry points:** hub for everyone; cabinet URLs are directly shareable/bookmarkable.

---

## Key User Flows

### Flow 1: Wake / Play / Pause (hub, happy path)

1. User clicks anywhere on an asleep game card → card wakes: LED lights green, veil clears, `start()` runs (game resumes from prior state or idle screen).
2. Keyboard input claimed by the game now routes to it; arrows/space no longer scroll.
3. User clicks a different game card → previous game gets `stop()` + "CLICK TO RESUME" veil; new game wakes. (Token Miner ignores all of this — `alwaysOn`.)
4. User clicks empty page space → awake game pauses under its veil; page keys return to normal scrolling.

**Alternate path A:** `Escape` while a game is awake = same as clicking away.
**Alternate path B:** game reaches game-over while awake → card shows its game-over state (e.g. Dino's "GAME OVER / CLICK TO RETRY" in-canvas); a click retries; the card is still the awake game.

### Flow 2: Fullscreen

1. With a game awake, user presses `F` (or clicks the card's corner ⛶ button) → the card expands via CSS (`position:fixed; inset:0`), page scroll locks, game keeps running — same state, bigger surface.
2. `Esc` (or the button again) → card returns to grid position, still awake.
3. In fullscreen, clicking outside the game surface does *not* pause (there is no "outside").

### Flow 3: Cabinet visit

1. User clicks a LIVE cabinet card on the hub → navigates to `/games/{slug}/`.
2. Cabinet page loads with the game asleep behind a "CLICK TO START" veil; page keys scroll normally until then.
3. Click wakes it (same cartridge rules, one game per page). `F`/⛶ for fullscreen; `Esc` pauses; `← HUB` returns.
4. Best score written on game-over; hub scoreboard reflects it on next hub visit.

### Flow 4: Reset save data

1. User clicks `RESET SAVE DATA` in the high-scores panel.
2. Inline confirmation replaces the link: `SURE? THIS WIPES ALL SCORES · YES / NO` (no browser `confirm()` dialog).
3. YES → all `arcade:` keys cleared, panel zeroes out, miner resets, toast `SAVE DATA CLEARED`.

### Flow 5: Returning idle player (Token Miner)

1. User returns after hours away → miner computes offline earnings (capped at 4 h).
2. Toast on the miner card: `WHILE YOU WERE GONE: +{n}` — informative, dismisses itself.

---

## UI States

### Hub game card

| State | Trigger | What the User Sees |
|-------|---------|-------------------|
| **Asleep (fresh)** | Page load, never played | Idle render + veil: `CLICK TO WAKE`; LED off |
| **Awake** | Card clicked | Veil gone, LED lit green (pulsing unless reduced-motion), game running |
| **Paused** | Click-away / Esc / other game woken | Frozen game under veil: `PAUSED — CLICK TO RESUME` |
| **Game over** | In-game death/stalemate | Game's own overlay (e.g. `NO MOVES LEFT` / `CLICK FOR NEW GAME`); still awake |
| **Fullscreen** | `F` / ⛶ while awake | Card fills viewport; scanline overlay; ⛶ becomes close affordance |
| **AlwaysOn (miner)** | Always | No veil ever; ticking count; hover highlight only |

### Cabinet card (hub Cabinets grid)

| State | Trigger | What the User Sees |
|-------|---------|-------------------|
| **LIVE** | Game shipped | Sprite icon, title, `LIVE` pill (green); whole card is a link; hover = offset-shadow lift |
| **SOON** | Not yet built | Dimmed card, `SOON` pill (gray); not a link, no hover lift; cursor default |
| **DAILY #N** | v2 only | Defined in CSS, unused in MVP |

### Cabinet page

| State | Trigger | What the User Sees |
|-------|---------|-------------------|
| **Idle** | Page load | Game surface with `CLICK TO START` veil; legend + scores visible |
| **Playing / Paused / Game over / Fullscreen** | As hub card | Same cartridge behaviors on the page's single game |

### High-scores panel

| State | Trigger | What the User Sees |
|-------|---------|-------------------|
| **Empty** | New visitor | Zeroed rows (`0000`) — never a blank panel |
| **Populated** | Saved data exists | Current bests; a row flashes when a best updates live |
| **Post-reset** | Reset flow confirmed | Zeroed rows + `SAVE DATA CLEARED` toast |

---

## Copy & Tone

**Voice:** terse arcade-machine readout. ALL CAPS in JetBrains Mono for every UI label; sentence case appears nowhere in chrome. Playful but dry ("INSERT COIN" is decorative and the site knows it).

**Key principles:**
- Labels state facts, not invitations: `SCORE`, `BEST`, `MINERS ×3` — no "Your score:".
- Veils always say what a click does: `CLICK TO WAKE`, `CLICK TO RESUME`, `CLICK TO RETRY`.
- Never blame or alarm: reset copy is matter-of-fact, game over is part of the fun.
- Numbers are zero-padded where the mockup pads them (`0042`).

**Critical copy samples:**

| Context | Copy |
|---------|------|
| Asleep veil | `CLICK TO WAKE` |
| Paused veil | `PAUSED — CLICK TO RESUME` |
| Cabinet idle veil | `CLICK TO START` |
| 2048 stalemate | `NO MOVES LEFT` / `CLICK FOR NEW GAME` |
| Reset confirm | `SURE? THIS WIPES ALL SCORES · YES / NO` |
| Reset done | `SAVE DATA CLEARED` |
| Offline earnings | `WHILE YOU WERE GONE: +{n}` |
| SOON pill | `SOON` |
| Storage note | `STORED LOCALLY IN YOUR BROWSER` |

---

## Visual Design Direction

**Style:** Light Film Room base + contained pixel layer — exactly as built in the mockup and documented in handoff §5. Not re-derived here; the mockup is authoritative. Key commitments:

- **Palette (unchanged):** base `#ffffff`, panel `#f4f4f5`, border `#d4d4d8`, ink `#18181b`, pink `#be185d`/`#9d174d`, green `#047857`; graph-paper background grid.
- **Type tiers:** Press Start 2P (display only — headings, card titles, score labels), JetBrains Mono (all UI/readout text), Helvetica Neue/Arial (rare body copy).
- **Pixel moves:** hard `4px 4px 0` offset shadows on hover/active; `steps()` timing (snap, don't glide); scanline overlay on game screens only; square 8px LED indicators; hand-built crisp-edges SVG sprites from the ASCII pipeline; 2048's bespoke pink→green tile ramp.
- **Deliberate negatives (do not "improve"):** border-radius stays 0 globally; background stays light (no CRT-green-on-black); no pixel-font body text; no retro drop-shadow wordmark.

---

## HTML/CSS Mock-Ups

**Artifact path:** `Arcade Mockup Claude.html` (repo root — pre-existing, not under `drafts/mockups/`)
**Viewport target:** desktop-first, responsive grid down to mobile
**Purpose:** authoritative reference for the entire hub — layout, all card states, three working games, panels, ticker, design-tokens section. Open directly in a browser; it is self-contained.
**Notes:** No separate mock-up exists for cabinet pages. Cabinet scaffold = the mockup's card chrome (title, stats row, screen w/ scanlines, legend) promoted to page scale with a `← HUB` link — visual invention beyond that should crib from the hub's existing vocabulary. If scaffold layout proves contentious at review time, a one-page static mock-up will be added to `.cicadas/drafts/arcade-buildout/mockups/` before the cabinets partitions start.

---

## UX Consistency Patterns

### Button Hierarchy
- **Primary:** filled pink (`INSERT COIN`, `BUY MINER · 15`) — one per panel.
- **Secondary:** bordered, panel-background (`SND:ON`, `NEW GAME`).
- **Destructive:** text link + inline confirm (`RESET SAVE DATA`) — deliberately low-prominence.

### Feedback Patterns
- **Success/notice:** per-card toast (miner earnings, save cleared), self-dismissing, no global toast system.
- **Best-score update:** the affected stat flashes once (`flash` class); reduced-motion gets a color change without animation.
- **Error:** the site has no runtime error surface; storage corruption silently falls back to fresh state.

### Game-state Patterns (this project's "form patterns")
- **Veils** are the single mechanism for asleep/paused/idle states — same DOM pattern, same blink cadence (static under reduced-motion), everywhere.
- **LEDs** are the single "which game is awake" indicator.
- **Score readouts** always `LABEL <b>value</b>` in mono caps, zero-padded per game convention.

### Navigation Patterns
- **Active state:** n/a on hub (no nav); cabinet pages mark nothing — `← HUB` is a plain link.
- **Back:** browser back always works (MPA, no history hijacking).

### Modal & Overlay Patterns
- **No modals anywhere.** Confirmation is inline (reset flow); overlays are in-card veils and the fullscreen takeover only.
- **Fullscreen dismissal:** `Esc`, or the ⛶ toggle. Body scroll locked while active.

---

## Responsive & Accessibility

**Breakpoints:**

| Breakpoint | Width | Layout |
|-----------|-------|--------|
| Mobile | < 640px | Single-column cards; ticker still scrolls; cabinets grid 2-up; touch controls per legend |
| Tablet | 640–1024px | 2-col hub games; cabinets 3-up |
| Desktop | > 1024px | Mockup's full grid (games row + 4-up cabinets) |

**Accessibility standards:** WCAG 2.1 AA for all chrome/UI (game-canvas interiors exempt but game-adjacent UI is not).

**Key requirements:**
- Full keyboard operability of chrome: cards focusable, `Enter`/`Space` wakes a focused game, all buttons/links reachable.
- `:focus-visible` rings on every interactive element (carried from mockup).
- `aria-label` on icon-only buttons (⛶, miner token button); veil state changes announced via `aria-live="polite"` on the card status line.
- `prefers-reduced-motion`: ticker scroll, veil blink, and LED pulse disabled; games themselves still animate (they're the content).
- Touch targets ≥ 44×44px for all buttons/pads; long-press = flag (Minesweeper), swipe = direction (2048, Snake), documented in the controls legend which swaps to touch copy on coarse pointers.

---

## Hub-Games Reflect Notes (feat/hub-games, 2026-07-12)

Copy/IA reality vs. this spec — recorded at partition completion:

- **Veil copy as shipped**: asleep veil is `▶ CLICK TO WAKE` (keeps the mockup's ▶ glyph); paused veil is `PAUSED · CLICK TO RESUME` (middle dot per the mockup — the copy table's em-dash variant was normalized to the mockup character, set by frozen `hub.ts`).
- **Reset feedback**: `SAVE DATA CLEARED` renders inline in the scores panel where the link was (green, 3 s), rather than as a floating toast — consistent with the "no global toast system" rule; the miner keeps its own per-card toast for offline earnings.
- **Cabinets grid**: 13 cards (roster six + mockup's seven flavor cards incl. Sudoku's DAILY pill), all `SOON` until launch flips the roster six to LIVE links.
- **Scoreboard rows**: Dino, 2048, Tokens Mined, Simon Streak, Memory Moves, Lights Out Moves (fewest-moves rows show `—` until set), plus Snake/Minesweeper placeholders (`—`) for the cabinet partitions.
- **Controls legend**: touch-aware copy shipped (CLICK/TAP, swipe guidance, note that mouse games never capture arrows).

---

## Launch Reflect Notes (feat/launch, 2026-07-12)

- **Simon is now ECHO** everywhere in copy: card title `ECHO`, pill `MEMORY`, scoreboard row `ECHO STREAK`, ticker `ECHO STREAK {n}`, controls legend "Echo pads, Memory cards, Lights Out grid…".
- **Contrast**: supporting text tone darkened (`--sub` #52525b) and SOON cabinet cards dim their sprite rather than all their text — same visual hierarchy, WCAG AA at small sizes.
- **Links in fine print are underlined** (reset link, footer) — color alone no longer carries them.

## Cabinets-Action Reflect Notes (feat/cabinets-action, 2026-07-13)

- Cabinet game-over is a veil state: the card sleeps and the veil reads `GAME OVER · SCORE n` / `▶ CLICK TO PLAY AGAIN` (aim: `TIME! n HITS · x% ACC` / `▶ CLICK TO GO AGAIN`); clicking re-wakes into a fresh run. Pause mid-run still reads `PAUSED · CLICK TO RESUME` and preserves state.
- Snake/Bricks/Aim hub cards are LIVE links (`PLAY ▸` on hover); scoreboard gained a SNAKE row and the ticker a SNAKE BEST stat. Minesweeper stays the lone SOON among rows until the puzzle partition.
- Bricks shows lives as ■■■ in the stat row; serve is stuck-to-paddle until space/click.
