import { describe, expect, it } from "vitest";
import { addTile, applyMove, fresh, isOver, isSavedState, slideRow } from "../games/g2048/logic";

describe("2048 slideRow", () => {
  it("slides tiles toward the head", () => {
    expect(slideRow([0, 2, 0, 4]).row).toEqual([2, 4, 0, 0]);
  });

  it("merges equal neighbors once and scores the merge", () => {
    const r = slideRow([2, 2, 2, 2]);
    expect(r.row).toEqual([4, 4, 0, 0]);
    expect(r.gained).toBe(8);
    expect(r.mg).toEqual([true, true, false, false]);
  });

  it("does not double-merge a freshly merged tile", () => {
    expect(slideRow([4, 2, 2, 0]).row).toEqual([4, 4, 0, 0]);
    expect(slideRow([2, 2, 4, 0]).row).toEqual([4, 4, 0, 0]);
  });

  it("reports moved=false for a settled row", () => {
    const r = slideRow([2, 4, 8, 0]);
    expect(r.moved).toBe(false);
    expect(r.gained).toBe(0);
  });
});

describe("2048 applyMove", () => {
  // prettier-ignore
  const board = [
    2, 0, 0, 2,
    0, 0, 0, 0,
    4, 0, 0, 4,
    0, 0, 0, 0,
  ];

  it("moves left, merging across gaps", () => {
    const res = applyMove(board, "ArrowLeft");
    expect(res).not.toBeNull();
    expect(res?.board.slice(0, 4)).toEqual([4, 0, 0, 0]);
    expect(res?.board.slice(8, 12)).toEqual([8, 0, 0, 0]);
    expect(res?.gained).toBe(12);
    expect(res?.moved).toBe(true);
    expect(res?.merged).toEqual(new Set([0, 8]));
  });

  it("moves right via WASD alias", () => {
    const res = applyMove(board, "d");
    expect(res?.board.slice(0, 4)).toEqual([0, 0, 0, 4]);
  });

  it("returns null for non-directional keys", () => {
    expect(applyMove(board, "x")).toBeNull();
  });

  it("does not mutate the input board", () => {
    const copy = [...board];
    applyMove(board, "ArrowUp");
    expect(board).toEqual(copy);
  });
});

describe("2048 board lifecycle", () => {
  it("fresh boards carry exactly two tiles", () => {
    const b = fresh(() => 0.5);
    expect(b.filter((v) => v > 0)).toHaveLength(2);
  });

  it("addTile spawns a 4 on the 10% roll and skips full boards", () => {
    const one = addTile(Array(16).fill(0), () => 0.95);
    expect(one).toContain(4);
    const full = Array(16).fill(2);
    expect(addTile(full)).toEqual(full);
  });

  it("detects game over only when no merge remains", () => {
    // prettier-ignore
    const stuck = [
      2, 4, 2, 4,
      4, 2, 4, 2,
      2, 4, 2, 4,
      4, 2, 4, 2,
    ];
    expect(isOver(stuck)).toBe(true);
    expect(isOver([...stuck.slice(0, 15), 4])).toBe(false); // bottom-right pair
    expect(isOver([0, ...stuck.slice(1)])).toBe(false); // empty cell
  });

  it("validates persisted state shape", () => {
    expect(isSavedState({ b: Array(16).fill(0), s: 0 })).toBe(true);
    expect(isSavedState({ b: Array(15).fill(0), s: 0 })).toBe(false);
    expect(isSavedState({ b: Array(16).fill("2"), s: 0 })).toBe(false);
    expect(isSavedState(null)).toBe(false);
  });
});
