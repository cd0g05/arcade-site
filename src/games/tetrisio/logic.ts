/**
 * tetrisio/logic.ts — pure Tetrisio rules (7 pieces, rotation with basic
 * kicks, collision, line clears, scoring/levels, 7-bag randomizer).
 * Timeboxed to "standard-feeling" per tech-design risk — kicks are a
 * simple offset list, not full guideline SRS.
 */

export type Rand = () => number;

export const COLS = 10;
export const ROWS = 20;

export type PieceType = "I" | "O" | "T" | "S" | "Z" | "J" | "L";
export const PIECE_TYPES: readonly PieceType[] = ["I", "O", "T", "S", "Z", "J", "L"];

/** null = empty, otherwise a canvas fill color. */
export type Cell = string | null;
export type Board = Cell[];

export const PIECE_COLORS: Record<PieceType, string> = {
  I: "#047857",
  O: "#be185d",
  T: "#18181b",
  S: "#f472b6",
  Z: "#9d174d",
  J: "#52525b",
  L: "#db2777",
};

/** Base shapes on a small grid, spawn orientation. */
const BASE: Record<PieceType, [number, number][]> = {
  I: [[0, 1], [1, 1], [2, 1], [3, 1]],
  O: [[1, 0], [2, 0], [1, 1], [2, 1]],
  T: [[1, 0], [0, 1], [1, 1], [2, 1]],
  S: [[1, 0], [2, 0], [0, 1], [1, 1]],
  Z: [[0, 0], [1, 0], [1, 1], [2, 1]],
  J: [[0, 0], [0, 1], [1, 1], [2, 1]],
  L: [[2, 0], [0, 1], [1, 1], [2, 1]],
};

/** Grid size each piece rotates within (I uses 4, O is symmetric, rest 3). */
const BOX: Record<PieceType, number> = { I: 4, O: 4, T: 3, S: 3, Z: 3, J: 3, L: 3 };

/** BLOCKS[type][rot] = cell offsets after `rot` clockwise quarter-turns. */
export const BLOCKS: Record<PieceType, [number, number][][]> = (() => {
  const out = {} as Record<PieceType, [number, number][][]>;
  for (const t of PIECE_TYPES) {
    const n = BOX[t] - 1;
    const rots: [number, number][][] = [BASE[t]];
    for (let r = 1; r < 4; r++) {
      const prev = rots[r - 1] ?? [];
      rots.push(prev.map(([x, y]): [number, number] => [n - y, x]));
    }
    out[t] = rots;
  }
  return out;
})();

export interface Piece {
  type: PieceType;
  rot: number;
  x: number;
  y: number;
}

export const emptyBoard = (): Board => Array<Cell>(COLS * ROWS).fill(null);

export function cellsOf(p: Piece): [number, number][] {
  const blocks = BLOCKS[p.type][p.rot % 4] ?? [];
  return blocks.map(([bx, by]): [number, number] => [p.x + bx, p.y + by]);
}

/** Out of the well (sides/floor) or overlapping a filled cell. y<0 is open. */
export function collides(board: Board, p: Piece): boolean {
  for (const [x, y] of cellsOf(p)) {
    if (x < 0 || x >= COLS || y >= ROWS) return true;
    if (y >= 0 && board[y * COLS + x] !== null) return true;
  }
  return false;
}

export function tryMove(board: Board, p: Piece, dx: number, dy: number): Piece | null {
  const next = { ...p, x: p.x + dx, y: p.y + dy };
  return collides(board, next) ? null : next;
}

/** Basic kick table: in place, then left/right 1, up 1, left/right 2. */
const KICKS: [number, number][] = [[0, 0], [-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0]];

export function tryRotate(board: Board, p: Piece, dir: 1 | -1): Piece | null {
  if (p.type === "O") return p; // O never changes
  const rot = (p.rot + (dir === 1 ? 1 : 3)) % 4;
  for (const [kx, ky] of KICKS) {
    const next = { ...p, rot, x: p.x + kx, y: p.y + ky };
    if (!collides(board, next)) return next;
  }
  return null;
}

export function spawn(type: PieceType): Piece {
  return { type, rot: 0, x: 3, y: type === "I" ? -1 : 0 };
}

/** Lock a piece into a new board (cells above the top are dropped). */
export function lock(board: Board, p: Piece): Board {
  const next = [...board];
  for (const [x, y] of cellsOf(p)) {
    if (y >= 0) next[y * COLS + x] = PIECE_COLORS[p.type];
  }
  return next;
}

export function clearLines(board: Board): { board: Board; cleared: number } {
  const rows: Cell[][] = [];
  for (let y = 0; y < ROWS; y++) {
    const row = board.slice(y * COLS, (y + 1) * COLS);
    if (!row.every((c) => c !== null)) rows.push(row);
  }
  const cleared = ROWS - rows.length;
  while (rows.length < ROWS) rows.unshift(Array<Cell>(COLS).fill(null));
  return { board: rows.flat(), cleared };
}

/** Guideline-style clear scores, scaled by level. */
const SCORE_TABLE = [0, 100, 300, 500, 800] as const;

export function scoreFor(cleared: number, level: number): number {
  return (SCORE_TABLE[cleared] ?? 0) * (level + 1);
}

export const levelFor = (lines: number): number => Math.floor(lines / 10);

/** Gravity interval per level — 800ms shrinking ~20%/level, floor 70ms. */
export const gravityMs = (level: number): number =>
  Math.max(70, Math.round(800 * 0.8 ** level));

/** Where the piece lands if hard-dropped. */
export function dropY(board: Board, p: Piece): number {
  let y = p.y;
  while (!collides(board, { ...p, y: y + 1 })) y++;
  return y;
}

/** 7-bag randomizer: every run of 7 pieces contains each type once. */
export function createBag(rand: Rand): () => PieceType {
  let bag: PieceType[] = [];
  return () => {
    if (bag.length === 0) {
      bag = [...PIECE_TYPES];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        const a = bag[i];
        const b = bag[j];
        if (a !== undefined && b !== undefined) {
          bag[i] = b;
          bag[j] = a;
        }
      }
    }
    return bag.pop() ?? "T";
  };
}
