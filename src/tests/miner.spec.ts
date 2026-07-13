import { describe, expect, it } from "vitest";
import {
  applyOffline,
  buyMiner,
  cost,
  freshState,
  isMinerState,
  offlineGain,
  OFFLINE_CAP_S,
} from "../games/miner/logic";

describe("miner cost curve", () => {
  it("rounds 15 · 1.15^n up", () => {
    expect(cost(0)).toBe(15);
    expect(cost(1)).toBe(18);
    expect(cost(2)).toBe(20);
    expect(cost(10)).toBe(Math.ceil(15 * 1.15 ** 10));
  });
});

describe("miner offline earnings", () => {
  const base = { tokens: 100, miners: 3, last: 1_000_000 };

  it("earns miners × seconds away", () => {
    expect(offlineGain(base, base.last + 60_000)).toBe(180);
  });

  it("caps at 4 hours", () => {
    const dayAway = offlineGain(base, base.last + 24 * 3600 * 1000);
    expect(dayAway).toBe(3 * OFFLINE_CAP_S);
  });

  it("clamps a backwards clock to zero", () => {
    expect(offlineGain(base, base.last - 60_000)).toBe(0);
  });

  it("earns nothing with no miners", () => {
    expect(offlineGain(freshState(0), 3600_000)).toBe(0);
  });

  it("applyOffline folds the gain and restamps last", () => {
    const now = base.last + 10_000;
    const { state, gained } = applyOffline(base, now);
    expect(gained).toBe(30);
    expect(state).toEqual({ tokens: 130, miners: 3, last: now });
    expect(base.tokens).toBe(100); // input untouched
  });
});

describe("miner purchases", () => {
  it("buys when affordable", () => {
    const { state, bought } = buyMiner({ tokens: 20, miners: 0, last: 0 });
    expect(bought).toBe(true);
    expect(state).toEqual({ tokens: 5, miners: 1, last: 0 });
  });

  it("refuses when short", () => {
    const before = { tokens: 14, miners: 0, last: 0 };
    const { state, bought } = buyMiner(before);
    expect(bought).toBe(false);
    expect(state).toBe(before);
  });
});

describe("miner state validation", () => {
  it("accepts the persisted shape and rejects junk", () => {
    expect(isMinerState({ tokens: 1, miners: 2, last: 3 })).toBe(true);
    expect(isMinerState({ c: 1, m: 2, t: 3 })).toBe(false); // mockup's old shape
    expect(isMinerState(null)).toBe(false);
  });
});
