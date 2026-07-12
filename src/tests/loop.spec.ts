import { describe, expect, it } from "vitest";
import { createLoop } from "../lib/loop";

/** Manual rAF driver: collects the frame callback so tests control time. */
function makeDriver() {
  let pending: ((t: number) => void) | null = null;
  let nextId = 1;
  let cancelled = 0;
  return {
    raf(cb: (t: number) => void): number {
      pending = cb;
      return nextId++;
    },
    caf(_id: number): void {
      cancelled++;
      pending = null;
    },
    /** Fire the pending frame at absolute time t (ms). */
    tick(t: number): void {
      const cb = pending;
      pending = null;
      cb?.(t);
    },
    get cancelledCount() {
      return cancelled;
    },
    get hasPending() {
      return pending !== null;
    },
  };
}

describe("createLoop — fixed-timestep accumulator", () => {
  it("runs update deterministically: floor(elapsed/step) updates, fixed dt", () => {
    const driver = makeDriver();
    const dts: number[] = [];
    const loop = createLoop({
      update: (dt) => dts.push(dt),
      stepMs: 20, // 50 Hz for exact arithmetic
      raf: driver.raf,
      caf: driver.caf,
    });

    loop.start();
    driver.tick(1000); // first frame establishes the clock — no updates
    expect(dts.length).toBe(0);

    driver.tick(1100); // +100ms → exactly 5 steps of 20ms
    expect(dts.length).toBe(5);

    driver.tick(1130); // +30ms → 1 step, 10ms left in the accumulator
    expect(dts.length).toBe(6);

    driver.tick(1145); // +15ms → 25ms accumulated → 1 step, 5ms remains
    expect(dts.length).toBe(7);

    driver.tick(1150); // +5ms → 10ms accumulated → 0 steps
    expect(dts.length).toBe(7);

    // every update saw the identical fixed dt
    expect(new Set(dts).size).toBe(1);
    expect(dts[0]).toBeCloseTo(0.02, 10);
  });

  it("clamps huge frame deltas (background tab) to maxDeltaMs", () => {
    const driver = makeDriver();
    let updates = 0;
    const loop = createLoop({
      update: () => updates++,
      stepMs: 20,
      maxDeltaMs: 100,
      raf: driver.raf,
      caf: driver.caf,
    });
    loop.start();
    driver.tick(0);
    driver.tick(60_000); // a minute in the background → clamped to 100ms
    expect(updates).toBe(5);
  });

  it("passes accumulator progress to render as alpha", () => {
    const driver = makeDriver();
    const alphas: number[] = [];
    const loop = createLoop({
      update: () => {},
      render: (a) => alphas.push(a),
      stepMs: 20,
      raf: driver.raf,
      caf: driver.caf,
    });
    loop.start();
    driver.tick(0);
    driver.tick(30); // 1 step + 10ms → alpha 0.5
    expect(alphas[alphas.length - 1]).toBeCloseTo(0.5, 10);
    expect(loop.running).toBe(true);
    loop.stop();
  });

  it("stop() cancels the pending frame and start() resumes cleanly", () => {
    const driver = makeDriver();
    let updates = 0;
    const loop = createLoop({
      update: () => updates++,
      stepMs: 20,
      raf: driver.raf,
      caf: driver.caf,
    });

    loop.start();
    driver.tick(0);
    driver.tick(40);
    expect(updates).toBe(2);

    loop.stop();
    expect(loop.running).toBe(false);
    expect(driver.cancelledCount).toBe(1);
    expect(driver.hasPending).toBe(false);

    // resume much later: the paused gap must NOT be replayed
    loop.start();
    driver.tick(10_000); // re-establishes clock only
    driver.tick(10_020);
    expect(updates).toBe(3);
  });

  it("start() is idempotent while running", () => {
    const driver = makeDriver();
    const loop = createLoop({ update: () => {}, raf: driver.raf, caf: driver.caf });
    loop.start();
    loop.start();
    expect(loop.running).toBe(true);
    loop.stop();
  });
});
