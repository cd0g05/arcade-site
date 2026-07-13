/**
 * scoreboard.ts — live high-scores panel updater.
 *
 * Generic over rows: the page supplies { cellId → reader } so this module
 * stays free of game knowledge. refresh() re-reads every value; the page
 * calls it on load, on an interval, and after a reset.
 */

export type ScoreboardRows = Readonly<Record<string, () => string>>;

export interface Scoreboard {
  refresh(): void;
}

export function createScoreboard(rows: ScoreboardRows): Scoreboard {
  return {
    refresh() {
      for (const [id, read] of Object.entries(rows)) {
        const cell = document.getElementById(id);
        if (cell) cell.textContent = read();
      }
    },
  };
}
