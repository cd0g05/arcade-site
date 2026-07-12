# Carter's Arcade — Project Handoff

**Status:** Prototype/mockup complete. This doc is context for whoever (human or AI) builds the real site.
**Prototype file:** `arcade-mockup.html` — single self-contained HTML file, open it directly in a browser.

---

## 1. The goal

A personal arcade page hosted on cartercripe.com (likely its own subdomain, matching the existing symlink/subdomain setup for other IntelliJ projects on that domain). The point is low-friction fidgeting: land on the page, play a few rounds of one game, click into another, let an idle game tick in the background, no loading screens or menus between games. Think "Chrome dino game" energy multiplied across a couple dozen games.

Two tiers of games:

- **Hub-embedded** — simple enough to live directly on the dashboard as a live, playable tile (2048, merge games, idle clicker, etc).
- **Full cabinets** — more involved games that get their own page/screen, linked from a card on the hub.

Every game should also be playable **fullscreen** (the game takes over the whole page), including the hub-embedded ones.

## 2. Core interaction model

This is the part that most needs to survive into the real build — it's the whole design thesis.

- **Games are click-to-wake, not hover-to-wake.** Hovering only highlights a card. A game only starts capturing input (especially keyboard) once it's been clicked. This matters for two reasons: hover-activation would steal arrow keys from the page while someone's just scrolling past, and it doesn't map to touch at all.
- **Only one keyboard-driven game is "active" at a time** (in the hub view). Clicking a new game pauses whatever was previously active. Idle/always-on games (clicker) are the exception — they're exempt from this since they don't take keyboard input and the whole point is they run in the background.
- **Clicking outside the active game's card pauses it.** A paused game shows a "click to resume" veil over itself rather than resetting.
- **Escape** pauses the active game (or exits fullscreen if in fullscreen).
- **Fullscreen is a CSS takeover**, not the browser Fullscreen API. The game's card expands via `position: fixed; inset: 0` to fill the viewport. This was a deliberate choice over `Element.requestFullscreen()` — no permission prompt, more predictable across browsers, and "make the game the whole page" is literally what's being asked for. `F` key or a corner icon button toggles it; `Esc` backs out.
- **Global key routing:** arrow keys / WASD / space are only `preventDefault()`'d while a game is actively awake and listening for them. Otherwise the page must scroll normally. This is a common bug source (an inactive Tetris card eating your arrow-key page scroll) — flagging it explicitly so it's tested for.

### The "cartridge" pattern (see mockup JS)

The mockup includes a small `Hub` object that every game registers with:

```js
Hub.register('game-id', {
  keys: [...],           // which keys this game wants routed to it
  onKey(key) { ... },    // handle one of those keys
  alwaysOn: true|false,  // true = idle games like the clicker; skips wake/sleep entirely
  start() { ... },       // called when the game wakes (or once, if alwaysOn)
  stop() { ... }         // called when the game is paused/put to sleep
});
```

`Hub` owns waking, sleeping, and fullscreen toggling centrally, so individual games don't need to know about each other or duplicate that logic. **This pattern is worth carrying into the real build** — it's what makes "play a few rounds of dino, then click 2048, then let the clicker tick" work cleanly with many games on one page instead of turning into a pile of one-off event listeners.

## 3. The full game list

Compiled from our full conversation, roughly grouped by how they'd fit the hub-vs-cabinet split. Not all of these need to ship — treat as the target roster, prioritize freely.

### Fidget-tier (hub-embeddable, prototyped in the mockup: Dino Run, 2048, Token Miner)
Snake, Breakout, Simon, Whack-a-Mole, Memory (card-flip), 2048, idle/incremental clicker, Minesweeper, Lights Out, Stack (tap-to-drop-slice), Timberman, Piano Tiles, Flappy Bird, the Chrome dino runner, 1010!-style block-grid puzzle.

### One-button timing games
Dino runner, Timberman, Piano Tiles, Stack, arcade Stacker, helicopter/cave-flyer.

### Merge & physics-toy games (all share one matter.js-style physics engine once built)
Suika-style fruit merge, Ball Merge 2048 (X2 Blocks-style), Drop the Number (grid version, no physics needed), falling-sand toy, Sand Balls, Where's My Water clone, Sugar Sugar (draw ramps to route falling particles), Happy Glass (draw-a-line to fill a glass), Pull the Pin, screw/bolt-pivot puzzles, Save the Dog (draw-a-line shield), Plinko, Suika-adjacent Little Alchemy (combine elements), top-down mini golf, Lunar Lander, artillery/Scorched-Earth-style game.

### Grid & logic puzzles
Rush Hour, Sokoban, 15-puzzle, Sudoku (daily), nonogram/picross (daily, reveals pixel art), Water Sort / Ball Sort, Flow Free, Untangle (Planarity), maze generator/solver toy.

### Classic arcade action
Pong, Breakout, Snake, Tetris ("Setrit" — see naming note below), Space Invaders ("Invaders"), Asteroids, Galaga, Centipede, Missile Command, a Robotron-style twin-stick shooter, Defender, Battlezone (wireframe 3D tank), Duck Hunt (mouse-as-lightgun), Donkey Kong, Joust, Bubble Bobble, Lode Runner, Qix, Pipe Mania, Puzzle Bobble, Tapper, Track & Field.

### Skill trainers
Aim trainer (click/reaction-time/FPS-style), reaction-time test, typing test (Monkeytype-style).

### Beat-the-AI
Tic-tac-toe, Connect 4 (minimax + alpha-beta), Tron light-cycles vs. bot.

### Cards & dice
Solitaire, Blackjack, video poker, Yahtzee, mahjong solitaire, triple-tile matcher (Zen Match-style).

### Strategy / defense
Lane-based tower defense (Plants vs. Zombies-style — cheapest to build), fixed-path tower defense (Bloons-style), maze-building tower defense (Desktop TD-style, flow-field pathing), a minimal Vampire Survivors-style auto-shooter.

### Racing / pseudo-3D
Pole Position/OutRun-style pseudo-3D racer (horizontal-strip road trick).

### Nostalgia / text
Oregon Trail-style, a Zork-style text adventure, SkiFree.

### Deliberately deferred / higher-cost
Pinball (flipper physics is genuinely hard, treat as a stretch goal), Lemmings, full 3D anything.

### Naming / IP note
Some classics need renamed clones to avoid IP trouble: **Tetris → already renamed "Setrit"** in conversation (keep this — it's a good bit and dodges The Tetris Company's aggressive trade-dress enforcement). Apply the same logic to Pac-Man/Galaga-style games (Bandai Namco), tower-defense games that lean too hard on Bloons/PvZ branding, and anything with a licensed name generally — reskin/rename before shipping publicly.

## 4. What's in the mockup file

`arcade-mockup.html` is a single self-contained file (~150KB, fonts embedded as base64, all sprites inline SVG, no external requests, no build step — open it directly).

**Fully functional (not just visual):**
- **Dino Run** — canvas-based runner, procedural obstacles, jump physics, best score in localStorage, demonstrates the click-to-wake / pause-on-click-away / fullscreen pattern.
- **2048** — full game logic (slide/merge/spawn/game-over), arrow keys + WASD, board state persists across reloads via localStorage.
- **Token Miner** — an idle clicker with a buyable auto-miner, an offline-earnings calculation (capped at 4h) when you return to the tab, demonstrating the `alwaysOn` cartridge type.

**Visual/structural only (stubs to build out):**
- A "Cabinets" grid of 12 game cards (Snake, Minesweeper, Water Sort, Bricks/Breakout, Aim Trainer, Sudoku, Merge Jar, Invaders, Tower Defense, Pull the Pin, Blackjack, Duck Gallery) showing the intended `LIVE` / `SOON` / `DAILY #N` pill states and link structure — these are `<a href="#...">` stubs, not real games.
- A high-scores panel, a controls-legend panel, a header with a sound toggle and a decorative "insert coin" credits counter, and a horizontally scrolling ticker of live stats.
- A "Design Tokens" section at the bottom documenting the visual system itself (palette swatches, the 2048 tile color ramp, type-tier samples, the sprite sheet, and notes on the animation style) — useful as a living style reference, can be deleted from the real site or kept as an internal `/style-guide` page.

## 5. Art & style system

Built as a **pixel layer on top of your existing Light Film Room design system** (from `design.md`/`README.md`/`example.html`), not a replacement. The shell — page background, colors, buttons, pills, panels, hard corners — is untouched Light Film Room. The pixel/arcade identity is concentrated specifically in the game surfaces and structural chrome, not smeared across every element.

**Colors:** unchanged from the existing palette. Base `#ffffff`, panel `#f4f4f5`, border `#d4d4d8`, ink `#18181b`, accent pink `#be185d` / dark `#9d174d`, accent green `#047857`. Same graph-paper background (`linear-gradient` grid at `#e4e4e7`, 2rem cells) as the existing site.

**Typography** — kept the three-tier structure, swapped the display face:
- **Display:** **Press Start 2P** (open-license Google/Fontsource font) instead of Druk. Druk's OTFs in the uploaded assets are trial files that can't legally be embedded/redistributed in a shipped product — Druk is fine to keep using elsewhere on cartercripe.com where you've presumably licensed it, but for this arcade subpage a genuine bitmap font fits the brief better anyway and sidesteps the licensing question entirely. Used sparingly — headings, card titles, score labels — never body copy.
- **UI/mono:** JetBrains Mono, unchanged. Carries pills, buttons, stats, the ticker, all the "technical readout" text.
- **Body:** Helvetica Neue/Arial, unchanged, used minimally (this page is mostly UI, not prose).

**New pixel-specific moves, layered on top:**
- Hard offset shadows (`4px 4px 0 <ink>`) on hover/active states instead of soft box-shadows — cards "lift" like a pressed sprite, not like an elevation-shadow UI.
- `steps()` timing functions instead of smooth `ease` transitions, so button presses and card-hover states snap rather than glide.
- A subtle scanline overlay (`repeating-linear-gradient`, low opacity) only on the actual game screens, not the whole page — keeps the arcade-cabinet feel contained instead of making everything look like a CRT.
- Square 8px "LED" indicators (lit green when a game is active) instead of dots or icons for status.
- All game icons and the sprite sheet are **hand-built inline SVG** — one `<rect>` per horizontal run of same-colored pixels, using only palette colors, `shape-rendering="crispEdges"`. No external image assets, no icon library. `build.py` in the project generates these from small ASCII-art maps (see `SPRITES` dict) — genuinely easy to add new sprites this way without an image editor.
- 2048's tile colors are a purpose-built ramp from pale pink through the accent pink to pink-dark, topping out in the accent green at 2048+ — this was designed specifically for this component, not reused from elsewhere.

**Deliberately NOT changed:** border-radius stays globally 0, the light background stays light (no CRT-green-on-black cliché), no pixel-font body text, no retro drop-shadowed "ARCADE" wordmark — the existing brand stays legible and the pixel identity earns its place through the game surfaces themselves rather than costume-ing the whole page.

## 6. Technical notes for the real build

- **No frameworks/build step in the mockup** — plain HTML/CSS/JS, generated by a small Python script (`build.py`) that inlines fonts as base64 and expands ASCII sprite maps into SVG. The real site will obviously want a proper structure (see below) but there's no requirement to adopt any particular framework; the cartridge pattern works fine with React/Vue/vanilla.
- **Fonts:** Press Start 2P + JetBrains Mono, both open-license, available via Fontsource/Google Fonts or self-hosted `.woff2`. Don't need to stay base64-embedded in the real site — that was purely to keep the single-file mockup portable.
- **Storage:** the mockup uses `localStorage` with an `arcade:` key prefix for all persistence (best scores, 2048 board state, clicker state/timestamp, sound preference, credits). A "reset save data" link clears everything under that prefix. This is a fine pattern to keep for a client-only static site; if the real site ever gets accounts/a backend, this is the layer to swap out.
- **Recommended real structure**, given the existing subdomain/symlink setup on cartercripe.com:
  - One hub page per the mockup, hosting the always-embedded games directly.
  - Each cabinet game as its own route/subpage (or subdomain, consistent with the existing IntelliJ-project pattern), sharing a common scaffold: a `requestAnimationFrame` loop, low-res canvas scaled up with `image-rendering: pixelated` (Game Boy's 160×144 was suggested as a nice constraint), keyboard/touch input handling, and the same `localStorage` scoring convention.
  - The falling-sand/physics engine (matter.js is the suggested library) is shared infrastructure across a large cluster of the roster — Suika, Ball Merge, Dig This, Where's My Water, Sugar Sugar, Happy Glass, Pull the Pin, screw puzzles, Save the Dog, Plinko, mini golf, Lunar Lander. Worth building once, well, early.
  - Level-based games (Boulder Dash-likes, Lode Runner, Pipe Mania, Rush Hour, tower defense maps) will cost more in level design/tuning than in engine code — plan for that explicitly rather than treating "engine built" as "game done."
- **Accessibility carried from the mockup:** visible focus rings (`:focus-visible`) on all interactive elements, `aria-label`s on icon-only buttons, `prefers-reduced-motion` disables the decorative animations (ticker scroll, blinking veil text, LED pulse). Keep these when porting.
