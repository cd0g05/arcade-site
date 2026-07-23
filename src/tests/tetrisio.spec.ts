import { describe, it, expect } from "vitest";
import {
  COLS,
  ROWS,
  PIECE_TYPES,
  emptyBoard,
  cellsOf,
  collides,
  tryMove,
  tryRotate,
  spawn,
  lock,
  clearLines,
  scoreFor,
  levelFor,
  gravityMs,
  dropY,
  createBag,
  PIECE_COLORS,
  type Board,
  type Piece,
} from "../games/tetrisio/logic";

const lcg = (seed: number): (() => number) => {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
};

const sortCells = (cells: [number, number][]): string =>
  cells
    .map(([x, y]) => `${x},${y}`)
    .sort()
    .join(" ");

describe("tetrisio logic", () => {
  it("every piece has 4 blocks in all 4 rotations", () => {
    for (const t of PIECE_TYPES)
      for (let rot = 0; rot < 4; rot++) {
        const p: Piece = { type: t, rot, x: 4, y: 5 };
        expect(cellsOf(p)).toHaveLength(4);
      }
  });

  it("four clockwise rotations return to the original cells", () => {
    const board = emptyBoard();
    for (const t of PIECE_TYPES) {
      let p: Piece = { type: t, rot: 0, x: 4, y: 5 };
      const original = sortCells(cellsOf(p));
      for (let i = 0; i < 4; i++) {
        const r = tryRotate(board, p, 1);
        expect(r).not.toBeNull();
        if (r) p = r;
      }
      // kicks may shift x/y; undo any net drift before comparing
      expect(p.rot % 4).toBe(0);
      const drifted = cellsOf(p).map(([x, y]): [number, number] => [x, y]);
      // with no obstacles no kick should have fired at center
      expect(sortCells(drifted)).toBe(original);
    }
  });

  it("rotation against the wall kicks inward instead of failing", () => {
    const board = emptyBoard();
    // vertical I hugging the left wall
    let p: Piece = { type: "I", rot: 1, x: -2, y: 5 };
    expect(collides(board, p)).toBe(false);
    const r = tryRotate(board, p, 1);
    expect(r).not.toBeNull();
    if (r) p = r;
    expect(collides(board, p)).toBe(false);
  });

  it("collision detects walls, floor, and filled cells; y<0 is open air", () => {
    const board = emptyBoard();
    expect(collides(board, { type: "O", rot: 0, x: -2, y: 0 })).toBe(true);
    // O occupies offsets 1-2, so x = COLS-2 pushes a block to column COLS
    expect(collides(board, { type: "O", rot: 0, x: COLS - 2, y: 0 })).toBe(true);
    expect(collides(board, { type: "O", rot: 0, x: COLS - 3, y: 0 })).toBe(false);
    expect(collides(board, { type: "O", rot: 0, x: 3, y: ROWS - 1 })).toBe(true);
    expect(collides(board, { type: "O", rot: 0, x: 3, y: -1 })).toBe(false);
    const filled: Board = [...board];
    filled[5 * COLS + 4] = "#000";
    expect(collides(filled, { type: "O", rot: 0, x: 3, y: 4 })).toBe(true);
  });

  it("tryMove slides until blocked", () => {
    const board = emptyBoard();
    const p = spawn("T");
    expect(tryMove(board, p, -10, 0)).toBeNull();
    const moved = tryMove(board, p, 1, 1);
    expect(moved).toEqual({ ...p, x: p.x + 1, y: p.y + 1 });
  });

  it("lock writes colors and clearLines removes full rows and shifts", () => {
    let board = emptyBoard();
    // fill the bottom row except one cell
    for (let x = 0; x < COLS - 1; x++) board[(ROWS - 1) * COLS + x] = "#000";
    // drop a vertical I into the last column
    const p: Piece = { type: "I", rot: 1, x: COLS - 1 - 2, y: ROWS - 4 };
    const landed = { ...p, y: dropY(board, p) };
    board = lock(board, landed);
    const { board: after, cleared } = clearLines(board);
    expect(cleared).toBe(1);
    // the 3 leftover I cells shifted down one row
    const iColor = PIECE_COLORS["I"];
    expect(after.filter((c) => c === iColor)).toHaveLength(3);
    expect(after[(ROWS - 1) * COLS + (COLS - 1)]).toBe(iColor);
    expect(after.slice(0, COLS).every((c) => c === null)).toBe(true);
  });

  it("scoring scales with level and rewards a quad", () => {
    expect(scoreFor(1, 0)).toBe(100);
    expect(scoreFor(2, 0)).toBe(300);
    expect(scoreFor(3, 1)).toBe(1000);
    expect(scoreFor(4, 0)).toBe(800);
    expect(scoreFor(0, 5)).toBe(0);
  });

  it("levels advance every 10 lines and gravity accelerates with a floor", () => {
    expect(levelFor(0)).toBe(0);
    expect(levelFor(9)).toBe(0);
    expect(levelFor(10)).toBe(1);
    expect(gravityMs(0)).toBe(800);
    expect(gravityMs(1)).toBeLessThan(gravityMs(0));
    expect(gravityMs(30)).toBe(70);
  });

  it("7-bag deals each piece exactly once per bag", () => {
    const next = createBag(lcg(42));
    for (let bag = 0; bag < 3; bag++) {
      const seen = new Set<string>();
      for (let i = 0; i < 7; i++) seen.add(next());
      expect(seen.size).toBe(7);
    }
  });

  it("spawn collision detects game over on a filled board", () => {
    const board = emptyBoard();
    for (let i = 0; i < COLS * 2; i++) board[i] = "#000";
    expect(collides(board, spawn("T"))).toBe(true);
  });
});
