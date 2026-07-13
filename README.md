# Carter's Arcade

Handmade pixel games at [arcade.cartercripe.com](https://arcade.cartercripe.com). No engines — Vite + vanilla TypeScript, zero runtime npm dependencies, everything drawn from a seven-color palette.

## Commands

```sh
npm ci             # install (dev deps only)
npm run dev        # Vite dev server
npm run build      # tsc --noEmit + vite build → dist/
npm run preview    # serve the built dist/
npm test           # vitest (pure logic modules)
npm run sprites    # regenerate src/sprites/generated.ts from maps.ts
```

Deploys as a static site on Vercel (`vercel.json`); analytics is the first-party `/_vercel/insights/script.js` tag on every page.

## How the arcade works

The hub (`/`) is a grid of **cartridges** — games that live in cards and wake on click. The design thesis, and the #1 invariant in this codebase:

> **A game only captures input while it is awake.** `src/lib/hub.ts` owns the ONLY
> document-level key/mouse listeners and is the ONLY caller of `preventDefault`
> on navigation keys. Asleep games never eat page scroll.

- Click a card → it wakes (LED on, veil off). Click anywhere else → it pauses under a `PAUSED · CLICK TO RESUME` veil. Pausing **never resets** — `stop()` must be state-preserving.
- One keyboard game is awake at a time; `alwaysOn` idle games (Token Miner) are exempt and never sleep.
- `Esc` pauses (or exits fullscreen); `F`/⛶ toggles CSS-takeover fullscreen (`position:fixed; inset:0` — never the Fullscreen API).
- Bigger games get their own **cabinet** page under `/games/{slug}/` on a shared scaffold.

## Adding a game

1. **Make a directory** `src/games/{yourgame}/`. Pure rules go in `logic.ts` (no DOM, no storage, injectable `rand`) with a spec in `src/tests/`. UI goes in `{yourgame}.ts`; game-specific styles in `{yourgame}.css`, imported by the module (global styles in `src/styles/` are frozen).
2. **Implement the cartridge contract** (`src/lib/cartridge.ts`):
   ```ts
   { keys?: string[]; onKey?(key): void; alwaysOn?: boolean; start(): void; stop(): void }
   ```
   - Claim `keys` **only** if the game truly needs them — mouse games claim none so arrows keep scrolling the page.
   - Never attach document/window input listeners; keys arrive through `onKey`, pointer events attach to your own elements.
   - Gate pointer input on being awake so the click that wakes the card doesn't count as a move.
   - `stop()` cancels loops/timers and keeps all state.
3. **Mount it on the hub**: in `src/pages/hub.ts`, `addGame({ id, title, veilMsg, stats, … }, mountYourGame)`. The card (veil, LED, ⛶, stats row, aria-live status) comes from `src/ui/card.ts`; return `{ api, onReset }` — `onReset` zeroes your state for the RESET SAVE DATA flow.
4. **Persist through `src/lib/storage.ts` only**: `store.get("best:yourgame", 0, validator)` — keys are `arcade:`-prefixed, reads are tolerant (corrupt data falls back, never crashes). Fewest-moves-style bests use `0` = unset, rendered `—`.
5. **Real-time games** use `createLoop` (`src/lib/loop.ts`, fixed 60 Hz update + rAF render) and `setupScreen` (`src/lib/screen.ts`, low-res pixelated canvas). Turn-based games skip the loop and render on input.
6. **Sprites** are ASCII maps in `src/sprites/maps.ts` (palette chars only) → `npm run sprites` regenerates the committed SVG module. Sound is `beep()` from `src/lib/audio.ts` — synthesized only, no audio files.
7. **Cabinet games** additionally get `games/{slug}/index.html` (copy an existing one), a `vite.config.ts` rollup input, and the shared scaffold from `src/ui/cabinet.ts`.

## Naming doctrine

Normal names unless a lawyer might recognize them: **Setrit** (not Tetris), **Bricks** (not Breakout), **ECHO** (not Simon — live Hasbro mark, US Reg. 1211692). Snake, Minesweeper, 2048, Memory, Lights Out, Water Sort, and Aim Trainer ship under their common names.

## Style system

Light Film Room base (white/zinc palette, graph-paper grid) + a contained pixel layer: hard `4px 4px 0` offset shadows, `steps()` easing, scanlines on game screens only, 8 px square LEDs, `border-radius: 0` everywhere. Press Start 2P for display type, JetBrains Mono for UI readouts. The living reference is [`/style-guide/`](https://arcade.cartercripe.com/style-guide/).
