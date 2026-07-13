/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const page = (rel: string): string => fileURLToPath(new URL(rel, import.meta.url));

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        hub: page("index.html"),
        demo: page("demo/index.html"),
        "style-guide": page("style-guide/index.html"),
        snake: page("games/snake/index.html"),
        minesweeper: page("games/minesweeper/index.html"),
        bricks: page("games/bricks/index.html"),
        aim: page("games/aim/index.html"),
        "water-sort": page("games/water-sort/index.html"),
        tetrisio: page("games/tetrisio/index.html"),
      },
    },
  },
  test: {
    include: ["src/tests/**/*.spec.ts"],
    environment: "node",
  },
});
