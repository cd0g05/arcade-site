/**
 * loop.ts — fixed-timestep game loop (ADR-7).
 *
 * update(dt) runs at a fixed step (default 60 Hz) via the classic
 * accumulator pattern; render(alpha) runs once per animation frame. This
 * decouples game speed from display refresh (the mockup's per-frame
 * stepping runs 2× too fast on 120 Hz screens).
 *
 * Real-time games (dino, snake, bricks, setrit, aim) opt in; turn-based
 * games skip the loop entirely and render on input.
 *
 * stop() cancels the pending frame and MUST leave game state intact —
 * cartridges call it from Cartridge.stop().
 */

export interface LoopOptions {
  /** Fixed-step update; dt is stepMs/1000 seconds, always the same value. */
  update(dt: number): void;
  /** Per-frame render; alpha ∈ [0,1) is accumulator progress into the next step. */
  render?(alpha: number): void;
  /** Fixed step in ms. Default 1000/60. */
  stepMs?: number;
  /**
   * Clamp on per-frame delta (ms) so a background tab doesn't unleash a
   * spiral of thousands of updates on return. Default 250.
   */
  maxDeltaMs?: number;
  /** Injectable scheduler hooks (tests). Default requestAnimationFrame. */
  raf?(cb: (t: number) => void): number;
  caf?(id: number): void;
}

export interface GameLoop {
  start(): void;
  /** State-preserving: cancels the pending frame, keeps everything else. */
  stop(): void;
  readonly running: boolean;
}

export function createLoop(opts: LoopOptions): GameLoop {
  const stepMs = opts.stepMs ?? 1000 / 60;
  const maxDeltaMs = opts.maxDeltaMs ?? 250;
  const raf = opts.raf ?? ((cb: (t: number) => void) => requestAnimationFrame(cb));
  const caf = opts.caf ?? ((id: number) => cancelAnimationFrame(id));

  let running = false;
  let rafId: number | null = null;
  let last: number | null = null;
  let acc = 0;

  function frame(now: number): void {
    if (!running) return;
    if (last !== null) {
      acc += Math.min(now - last, maxDeltaMs);
      while (acc >= stepMs) {
        opts.update(stepMs / 1000);
        acc -= stepMs;
      }
    }
    last = now;
    opts.render?.(acc / stepMs);
    rafId = raf(frame);
  }

  return {
    start() {
      if (running) return;
      running = true;
      last = null; // first frame only establishes the clock
      acc = 0;
      rafId = raf(frame);
    },
    stop() {
      running = false;
      if (rafId !== null) caf(rafId);
      rafId = null;
      last = null;
    },
    get running() {
      return running;
    },
  };
}
