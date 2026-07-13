import { describe, it, expect } from "vitest";
import {
  fresh,
  step,
  legalTurn,
  placeFood,
  GROW_PER_FOOD,
  type SnakeState,
} from "../games/snake/logic";

const rand0 = (): number => 0;

const mkState = (over: Partial<SnakeState>): SnakeState => ({
  cols: 8,
  rows: 8,
  snake: [
    { x: 4, y: 4 },
    { x: 3, y: 4 },
    { x: 2, y: 4 },
  ],
  dir: "right",
  food: { x: 0, y: 0 },
  alive: true,
  score: 0,
  grow: 0,
  ...over,
});

describe("snake logic", () => {
  it("fresh: 3-long snake heading right, food off the snake", () => {
    const s = fresh(24, 16, Math.random);
    expect(s.snake).toHaveLength(3);
    expect(s.dir).toBe("right");
    expect(s.alive).toBe(true);
    expect(s.snake.some((c) => c.x === s.food.x && c.y === s.food.y)).toBe(false);
  });

  it("legalTurn rejects reversals and no-ops, allows perpendicular", () => {
    expect(legalTurn("right", "left")).toBe(false);
    expect(legalTurn("right", "right")).toBe(false);
    expect(legalTurn("right", "up")).toBe(true);
    expect(legalTurn("up", "down")).toBe(false);
    expect(legalTurn("up", "left")).toBe(true);
  });

  it("step moves the head one cell without growing", () => {
    const s = mkState({});
    step(s, rand0);
    expect(s.snake[0]).toEqual({ x: 5, y: 4 });
    expect(s.snake).toHaveLength(3);
    expect(s.alive).toBe(true);
  });

  it("eating scores, schedules growth, and respawns food off the snake", () => {
    const s = mkState({ food: { x: 5, y: 4 } });
    step(s, rand0);
    expect(s.score).toBe(1);
    expect(s.grow).toBe(GROW_PER_FOOD);
    expect(s.snake).toHaveLength(4); // head added, tail held
    expect(s.snake.some((c) => c.x === s.food.x && c.y === s.food.y)).toBe(false);
    // growth drains over the next steps: 3 start + 1 head + GROW_PER_FOOD
    step(s, rand0);
    expect(s.snake).toHaveLength(5);
    step(s, rand0);
    expect(s.snake).toHaveLength(6);
    expect(s.grow).toBe(0);
  });

  it("hitting a wall kills", () => {
    const s = mkState({ snake: [{ x: 7, y: 4 }], dir: "right" });
    step(s, rand0);
    expect(s.alive).toBe(false);
  });

  it("hitting the body kills", () => {
    // U-shape: head at (4,4) turning up into its own body at (4,3)
    const s = mkState({
      snake: [
        { x: 4, y: 4 },
        { x: 3, y: 4 },
        { x: 3, y: 3 },
        { x: 4, y: 3 },
        { x: 5, y: 3 },
      ],
      dir: "up",
      grow: 1, // tail not moving this tick
    });
    step(s, rand0);
    expect(s.alive).toBe(false);
  });

  it("moving into the cell the tail is vacating is legal", () => {
    // 2x2 loop: head may enter the tail cell because it moves away this tick
    const s = mkState({
      snake: [
        { x: 4, y: 4 },
        { x: 5, y: 4 },
        { x: 5, y: 5 },
        { x: 4, y: 5 },
      ],
      dir: "down",
    });
    step(s, rand0);
    expect(s.alive).toBe(true);
    expect(s.snake[0]).toEqual({ x: 4, y: 5 });
  });

  it("dead snakes don't move", () => {
    const s = mkState({ alive: false });
    const before = JSON.stringify(s.snake);
    step(s, rand0);
    expect(JSON.stringify(s.snake)).toBe(before);
  });

  it("placeFood never lands on the snake", () => {
    const snake = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ];
    for (let i = 0; i < 20; i++) {
      const f = placeFood(2, 2, snake, () => i / 20);
      expect(f).toEqual({ x: 1, y: 1 }); // only free cell on a 2x2
    }
  });
});
