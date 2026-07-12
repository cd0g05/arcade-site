/**
 * maps.ts — ASCII pixel maps for the sprite pipeline (ADR-5).
 *
 * Each sprite is a list of equal-length rows; one char per pixel. Legend
 * chars index into PALETTE (palette colors ONLY — that's the style rule),
 * `.` is transparent. Run `npm run sprites` to regenerate generated.ts.
 *
 * The mockup's build.py is not in the repo; these maps were recovered by
 * decoding the mockup's inline SVG rects (each <rect> is a horizontal run
 * of same-colored pixels).
 */

/** char → palette color. Keep in sync with src/styles/tokens.css. */
export const PALETTE: Readonly<Record<string, string>> = {
  k: "#18181b", // ink
  p: "#be185d", // pink
  d: "#9d174d", // pink-dark
  g: "#047857", // green
  w: "#ffffff", // base
  f: "#f4f4f5", // panel
  b: "#d4d4d8", // border
  l: "#e4e4e7", // grid
  s: "#a1a1aa", // sub
};

export type SpriteRows = readonly string[];

export const SPRITE_MAPS = {
  /** Joystick — the site logo (mockup header). */
  joystick: [
    "...pp.....",
    "..pppp....",
    "..pppp....",
    "...pp.....",
    "....k.....",
    "....k.....",
    "....k.....",
    "..kkkkk...",
    ".kkkkkkk..",
    "kkkkkkkkk.",
    "kkkkkkkkk.",
  ],
  /** Token/coin with a C — the miner's clickable token. */
  token: [
    "...pppppp...",
    "..pddddddp..",
    ".pddddddddp.",
    ".pddwwwwddp.",
    ".pddwwddddp.",
    ".pddwwddddp.",
    ".pddwwddddp.",
    ".pddwwwwddp.",
    ".pddddddddp.",
    "..pddddddp..",
    "...pppppp...",
  ],
  /** S-curled snake with an eye and a tongue — Snake cabinet icon. */
  snake: [
    "..gggggg..",
    "..gggggg..",
    "..gg......",
    "..gg......",
    "..gggggg..",
    "..gggggg..",
    "......gg..",
    "......gg..",
    "..kggggg..",
    ".pgggggg..",
  ],
  /** Crosshair target — Aim Trainer cabinet icon. */
  target: [
    "...kkkkk...",
    "..k.....k..",
    ".k.......k.",
    ".k.......k.",
    ".k...p...k.",
    ".k..ppp..k.",
    ".k...p...k.",
    ".k.......k.",
    ".k.......k.",
    "..k.....k..",
    "...kkkkk...",
  ],
} as const satisfies Record<string, SpriteRows>;

export type SpriteName = keyof typeof SPRITE_MAPS;
