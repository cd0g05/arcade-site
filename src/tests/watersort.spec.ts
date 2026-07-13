import { describe, it, expect } from "vitest";
import {
  CAP,
  EMPTY_TUBES,
  canPour,
  pour,
  isSolved,
  generate,
  createUndo,
  topSegment,
  type Tube,
} from "../games/watersort/logic";

const lcg = (seed: number): (() => number) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
};

describe("water sort logic", () => {
  it("topSegment reads the top run", () => {
    expect(topSegment([])).toBeNull();
    expect(topSegment(["a", "b", "b"])).toEqual({ color: "b", size: 2 });
    expect(topSegment(["a", "a", "a", "a"])).toEqual({ color: "a", size: 4 });
  });

  it("canPour enforces space and color match", () => {
    expect(canPour([], ["a"])).toBe(false); // empty source
    expect(canPour(["a"], ["b", "b", "b", "b"])).toBe(false); // full dest
    expect(canPour(["a"], ["b"])).toBe(false); // color mismatch
    expect(canPour(["a"], [])).toBe(true); // empty dest
    expect(canPour(["a"], ["a"])).toBe(true); // matching top
  });

  it("pour moves the whole matching segment, capped by space", () => {
    const tubes: Tube[] = [["a", "b", "b", "b"], ["b"], []];
    const next = pour(tubes, 0, 1);
    expect(next).not.toBeNull();
    expect(next?.[0]).toEqual(["a"]); // only 3 fit? space = 3, segment = 3
    expect(next?.[1]).toEqual(["b", "b", "b", "b"]);
    // original untouched (immutability)
    expect(tubes[0]).toEqual(["a", "b", "b", "b"]);
    // illegal pours return null
    expect(pour(tubes, 0, 0)).toBeNull();
    expect(pour(tubes, 2, 0)).toBeNull();
  });

  it("pour into a partly-full tube only moves what fits", () => {
    const tubes: Tube[] = [["b", "b", "b"], ["a", "a", "b"]];
    const next = pour(tubes, 0, 1);
    expect(next?.[0]).toEqual(["b", "b"]);
    expect(next?.[1]).toEqual(["a", "a", "b", "b"]);
  });

  it("isSolved requires full uniform or empty tubes", () => {
    expect(isSolved([["a", "a", "a", "a"], []])).toBe(true);
    expect(isSolved([["a", "a", "a"], []])).toBe(false); // not full
    expect(isSolved([["a", "a", "b", "a"], []])).toBe(false);
  });

  it("generated levels have the right inventory and are not pre-solved", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const { tubes } = generate(4, lcg(seed));
      expect(tubes).toHaveLength(4 + EMPTY_TUBES);
      const counts = new Map<string, number>();
      for (const t of tubes) for (const c of t) counts.set(c, (counts.get(c) ?? 0) + 1);
      expect([...counts.values()]).toEqual([CAP, CAP, CAP, CAP]);
      expect(isSolved(tubes)).toBe(false);
    }
  });

  it("generated levels are solvable by construction (replay the solution)", () => {
    for (let seed = 1; seed <= 25; seed++) {
      const { tubes, solution } = generate(5, lcg(seed));
      let cur: Tube[] = tubes.map((t) => [...t]);
      for (const [i, j] of solution) {
        const next = pour(cur, i, j);
        expect(next).not.toBeNull();
        cur = next ?? cur;
      }
      expect(isSolved(cur)).toBe(true);
    }
  });

  it("undo stack restores deep snapshots", () => {
    const undo = createUndo();
    const tubes: Tube[] = [["a"], []];
    undo.push(tubes);
    tubes[0]?.push("b"); // mutate after snapshot
    const restored = undo.pop();
    expect(restored).toEqual([["a"], []]);
    expect(undo.pop()).toBeNull();
  });
});
