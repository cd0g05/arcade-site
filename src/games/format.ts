/**
 * format.ts — shared score-readout formatters (mockup conventions).
 */

/** Zero-padded integer readout, e.g. pad(42) → "0042". */
export const pad = (n: number, w = 4): string => String(Math.floor(n)).padStart(w, "0");

/** Thousands-separated integer readout, e.g. fmt(12345) → "12,345". */
export const fmt = (n: number): string => Math.floor(n).toLocaleString("en-US");
