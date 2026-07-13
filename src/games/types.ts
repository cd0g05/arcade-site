/**
 * types.ts — shared shape for hub game mounts.
 */
import type { Cartridge } from "../lib/cartridge";

export interface MountedGame {
  api: Cartridge;
  /** Reset-save-data hook: zero persisted + visible state (no reload). */
  onReset(): void;
}
