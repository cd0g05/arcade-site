# Canon Summary

> Auto-generated during canon synthesis. Consumed by agents at branch start.
> Target: 300–500 tokens. Optimize for density, not readability.
> Branch-start rule: load this summary first, then `canon/repo-context.md` when present, then active spec front matter and indexed sections only as needed.

## Purpose

Carter's Arcade (arcade.cartercripe.com) is a personal-portfolio site built as a real playable arcade — 6 hub-embedded mini-games + 6 full-page cabinet games, zero engines, zero runtime deps, no backend, no accounts.

## Architecture

- **Click-to-wake cartridge model**: every game implements `Cartridge { keys?, onKey?, alwaysOn?, start(), stop() }` and registers with a per-page `Hub` singleton (`src/lib/hub.ts`) — the *only* code allowed to attach document-level key/mouse listeners or call `preventDefault` on nav keys. Games never touch `document` directly.
- Exactly one keyboard-claiming game is awake at a time (except `alwaysOn` Miner). Click-away/Esc pauses (state-preserving, never resets); `F`/⛶ toggles CSS-takeover fullscreen (`position:fixed`, never the Fullscreen API).
- `createLoop` (fixed 60 Hz accumulator + rAF render) decouples game speed from display refresh; turn-based games skip it and render on input.
- `src/lib` and `src/ui` are **frozen** post-foundation — changes require a Cicadas Signal broadcast. Games ship their own CSS.
- Cabinet pages are ~3-line HTML shells; `cabinet-entry.ts` dynamic-imports the game module and renders `src/ui/cabinet.ts`'s scaffold, so chrome can't drift.
- Storage is `arcade:`-prefixed localStorage via `store.get(key, fallback, validator?)` — tolerant, never throws on corrupt data.

## Modules

- `lib`: frozen runtime — Hub, Cartridge contract, storage, audio, screen (pixelated canvas + DPR), loop, input (gestures)
- `ui`: frozen chrome — card.ts (`.gcard` veil/LED/stats), cabinet.ts (page scaffold), scoreboard.ts, ticker.ts
- `games`: 12 games, one dir each; pure `logic.ts` (injectable `rand`, unit-tested) + DOM/canvas `{game}.ts` where rules matter (2048, Miner, Lights Out, Snake, Minesweeper, Water Sort, Setrit)
- `sprites`: ASCII maps (`maps.ts`) → committed inline-SVG (`generated.ts`) via `npm run sprites`; 8 sprites, Memory uses all 8 as pair faces

## Conventions

- Naming: kebab-case files, PascalCase types, UPPER_SNAKE constants, short lowercase game ids
- Naming doctrine: normal names unless a lawyer would recognize them — Setrit (Tetris), Bricks (Breakout), Echo (Simon — live Hasbro mark US Reg. 1211692)
- Every `logic.ts` gets a Vitest spec with a seeded LCG (not `Math.random`) for reproducibility
- Cabinet game-over = sleep the cartridge + rewrite veil copy, not a modal (releases nav keys back to the page)
- Pointer input gates on `Hub.current === id` so the waking click never counts as game input
- Lighthouse Accessibility 100 is a build gate per partition, not a final-pass afterthought
- No comments explaining *what* code does — only non-obvious *why*
