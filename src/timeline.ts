/** Pure timing math for the film. No DOM in here. */

export const ACTS = {
  /** Act I: terminals accrete until the screen is unusable. */
  accretionStart: 0.0,
  accretionEnd: 0.48,
  /**
   * The hold: every window is open and running. Nothing new arrives — this is
   * the stretch where the last, freshly-spawned terminals fill up with output,
   * so the whole screen is alive at once before it gets thrown away.
   */
  holdEnd: 0.66,
  /** Act II: everything goes in the trash, then a held beat of nothing. */
  purgeStart: 0.66,
  purgeEnd: 0.76,
  emptyEnd: 0.8,
  /** Act III: the three-pane product assembles itself, one panel at a time. */
  docStart: 0.8,
  docEnd: 1.0,
} as const;

/**
 * Act III gets far more scroll than its share of the semantic timeline: Acts I–II
 * occupy the first ACT12_SCROLL of the page, Act III the rest. `remapScroll` turns
 * a raw scroll fraction into the semantic progress the film is authored against,
 * so the acts keep their tuning while Act III has room to breathe.
 */
export const ACT12_SCROLL = 0.56;

export function remapScroll(rawP: number): number {
  if (rawP < ACT12_SCROLL) return (rawP / ACT12_SCROLL) * ACTS.docStart;
  return ACTS.docStart + ((rawP - ACT12_SCROLL) / (1 - ACT12_SCROLL)) * (1 - ACTS.docStart);
}

/**
 * Act III beats, as semantic scroll fractions. The product is revealed from the
 * one familiar thing outward: a terminal and its lone chip (the terminal streams
 * its output like an Act I window), then the document around it, then the
 * chip↔terminal link, then the sidebar, then other docs.
 */
export const T3 = {
  termInStart: 0.8,
  termInEnd: 0.818,
  /** The first terminal begins streaming its output here. */
  termFillStart: 0.818,
  docInStart: 0.855,
  docInEnd: 0.885,
  chipCycleStart: 0.885,
  chipCycleEnd: 0.94,
  sideInStart: 0.94,
  sideInEnd: 0.955,
  docSwitchStart: 0.955,
  docSwitchEnd: 1.0,
  /** Semantic scroll per revealed terminal line — the fill rate of every Act III terminal. */
  fillPace: 0.0011,
} as const;

export const TERMINAL_COUNT = 34;

/**
 * The hero terminal spawns before the film starts, so it has already finished
 * fading in by the time the page is at rest — you land on a shell, not on an
 * empty screen. It sits at a bare prompt until the reader scrolls.
 */
export const FIRST_SPAWN = -0.03;

/**
 * The hero beat: the reader scrolls, a command types itself into the raw shell,
 * and it launches. Only once it has printed does the crowd start piling on.
 */
export const HERO = {
  typeStart: 0.012,
  typeEnd: 0.05,
  runStart: 0.06,
  /** Scroll distance per line of hero output. */
  linePace: 0.018,
} as const;

/** The rest of the terminals hold off until the hero has had its moment. */
export const CROWD_START = 0.12;

/**
 * The first arrivals land in a ring of slots around the hero, none of them
 * touching. A window is ~29vw x ~31vh; the slots are pitched wider than that so
 * there is still room for everyone, even after the jitter below is applied.
 */
export const GRID_SLOTS = [
  { x: 76, y: 50 },
  { x: 24, y: 50 },
  { x: 50, y: 17 },
  { x: 50, y: 83 },
  { x: 76, y: 17 },
  { x: 24, y: 83 },
  { x: 76, y: 83 },
  { x: 24, y: 17 },
] as const;

/** Each ring slot is nudged off its exact mark so the grid never looks ruled. */
export const GRID_JITTER = { x: 2, y: 1.5 } as const;

/** Where the orderly phase ends and windows start landing on top of each other. */
export const GRID_END = 0.33;

/**
 * Scroll distance per line of crowd output. Paced so an agent that arrives early
 * is still printing when the purge comes — they never sit finished and idle.
 */
export const LINE_PACE = 0.018;

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
  if (i === 0) return FIRST_SPAWN;

  // The ring: one window at a time, evenly spaced, with room to read each one.
  if (i <= GRID_SLOTS.length) {
    return lerp(CROWD_START, GRID_END, (i - 1) / GRID_SLOTS.length);
  }

  // The pile: gaps shrink as it goes, so arrivals accelerate into a flood.
  const first = GRID_SLOTS.length + 1;
  const t = (i - first) / (count - 1 - first);
  return lerp(GRID_END, ACTS.accretionEnd - 0.02, t ** 0.7);
}
