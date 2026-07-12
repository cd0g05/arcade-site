import { describe, expect, it } from "vitest";
import { classifySwipe } from "../lib/input";

describe("classifySwipe — scroll-vs-swipe discrimination core", () => {
  it("returns null below the movement threshold (still a scroll/tap)", () => {
    expect(classifySwipe(0, 0)).toBeNull();
    expect(classifySwipe(10, 4)).toBeNull();
    expect(classifySwipe(-23, 0)).toBeNull();
  });

  it("classifies dominant-axis movement", () => {
    expect(classifySwipe(60, 5)).toBe("right");
    expect(classifySwipe(-60, 5)).toBe("left");
    expect(classifySwipe(3, 48)).toBe("down");
    expect(classifySwipe(3, -48)).toBe("up");
  });

  it("stays ambiguous on diagonals", () => {
    expect(classifySwipe(40, 40)).toBeNull();
    expect(classifySwipe(-35, 33)).toBeNull();
  });
});
