/**
 * audio.ts — the ONLY module that owns an AudioContext (ADR-6).
 *
 * All sound is synthesized WebAudio beeps (no audio files). The context is
 * created lazily on the first beep — which, given click-to-wake, always
 * happens inside a user gesture, avoiding autoplay-policy warnings.
 * Every beep respects the persisted global sound toggle (`arcade:sound`).
 */
import { store } from "./storage";

let sndOn: boolean = store.get<boolean>("sound", true, (v): v is boolean => typeof v === "boolean");
let ctx: AudioContext | null = null;

/** Play a short synthesized beep. Mirrors the mockup's synth exactly. */
export function beep(
  freq = 440,
  dur = 0.06,
  wave: OscillatorType = "square",
  gain = 0.04,
): void {
  if (!sndOn) return;
  try {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = wave;
    o.frequency.value = freq;
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur);
  } catch {
    /* audio is decorative — never let it break a game */
  }
}

/** Current state of the global sound toggle. */
export function soundEnabled(): boolean {
  return sndOn;
}

/** Flip and persist the global sound toggle. Returns the new state. */
export function toggleSound(): boolean {
  sndOn = !sndOn;
  store.set("sound", sndOn);
  return sndOn;
}
