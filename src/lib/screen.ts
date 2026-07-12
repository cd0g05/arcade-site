/**
 * screen.ts — low-res pixelated canvas setup.
 *
 * Games render into a small logical resolution (Game Boy energy, e.g.
 * 240×80) and the canvas is scaled up by CSS with image-rendering:
 * pixelated. DPR handling: the backing store is multiplied by an integer
 * device-pixel-ratio scale (ctx pre-scaled back to logical units), so
 * pixels stay chunky but land on device-pixel boundaries — crisp on hidpi.
 */

export interface Screen {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  /** Logical width — draw in these units. */
  w: number;
  /** Logical height. */
  h: number;
  /** Clear the full logical surface. */
  clear(): void;
}

export interface ScreenOptions {
  /**
   * Cap on the integer DPR multiplier for the backing store (default 2).
   * 1 reproduces the mockup exactly (backing store == logical size).
   */
  dprCap?: number;
}

export function setupScreen(
  canvas: HTMLCanvasElement,
  w: number,
  h: number,
  opts: ScreenOptions = {},
): Screen {
  const dprCap = opts.dprCap ?? 2;
  const scale = Math.max(1, Math.min(Math.floor(globalThis.devicePixelRatio || 1), dprCap));

  canvas.width = w * scale;
  canvas.height = h * scale;
  canvas.style.imageRendering = "pixelated";

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d canvas context unavailable");
  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = false;

  return {
    canvas,
    ctx,
    w,
    h,
    clear() {
      ctx.clearRect(0, 0, w, h);
    },
  };
}
