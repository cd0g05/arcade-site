/**
 * minesweeper/logic.ts — pure Minesweeper rules. No DOM, no storage;
 * rand is injected. Mines are placed on the FIRST reveal, excluding the
 * clicked cell and its neighbors (first-click-safe), so the opening click
 * always floods at least one cell.
 */

export type Rand = () => number;

export interface MsCell {
  mine: boolean;
  revealed: boolean;
  flagged: boolean;
  /** Adjacent mine count (valid once mines are placed). */
  adj: number;
}

export type MsPhase = "fresh" | "playing" | "won" | "lost";

export interface MsBoard {
  cols: number;
  rows: number;
  mines: number;
  cells: MsCell[];
  phase: MsPhase;
  revealed: number;
  flags: number;
}

export interface Difficulty {
  name: string;
  cols: number;
  rows: number;
  mines: number;
}

export const DIFFICULTIES: readonly Difficulty[] = [
  { name: "beginner", cols: 9, rows: 9, mines: 10 },
  { name: "intermediate", cols: 16, rows: 16, mines: 40 },
  { name: "expert", cols: 30, rows: 16, mines: 99 },
];

export function createBoard(cols: number, rows: number, mines: number): MsBoard {
  return {
    cols,
    rows,
    mines,
    cells: Array.from({ length: cols * rows }, () => ({
      mine: false,
      revealed: false,
      flagged: false,
      adj: 0,
    })),
    phase: "fresh",
    revealed: 0,
    flags: 0,
  };
}

export function neighbors(cols: number, rows: number, i: number): number[] {
  const x = i % cols;
  const y = Math.floor(i / cols);
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < cols && ny < rows) out.push(ny * cols + nx);
    }
  return out;
}

/**
 * Place mines everywhere except `safe` and its neighbors (shrinking the
 * exclusion to just `safe` if the board is too dense for the full halo).
 */
export function placeMines(board: MsBoard, safe: number, rand: Rand): void {
  const halo = new Set([safe, ...neighbors(board.cols, board.rows, safe)]);
  let candidates: number[] = [];
  for (let i = 0; i < board.cells.length; i++) if (!halo.has(i)) candidates.push(i);
  if (candidates.length < board.mines) {
    candidates = [];
    for (let i = 0; i < board.cells.length; i++) if (i !== safe) candidates.push(i);
  }
  // Fisher-Yates partial shuffle, take the first `mines`
  for (let i = 0; i < board.mines; i++) {
    const j = i + Math.floor(rand() * (candidates.length - i));
    const a = candidates[i];
    const b = candidates[j];
    if (a === undefined || b === undefined) break;
    candidates[i] = b;
    candidates[j] = a;
    const cell = board.cells[b];
    if (cell) cell.mine = true;
  }
  for (let i = 0; i < board.cells.length; i++) {
    const cell = board.cells[i];
    if (!cell) continue;
    cell.adj = neighbors(board.cols, board.rows, i).filter(
      (n) => board.cells[n]?.mine,
    ).length;
  }
}

function revealOne(board: MsBoard, i: number): void {
  const cell = board.cells[i];
  if (!cell || cell.revealed || cell.flagged) return;
  cell.revealed = true;
  board.revealed++;
}

/**
 * Reveal a cell. First reveal places mines (first-click-safe). Mines lose
 * (all mines shown); zero-adjacency cells flood-reveal; revealing the last
 * safe cell wins.
 */
export function reveal(board: MsBoard, i: number, rand: Rand): void {
  const cell = board.cells[i];
  if (!cell || board.phase === "won" || board.phase === "lost") return;
  if (cell.flagged || cell.revealed) return;

  if (board.phase === "fresh") {
    placeMines(board, i, rand);
    board.phase = "playing";
  }

  if (cell.mine) {
    board.phase = "lost";
    for (const c of board.cells) if (c.mine) c.revealed = true;
    return;
  }

  // flood reveal (iterative BFS through zero-adj cells)
  const queue = [i];
  while (queue.length > 0) {
    const cur = queue.pop();
    if (cur === undefined) break;
    const c = board.cells[cur];
    if (!c || c.revealed || c.flagged) continue;
    revealOne(board, cur);
    if (c.adj === 0)
      for (const n of neighbors(board.cols, board.rows, cur)) {
        const nc = board.cells[n];
        if (nc && !nc.revealed && !nc.mine) queue.push(n);
      }
  }

  if (board.revealed === board.cells.length - board.mines) {
    board.phase = "won";
    for (const c of board.cells) if (c.mine) c.flagged = true;
    board.flags = board.mines;
  }
}

/** Toggle a flag on an unrevealed cell. */
export function toggleFlag(board: MsBoard, i: number): void {
  const cell = board.cells[i];
  if (!cell || cell.revealed || board.phase === "won" || board.phase === "lost") return;
  cell.flagged = !cell.flagged;
  board.flags += cell.flagged ? 1 : -1;
}
