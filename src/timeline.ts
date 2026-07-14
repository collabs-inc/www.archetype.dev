/** Pure timing math for the film. No DOM in here. */

export const ACTS = {
  /** Act I: terminals accrete until the screen is unusable. */
  accretionStart: 0.0,
  accretionEnd: 0.56,
  /** Act II: everything goes in the trash, then a held beat of nothing. */
  purgeStart: 0.56,
  purgeEnd: 0.68,
  emptyEnd: 0.76,
  /** Act III: the document builds, agents are born in place, camera pulls back. */
  docStart: 0.76,
  pullBackStart: 0.9,
  docEnd: 1.0,
} as const;

export const TERMINAL_COUNT = 34;

/**
 * The first terminal spawns before the film starts, so it has already finished
 * fading in by the time the page is at rest — you land on it, not on an empty
 * screen. Its output still waits for p > 0.
 */
export const FIRST_SPAWN = -0.03;

export function clamp01(n: number): number {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

/** Progress of `p` through the window [a, b], clamped to 0-1. */
export function span(p: number, a: number, b: number): number {
  return clamp01((p - a) / (b - a));
}

export function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Deterministic PRNG so the scatter is identical on every load and every scrub. */
export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * When terminal `i` appears. The first few are spaced out and readable; the
 * rest pile on with accelerating frequency, so the mess outruns the reader.
 */
export function spawnPoint(i: number, count: number): number {
  const t = i / (count - 1);
  const eased = t ** 0.55;
  return lerp(FIRST_SPAWN, ACTS.accretionEnd - 0.02, eased);
}
