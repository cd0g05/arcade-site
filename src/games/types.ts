/**
 * types.ts — shared shapes for hub game mounts and cabinet game modules.
 */
import type { Cartridge } from "../lib/cartridge";
import type { CabinetOptions } from "../ui/cabinet";
import type { GameCard } from "../ui/card";

export interface MountedGame {
  api: Cartridge;
  /** Reset-save-data hook: zero persisted + visible state (no reload). */
  onReset(): void;
}

/**
 * A cabinet game module exports `def: CabinetDef`; cabinet-entry.ts renders
 * the shared scaffold from `options`, mounts the game, and registers it.
 */
export interface CabinetDef {
  options: CabinetOptions;
  mount(card: GameCard): Cartridge;
}
