/**
 * logic.ts — pure 2048 rules (no DOM, no storage). Unit-tested.
 *
 * Boards are flat 16-cell arrays, row-major, 0 = empty. All functions
 * return new arrays; callers own persistence and rendering.
 */

export type Board = number[];
export type Dir = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";

/** WASD → arrow-key aliases (both cases). */
export const ALIAS: Readonly<Record<string, Dir>> = {
  w: "ArrowUp",
  a: "ArrowLeft",
  s: "ArrowDown",
  d: "ArrowRight",
  W: "ArrowUp",
  A: "ArrowLeft",
  S: "ArrowDown",
  D: "ArrowRight",
};

/** Cell-index traversal order per direction (first index = slide target). */
export const LINES: Readonly<Record<Dir, readonly (readonly number[])[]>> = {
  ArrowLeft: [
    [0, 1, 2, 3],
    [4, 5, 6, 7],
    [8, 9, 10, 11],
    [12, 13, 14, 15],
  ],
  ArrowRight: [
    [3, 2, 1, 0],
    [7, 6, 5, 4],
    [11, 10, 9, 8],
    [15, 14, 13, 12],
  ],
  ArrowUp: [
    [0, 4, 8, 12],
    [1, 5, 9, 13],
    [2, 6, 10, 14],
    [3, 7, 11, 15],
  ],
  ArrowDown: [
    [12, 8, 4, 0],
    [13, 9, 5, 1],
    [14, 10, 6, 2],
    [15, 11, 7, 3],
  ],
};

export interface SlideResult {
  row: number[];
  /** Per-output-cell: was this cell produced by a merge this slide? */
  mg: boolean[];
  gained: number;
  moved: boolean;
}

/** Slide one 4-cell line toward index 0, merging equal neighbors once. */
export function slideRow(r: readonly number[]): SlideResult {
  const a = r.filter((v) => v);
  const out: number[] = [];
  const mg: boolean[] = [];
  let gained = 0;
  for (let i = 0; i < a.length; i++) {
    const cur = a[i] as number;
    if (i + 1 < a.length && cur === a[i + 1]) {
      out.push(cur * 2);
      mg.push(true);
      gained += cur * 2;
      i++;
    } else {
      out.push(cur);
      mg.push(false);
    }
  }
  while (out.length < 4) {
    out.push(0);
    mg.push(false);
  }
  return { row: out, mg, gained, moved: out.some((v, j) => v !== r[j]) };
}

export interface MoveResult {
  board: Board;
  gained: number;
  moved: boolean;
  /** Board indices of cells produced by merges (for the pop animation). */
  merged: Set<number>;
}

/** Apply a directional move. Returns null for keys that aren't a direction. */
export function applyMove(b: readonly number[], key: string): MoveResult | null {
  const dir = ALIAS[key] ?? (key as Dir);
  const lines = LINES[dir];
  if (!lines) return null;
  const board = [...b];
  const merged = new Set<number>();
  let moved = false;
  let gained = 0;
  for (const idxs of lines) {
    const res = slideRow(idxs.map((i) => board[i] as number));
    if (res.moved) moved = true;
    gained += res.gained;
    idxs.forEach((bi, j) => {
      board[bi] = res.row[j] as number;
      if (res.mg[j]) merged.add(bi);
    });
  }
  return { board, gained, moved, merged };
}

/** Spawn a 2 (90%) or 4 (10%) in a random empty cell. New array; no-op when full. */
export function addTile(b: readonly number[], rand: () => number = Math.random): Board {
  const board = [...b];
  const empty = board.map((v, i) => (v ? -1 : i)).filter((i) => i >= 0);
  if (empty.length) {
    board[empty[Math.floor(rand() * empty.length)] as number] = rand() < 0.9 ? 2 : 4;
  }
  return board;
}

/** A fresh board with two spawned tiles. */
export function fresh(rand: () => number = Math.random): Board {
  return addTile(addTile(Array(16).fill(0), rand), rand);
}

/** No empty cells and no equal orthogonal neighbors. */
export function isOver(b: readonly number[]): boolean {
  if (b.includes(0)) return false;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const v = b[r * 4 + c];
      if (c < 3 && b[r * 4 + c + 1] === v) return false;
      if (r < 3 && b[(r + 1) * 4 + c] === v) return false;
    }
  }
  return true;
}

/** Persisted shape validator for `arcade:2048:state`. */
export function isSavedState(v: unknown): v is { b: Board; s: number } {
  if (typeof v !== "object" || v === null) return false;
  const o = v as { b?: unknown; s?: unknown };
  return (
    Array.isArray(o.b) &&
    o.b.length === 16 &&
    o.b.every((n) => typeof n === "number") &&
    typeof o.s === "number"
  );
}
