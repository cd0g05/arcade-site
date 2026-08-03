/**
 * wipe.ts — pixel-block screen wipe for cabinet navigation and fullscreen
 * toggles. A fixed grid of chunky blocks pops in/out with per-block
 * transition-delay driven by a randomly chosen pattern (radial / steps /
 * wave), matching the site's steps() pixel aesthetic. No-op under
 * prefers-reduced-motion. Fast by design: ~350ms total per phase.
 */

type Pattern = "radial" | "steps" | "wave";

const PATTERNS: Pattern[] = ["radial", "steps", "wave"];
const CELL = 34; // px, approx block size
const BLOCK_MS = 140;
const SPAN_MS = 200; // spread of the stagger across the whole grid
const TOTAL_MS = SPAN_MS + BLOCK_MS;

const reduced = (): boolean =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

let overlay: HTMLDivElement | null = null;
let blocks: HTMLDivElement[] = [];
let cols = 0;
let rows = 0;
let busy = false;

function randomPattern(): Pattern {
  return PATTERNS[Math.floor(Math.random() * PATTERNS.length)]!;
}

function ensureOverlay(): void {
  if (overlay) return;
  overlay = document.createElement("div");
  overlay.className = "px-wipe";
  cols = Math.max(1, Math.ceil(window.innerWidth / CELL));
  rows = Math.max(1, Math.ceil(window.innerHeight / CELL));
  overlay.style.setProperty("--cols", String(cols));
  overlay.style.setProperty("--rows", String(rows));
  blocks = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const b = document.createElement("div");
      b.className = "px-wipe-cell";
      if (Math.random() < 0.06) b.classList.add("px-wipe-cell--accent");
      blocks.push(b);
      overlay.appendChild(b);
    }
  }
  document.body.appendChild(overlay);
}

function delayFor(pattern: Pattern, c: number, r: number): number {
  switch (pattern) {
    case "radial": {
      const cx = (cols - 1) / 2;
      const cy = (rows - 1) / 2;
      const maxD = Math.hypot(cx, cy) || 1;
      return (Math.hypot(c - cx, r - cy) / maxD) * SPAN_MS;
    }
    case "steps":
      return (c / Math.max(1, cols - 1)) * SPAN_MS;
    case "wave": {
      const base = (c / Math.max(1, cols - 1)) * SPAN_MS * 0.7;
      const wave = (Math.sin((r / Math.max(1, rows - 1)) * Math.PI * 2) + 1) / 2;
      return base + wave * SPAN_MS * 0.3;
    }
  }
}

function stage(pattern: Pattern): void {
  let i = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const b = blocks[i++]!;
      const d = delayFor(pattern, c, r);
      b.style.transitionDelay = `${d}ms`;
      b.style.transitionDuration = `${BLOCK_MS}ms`;
    }
  }
}

/** Instantly show a full pixel cover, no animation (e.g. on cabinet page load). */
export function showInstantCover(): void {
  if (reduced()) return;
  ensureOverlay();
  for (const b of blocks) {
    b.style.transitionDuration = "0ms";
    b.style.transitionDelay = "0ms";
    b.classList.add("px-wipe-cell--on");
  }
}

/** Animate the pixel grid to fully cover the viewport. Resolves once covered. */
export function coverScreen(pattern: Pattern = randomPattern()): Promise<void> {
  if (reduced() || busy) return Promise.resolve();
  busy = true;
  ensureOverlay();
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      stage(pattern);
      for (const b of blocks) b.classList.add("px-wipe-cell--on");
      setTimeout(() => {
        busy = false;
        resolve();
      }, TOTAL_MS);
    });
  });
}

/** Animate the pixel grid away, revealing the page underneath. Cleans up the overlay. */
export function revealScreen(pattern: Pattern = randomPattern()): Promise<void> {
  if (reduced() || !overlay) {
    overlay?.remove();
    overlay = null;
    return Promise.resolve();
  }
  if (busy) return Promise.resolve();
  busy = true;
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      stage(pattern);
      for (const b of blocks) b.classList.remove("px-wipe-cell--on");
      setTimeout(() => {
        overlay?.remove();
        overlay = null;
        busy = false;
        resolve();
      }, TOTAL_MS);
    });
  });
}
