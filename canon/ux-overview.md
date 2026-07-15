# UX Overview

> Canon document. Updated by the Synthesis agent at the close of each initiative.

## Design Direction

**Style:** Light Film Room — a white/zinc paper-and-graph-grid base with a contained pixel-game layer (hard offset shadows, `steps()` easing, scanlines, square LEDs, zero border-radius anywhere).
**Voice & tone:** All-caps mono UI copy, terse arcade-cabinet phrasing ("▶ CLICK TO WAKE", "INSERT COIN", "GAME OVER"). Never cutesy, never apologetic.
**Primary platform:** Web (desktop + touch), single static MPA.
**Existing design system:** Product-specific — ported verbatim from `Arcade Mockup Claude.html`, the authoritative visual reference. Living reference: `/style-guide/`.

---

## Navigation Model

**Top-level structure:**

```
Hub (/)
├── NOW PLAYING — 6 hub cartridges embedded in cards (no navigation, in-place wake)
├── CABINETS — grid of cards; LIVE cards link out, SOON cards are inert
│   ├── /games/snake/
│   ├── /games/bricks/
│   ├── /games/aim/
│   ├── /games/minesweeper/
│   ├── /games/water-sort/
│   └── /games/setrit/
├── HIGH SCORES — live-updating table (hub games + cabinet bests)
└── /style-guide/ — design-system reference (not linked from primary nav)
```

**Navigation pattern:** None in the traditional sense — the hub *is* the nav. Cabinet pages carry a persistent `← HUB` link in their header; browser back also works since everything is plain MPA links (no client router).
**Key entry points:** the hub for everyone; cabinet URLs are directly shareable/bookmarkable.
**Active state:** N/A on the hub (no nav to mark active); cabinet pages mark nothing beyond the plain `← HUB` link.

---

## UX Consistency Patterns

Shared across every game via `src/lib/hub.ts`, `src/ui/card.ts`, and `src/ui/cabinet.ts` — new games must follow these, not invent their own.

### The click-to-wake cartridge model (the core interaction pattern)

- A game/card starts **asleep**: veiled (`▶ CLICK TO WAKE` / `▶ CLICK TO START`), LED off, and the page scrolls normally through it — arrows/space are not captured.
- Click anywhere on the card/page → it **wakes**: veil lifts, LED lights, a beep confirms, keyboard input now routes to that game only.
- Click **anywhere else** → the awake game **pauses** under a `PAUSED · CLICK TO RESUME` veil. Pausing is always state-preserving — never a reset.
- Exactly one keyboard-claiming game is awake at a time. `Esc` pauses (or exits fullscreen first if in it). `F` / the ⛶ button toggles **CSS-takeover fullscreen** (`position:fixed; inset:0`) — never the browser Fullscreen API.
- **Exception:** `alwaysOn` games (Token Miner) never sleep and have no veil — they're idle-sim by design.
- **Game over** is its own veil state, not a modal: the cartridge sleeps itself a beat after death/win and the veil copy flips to a result message (`GAME OVER · SCORE 340` / `CLEARED IN 34s` / `LEVEL 6 SORTED · 22 MOVES`) with a `▶ CLICK TO …` prompt back into a fresh run.

### Feedback

| Event | Pattern |
|-------|---------|
| **Success / new best** | The stat value flashes green (`card.flashStat`), plus a short beep melody |
| **Error / illegal move** | A low "buzz" beep (square wave); no visual shake or toast |
| **Wake / pause** | A confirmatory beep on wake; veil text swap on pause — no animation |
| **Loading** | None needed — everything is instant, no network fetches after page load |
| **Reset confirm** | Inline text swap (`SURE? THIS WIPES ALL SCORES · YES / NO`) — never a browser `confirm()` dialog |

### Actions & Buttons

- **Primary action:** filled button, brand pink (`button-primary`) — used sparingly (e.g. ◉ INSERT COIN).
- **Secondary action:** outlined/plain (`button-secondary`) — sound toggle, ← HUB link, per-game control buttons (NEW GAME, UNDO, RESTART, difficulty pills).
- **Destructive action:** the RESET SAVE DATA flow is the only destructive action in the product; it requires the inline YES/NO confirm, never a native dialog.

### Empty States

Fewest-moves-style stats (Memory, Lights Out, cabinet bests) render `—` for "unset" (0 is a real possible score in some games, so it can't double as the empty sentinel).

### Modals & Overlays

No modals anywhere in the product. Game-over, pause, and reset-confirm are all handled as in-place veil/text-state changes, consistent with the "nothing ever interrupts you" design goal.

---

## Accessibility

**Standard:** WCAG 2.1 AA (verified via headless Lighthouse — 100/100 accessibility on hub, every cabinet page, `/style-guide/`, as of initiative close).
**Keyboard navigation:** Full — cards are focusable (`tabindex=0`), Enter/Space wakes a focused veiled card, all game input is keyboard-reachable per game.
**Screen reader support:** Required — each card carries an `aria-live="polite"` status line the Hub announces through ("Playing.", "Paused.", "Fullscreen."), canvas game surfaces get `role="img"` + `aria-label`.
**Color contrast:** AA minimum — `--sub` was darkened from `#a1a1aa` to `#52525b` during the launch a11y pass specifically to clear small-text contrast.
**Touch targets:** ≥ 44×44px for interactive controls per the mockup's touch legend.
**Reduced motion:** Respected via `prefers-reduced-motion: no-preference` guards on every CSS keyframe animation (pop/pour/drop effects) added by cabinet games.
**Inert while asleep:** asleep game surfaces (grids, tube rows) are set `inert` so focus/AT never lands inside a paused game.

---

## Responsive Breakpoints

| Breakpoint | Width | Layout |
|-----------|-------|--------|
| Mobile | < 640px | Single-column hub cards; ticker still scrolls; cabinets grid 2-up; touch-swapped controls legend |
| Tablet | 640–1024px | 2-col hub games; cabinets grid 3-up |
| Desktop | > 1024px | Mockup's full grid (hub games row + 4-up cabinets grid) |

---

## Copy & Tone

**Voice:** Direct, all-caps mono, arcade-cabinet deadpan. Never explains the obvious; never apologizes for SOON cards.

**Key copy patterns:**

| Context | Approach |
|---------|---------|
| Veil prompts | Imperative + symbol: `▶ CLICK TO WAKE`, `▶ CLICK TO START`, `▶ CLICK TO PLAY AGAIN` |
| Game over / win | Terse result + immediate next action: `GAME OVER · SCORE 340` / `▶ CLICK TO PLAY AGAIN` |
| Empty/unset stat | A plain em dash (`—`), never "N/A" or "no data yet" |
| Reset confirm | `SURE? THIS WIPES ALL SCORES · YES / NO` then `SAVE DATA CLEARED` (green, auto-dismisses after 3s) |
| Naming | Normal names unless a lawyer might recognize them: **Setrit** (not Tetris), **Bricks** (not Breakout), **ECHO** (not Simon — live Hasbro trademark, US Reg. 1211692). Common names are kept otherwise (Snake, Minesweeper, 2048, Memory, Lights Out, Water Sort, Aim Trainer). |

---

## Open Questions

- Whether the 7 non-roster "flavor" SOON cabinet cards (Sudoku, etc.) ever get a UX pass of their own, or stay permanently aspirational — no decision made.
- No mock-up exists for cabinet pages beyond the shared scaffold born from the hub's card chrome; if that scaffold is ever contested, `ux.md` calls for a dedicated static mock-up before further cabinet work — none has been requested to date.
