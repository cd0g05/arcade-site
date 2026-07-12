import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { store } from "../lib/storage";

/** Minimal in-memory localStorage stand-in (node has no DOM storage). */
function makeStorageStub() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    _map: map,
  };
}

let stub: ReturnType<typeof makeStorageStub>;

beforeEach(() => {
  stub = makeStorageStub();
  vi.stubGlobal("localStorage", stub);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("store.get / store.set", () => {
  it("round-trips JSON values under the arcade: prefix", () => {
    store.set("best:dino", 1234);
    expect(stub._map.get("arcade:best:dino")).toBe("1234");
    expect(store.get("best:dino", 0)).toBe(1234);

    store.set("2048:state", { b: [1, 2], s: 3 });
    expect(store.get("2048:state", null)).toEqual({ b: [1, 2], s: 3 });
  });

  it("returns the fallback for missing keys", () => {
    expect(store.get("nope", "fb")).toBe("fb");
    expect(store.get("nope", 42)).toBe(42);
  });

  it("returns the fallback on corrupt JSON instead of throwing", () => {
    stub.setItem("arcade:best:dino", "{not json!!!");
    expect(store.get("best:dino", 0)).toBe(0);
    stub.setItem("arcade:2048:state", '{"b": [1,'); // truncated write
    expect(store.get("2048:state", null)).toBeNull();
  });

  it("returns the fallback when the shape validator rejects", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    stub.setItem("arcade:2048:state", '{"b": "corrupted", "s": 1}');
    const isBoard = (v: unknown): v is { b: number[]; s: number } =>
      typeof v === "object" &&
      v !== null &&
      Array.isArray((v as { b?: unknown }).b);
    expect(store.get("2048:state", null, isBoard)).toBeNull();
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it("returns the fallback when localStorage itself throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("SecurityError");
      },
    });
    expect(store.get("best:dino", 7)).toBe(7);
  });

  it("swallows write failures (quota exceeded)", () => {
    vi.stubGlobal("localStorage", {
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    });
    expect(() => store.set("best:dino", 1)).not.toThrow();
  });
});

describe("store.clearAll", () => {
  it("removes every arcade:* key and nothing else", () => {
    store.set("best:dino", 100);
    store.set("2048:state", { b: [], s: 0 });
    store.set("sound", false);
    stub.setItem("someone-elses-key", "keep me");
    stub.setItem("arcadia", "keep me too"); // not the arcade: prefix

    store.clearAll();

    expect(store.get("best:dino", -1)).toBe(-1);
    expect(store.get("2048:state", null)).toBeNull();
    expect(store.get("sound", true)).toBe(true);
    expect(stub.getItem("someone-elses-key")).toBe("keep me");
    expect(stub.getItem("arcadia")).toBe("keep me too");
    expect(stub.length).toBe(2);
  });
});

describe("store.remove", () => {
  it("removes a single arcade key", () => {
    store.set("credits", 3);
    store.remove("credits");
    expect(store.get("credits", 0)).toBe(0);
  });
});
