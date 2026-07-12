/**
 * input.ts — semantic touch/pointer gestures for game surfaces.
 *
 * Attaches to a specific element (NEVER document — hub.ts owns all
 * document-level listeners) and emits tap / swipe / long-press.
 *
 * Scroll-vs-swipe discrimination: whether a touch scrolls the page is
 * decided by CSS `touch-action`, not preventDefault. arcade.css sets
 * `.gcard.active .screen { touch-action: none }`, so an AWAKE game owns
 * its touches while an asleep card (veiled) scrolls normally. Pass
 * `ownTouch: true` for surfaces that must always own their touches.
 */

export interface GestureHandlers {
  /** Quick press with no movement. x/y are element-relative CSS px. */
  tap?(x: number, y: number): void;
  /** Dominant-axis movement past the swipe threshold (fires once per gesture). */
  swipe?(dir: "up" | "down" | "left" | "right"): void;
  /** Press held ≥ longPressMs without movement. */
  longPress?(x: number, y: number): void;
}

export interface GestureOptions {
  /** Set touch-action:none on the element for the lifetime of the attachment. */
  ownTouch?: boolean;
  /** Long-press hold time in ms (default 500). */
  longPressMs?: number;
}

/** Movement below this (px) still counts as a tap / keeps a long-press alive. */
const TAP_SLOP = 10;
/** Movement past this (px) on a dominant axis classifies as a swipe. */
const SWIPE_MIN = 24;
/** Dominant-axis ratio: major axis must exceed minor × this. */
const AXIS_RATIO = 1.2;

/**
 * Pure swipe classifier (exported for unit tests).
 * Returns null while the movement is ambiguous or below threshold.
 */
export function classifySwipe(
  dx: number,
  dy: number,
): "up" | "down" | "left" | "right" | null {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (Math.max(ax, ay) < SWIPE_MIN) return null;
  if (ax >= ay * AXIS_RATIO) return dx > 0 ? "right" : "left";
  if (ay >= ax * AXIS_RATIO) return dy > 0 ? "down" : "up";
  return null; // diagonal — ambiguous
}

/** Attach gesture recognition to an element. Returns a detach function. */
export function gestures(
  el: HTMLElement,
  handlers: GestureHandlers,
  opts: GestureOptions = {},
): () => void {
  const longPressMs = opts.longPressMs ?? 500;
  const prevTouchAction = el.style.touchAction;
  if (opts.ownTouch) el.style.touchAction = "none";

  let pointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let swiped = false;
  let longPressed = false;
  let lpTimer: ReturnType<typeof setTimeout> | null = null;

  const rel = (e: PointerEvent): [number, number] => {
    const r = el.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };

  const clearLp = (): void => {
    if (lpTimer !== null) clearTimeout(lpTimer);
    lpTimer = null;
  };

  const reset = (): void => {
    pointerId = null;
    clearLp();
  };

  const onDown = (e: PointerEvent): void => {
    if (!e.isPrimary || pointerId !== null) return;
    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    swiped = false;
    longPressed = false;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* capture is best-effort */
    }
    if (handlers.longPress) {
      const [x, y] = rel(e);
      lpTimer = setTimeout(() => {
        longPressed = true;
        handlers.longPress?.(x, y);
      }, longPressMs);
    }
  };

  const onMove = (e: PointerEvent): void => {
    if (e.pointerId !== pointerId) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Math.abs(dx) > TAP_SLOP || Math.abs(dy) > TAP_SLOP) clearLp();
    if (!swiped && !longPressed && handlers.swipe) {
      const dir = classifySwipe(dx, dy);
      if (dir) {
        swiped = true;
        handlers.swipe(dir);
      }
    }
  };

  const onUp = (e: PointerEvent): void => {
    if (e.pointerId !== pointerId) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const moved = Math.abs(dx) > TAP_SLOP || Math.abs(dy) > TAP_SLOP;
    if (!swiped && !longPressed && !moved && handlers.tap) {
      const [x, y] = rel(e);
      handlers.tap(x, y);
    }
    reset();
  };

  const onCancel = (e: PointerEvent): void => {
    if (e.pointerId !== pointerId) return;
    reset();
  };

  /** Long-press on touch pops a context menu on some platforms — suppress. */
  const onContextMenu = (e: Event): void => {
    if (handlers.longPress) e.preventDefault();
  };

  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", onCancel);
  el.addEventListener("contextmenu", onContextMenu);

  return () => {
    reset();
    el.removeEventListener("pointerdown", onDown);
    el.removeEventListener("pointermove", onMove);
    el.removeEventListener("pointerup", onUp);
    el.removeEventListener("pointercancel", onCancel);
    el.removeEventListener("contextmenu", onContextMenu);
    el.style.touchAction = prevTouchAction;
  };
}
