import { describe, it, expect } from "vitest";
import {
  createBoard,
  placeMines,
  reveal,
  toggleFlag,
  neighbors,
  DIFFICULTIES,
} from "../games/minesweeper/logic";

// deterministic LCG so specs are reproducible
const lcg = (seed: number): (() => number) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
};

describe("minesweeper logic", () => {
  it("neighbors clips at edges and corners", () => {
    expect(neighbors(9, 9, 0)).toHaveLength(3);
    expect(neighbors(9, 9, 4)).toHaveLength(5);
    expect(neighbors(9, 9, 40)).toHaveLength(8);
  });

  it("first click is never a mine (nor its neighbors), across many seeds", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const b = createBoard(9, 9, 10);
      const safe = 40; // center
      reveal(b, safe, lcg(seed));
      expect(b.phase).not.toBe("lost");
      expect(b.cells[safe]?.mine).toBe(false);
      for (const n of neighbors(9, 9, safe)) expect(b.cells[n]?.mine).toBe(false);
      expect(b.cells.filter((c) => c.mine)).toHaveLength(10);
    }
  });

  it("dense boards still keep the clicked cell safe", () => {
    const b = createBoard(3, 3, 8); // only one free cell possible
    reveal(b, 4, lcg(7));
    expect(b.cells[4]?.mine).toBe(false);
    expect(b.cells.filter((c) => c.mine)).toHaveLength(8);
  });

  it("adjacency counts are consistent with placed mines", () => {
    const b = createBoard(9, 9, 10);
    placeMines(b, 40, lcg(3));
    for (let i = 0; i < b.cells.length; i++) {
      const expected = neighbors(9, 9, i).filter((n) => b.cells[n]?.mine).length;
      expect(b.cells[i]?.adj).toBe(expected);
    }
  });

  it("zero-adjacency reveal floods, and flood stops at numbered cells", () => {
    // hand-built 5x5: single mine in the corner
    const b = createBoard(5, 5, 1);
    b.phase = "playing";
    const corner = b.cells[0];
    if (corner) corner.mine = true;
    for (let i = 0; i < 25; i++) {
      const c = b.cells[i];
      if (c) c.adj = neighbors(5, 5, i).filter((n) => b.cells[n]?.mine).length;
    }
    reveal(b, 24, lcg(1)); // far corner — floods everything except the mine
    expect(b.cells[0]?.revealed).toBe(false);
    expect(b.revealed).toBe(24);
    expect(b.phase).toBe("won");
  });

  it("revealing a mine loses and shows all mines", () => {
    const b = createBoard(9, 9, 10);
    reveal(b, 40, lcg(9));
    const mineIdx = b.cells.findIndex((c) => c.mine);
    reveal(b, mineIdx, lcg(9));
    expect(b.phase).toBe("lost");
    expect(b.cells.filter((c) => c.mine && !c.revealed)).toHaveLength(0);
  });

  it("flags block reveal and toggle the counter; win auto-flags mines", () => {
    const b = createBoard(5, 5, 1);
    b.phase = "playing";
    const corner = b.cells[0];
    if (corner) corner.mine = true;
    for (let i = 0; i < 25; i++) {
      const c = b.cells[i];
      if (c) c.adj = neighbors(5, 5, i).filter((n) => b.cells[n]?.mine).length;
    }
    toggleFlag(b, 12);
    expect(b.flags).toBe(1);
    reveal(b, 12, lcg(1));
    expect(b.cells[12]?.revealed).toBe(false);
    toggleFlag(b, 12);
    expect(b.flags).toBe(0);
    reveal(b, 24, lcg(1));
    expect(b.phase).toBe("won");
    expect(b.cells[0]?.flagged).toBe(true);
  });

  it("standard difficulties are sane", () => {
    for (const d of DIFFICULTIES) {
      expect(d.mines).toBeLessThan(d.cols * d.rows);
    }
    expect(DIFFICULTIES.map((d) => d.name)).toEqual([
      "beginner",
      "intermediate",
      "expert",
    ]);
  });
});
