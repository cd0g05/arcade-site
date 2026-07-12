/**
 * cartridge.ts — the contract every game implements (interface only).
 *
 * Games register with the Hub and touch nothing outside their own
 * card/canvas. They must NOT attach document-level listeners — keys arrive
 * exclusively through onKey (ADR-2).
 */

export interface Cartridge {
  /** Keys this game claims while awake (matched against KeyboardEvent.key). */
  keys?: string[];
  /** Receive one claimed key. Only called while this game is awake. */
  onKey?(key: string): void;
  /**
   * Idle games (e.g. the token miner): exempt from wake/sleep arbitration,
   * started once at registration, never veiled, never receive keys.
   */
  alwaysOn?: boolean;
  /** Called on wake (or once at registration if alwaysOn). */
  start(): void;
  /**
   * Called on sleep. MUST be state-preserving — cancel loops/timers, keep
   * game state so the next start() resumes where the player left off.
   */
  stop(): void;
}

export interface RegisteredGame {
  id: string;
  api: Cartridge;
  /** The .gcard element — owns veil, LED, ⛶ button, stats row. */
  card: HTMLElement;
}
