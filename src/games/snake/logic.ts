/**
 * snake/logic.ts — pure Snake rules. No DOM, no storage; rand is injected.
 * State is mutated in place by step() (single owner: the cartridge).
 */

export type Dir = "up" | "down" | "left" | "right";

export interface Cell {
  x: number;
  y: number;
}

export type Rand = () => number;

export interface SnakeState {
  cols: number;
  rows: number;
  /** Head first. */
  snake: Cell[];
  dir: Dir;
  food: Cell;
  alive: boolean;
  /** Foods eaten. */
  score: number;
  /** Pending growth segments (tail holds still while > 0). */
  grow: number;
}

export const DELTA: Record<Dir, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Dir, Dir> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

/** Segments gained per food. */
export const GROW_PER_FOOD = 2;

const onSnake = (snake: Cell[], c: Cell): boolean =>
  snake.some((s) => s.x === c.x && s.y === c.y);

/** Random free cell (uniform over cells not covered by the snake). */
export function placeFood(cols: number, rows: number, snake: Cell[], rand: Rand): Cell {
  const free: Cell[] = [];
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      const c = { x, y };
      if (!onSnake(snake, c)) free.push(c);
    }
  const pick = free[Math.floor(rand() * free.length)];
  return pick ?? { x: 0, y: 0 }; // board full — unreachable in practice
}

/** New game: 3-long snake heading right from the center. */
export function fresh(cols: number, rows: number, rand: Rand): SnakeState {
  const y = Math.floor(rows / 2);
  const x = Math.floor(cols / 2);
  const snake: Cell[] = [
    { x, y },
    { x: x - 1, y },
    { x: x - 2, y },
  ];
  return {
    cols,
    rows,
    snake,
    dir: "right",
    food: placeFood(cols, rows, snake, rand),
    alive: true,
    score: 0,
    grow: 0,
  };
}

/** A turn is legal unless it reverses the committed direction. */
export function legalTurn(current: Dir, next: Dir): boolean {
  return next !== current && next !== OPPOSITE[current];
}

/**
 * Advance one cell in state.dir. Handles wall/self collision (alive=false),
 * eating (score, growth, food respawn via rand), and tail movement — moving
 * into the cell the tail is vacating this tick is legal.
 */
export function step(state: SnakeState, rand: Rand): void {
  if (!state.alive) return;
  const head = state.snake[0];
  if (!head) return;
  const d = DELTA[state.dir];
  const nx = head.x + d.x;
  const ny = head.y + d.y;

  if (nx < 0 || ny < 0 || nx >= state.cols || ny >= state.rows) {
    state.alive = false;
    return;
  }

  const eats = nx === state.food.x && ny === state.food.y;
  const tailMoves = !eats && state.grow === 0;
  // body cells the head may not enter — the vacating tail cell is exempt
  const blocking = tailMoves ? state.snake.slice(0, -1) : state.snake;
  if (onSnake(blocking, { x: nx, y: ny })) {
    state.alive = false;
    return;
  }

  state.snake.unshift({ x: nx, y: ny });
  if (eats) {
    state.score++;
    state.grow += GROW_PER_FOOD;
    state.food = placeFood(state.cols, state.rows, state.snake, rand);
  } else if (state.grow > 0) {
    state.grow--;
  } else {
    state.snake.pop();
  }
}
