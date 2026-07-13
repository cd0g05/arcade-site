import { describe, expect, it } from "vitest";
import { CELLS, generate, isSolved, press, SIZE } from "../games/lightsout/logic";

const litCount = (b: readonly boolean[]): number => b.filter(Boolean).length;

describe("lights out press", () => {
  const dark = Array<boolean>(CELLS).fill(false);

  it("toggles a plus-shape at the center", () => {
    const b = press(dark, 12); // center of 5×5
    expect(litCount(b)).toBe(5);
    expect(b[12] && b[7] && b[17] && b[11] && b[13]).toBe(true);
  });

  it("clips the plus at corners and edges", () => {
    expect(litCount(press(dark, 0))).toBe(3); // corner
    expect(litCount(press(dark, 2))).toBe(4); // top edge
  });

  it("is its own inverse", () => {
    expect(press(press(dark, 7), 7)).toEqual(dark);
  });

  it("does not mutate the input", () => {
    const copy = [...dark];
    press(dark, 12);
    expect(dark).toEqual(copy);
  });
});

describe("lights out generation", () => {
  it("never deals an already-solved board", () => {
    for (let seed = 0; seed < 50; seed++) {
      const { board } = generate(8);
      expect(isSolved(board)).toBe(false);
    }
  });

  it("every generated board is solvable by replaying its presses", () => {
    for (let run = 0; run < 50; run++) {
      const { board, presses } = generate(8);
      let b = board;
      for (const i of presses) b = press(b, i);
      expect(isSolved(b)).toBe(true);
    }
  });

  it("supports an injectable rand for determinism", () => {
    const seq = [0.1, 0.5, 0.9, 0.3];
    let n = 0;
    const rand = (): number => seq[n++ % seq.length] as number;
    const a = generate(4, rand);
    n = 0;
    const b = generate(4, rand);
    expect(a.board).toEqual(b.board);
    expect(a.presses).toEqual(b.presses);
  });

  it("uses a 5×5 board", () => {
    expect(SIZE).toBe(5);
    expect(generate().board).toHaveLength(25);
  });
});
