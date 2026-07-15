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
  /** The can is gone by here; the screen stays empty until Act III at docStart. */
  emptyStart: 0.78,
  /** Act III: the three-pane product assembles itself, one panel at a time. */
  docStart: 0.8,
  docEnd: 1.0,
} as const;

/**
 * Semantic progress the film is authored against. Acts I–III live in [0, 1]; Act IV
 * (the multiuser payoff) is authored past the end, in [1, SEMANTIC_MAX], so the
 * earlier acts finish and simply hold their last frame beneath it.
 */
export const ACT4_SPAN = 0.25;
export const SEMANTIC_MAX = ACTS.docEnd + ACT4_SPAN;

/**
 * Each act gets a slice of raw scroll independent of its share of the semantic
 * timeline, so all four keep their own pacing. `remapScroll` turns a raw scroll
 * fraction (0–1) into semantic progress (0–SEMANTIC_MAX).
 */
export const ACT12_SCROLL = 0.43;
export const ACT3_SCROLL = 0.77;

export function remapScroll(rawP: number): number {
  if (rawP < ACT12_SCROLL) return (rawP / ACT12_SCROLL) * ACTS.docStart;
  if (rawP < ACT3_SCROLL) {
    return ACTS.docStart + ((rawP - ACT12_SCROLL) / (ACT3_SCROLL - ACT12_SCROLL)) * (ACTS.docEnd - ACTS.docStart);
  }
  return ACTS.docEnd + ((rawP - ACT3_SCROLL) / (1 - ACT3_SCROLL)) * ACT4_SPAN;
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

/**
 * Act IV beats, authored past the end of the timeline. On the held final frame of
 * Act III a presence layer pops in: teammates appear on other docs in the sidebar,
 * read along in this doc's gutter (the `cursors` phase drives their hop between
 * blocks), and the shared document fills with their agents — Act I's density, now
 * ordered.
 */
export const T4 = {
  avatarsStart: 1.0,
  avatarsEnd: 1.06,
  cursorsStart: 1.05,
  cursorsEnd: 1.14,
  densifyStart: 1.1,
  densifyEnd: 1.22,
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
  /**
   * Scroll distance per line of hero output. Brisker than the crowd's LINE_PACE:
   * the hero runs its whole session (21 lines, done ≈0.165) while it's alone on
   * screen, so the reader sees one complete job before the pile-on starts.
   */
  linePace: 0.005,
} as const;

/**
 * The rest of the terminals hold off until the hero has finished printing
 * (≈0.165), plus a held beat with the finished session alone on screen.
 */
export const CROWD_START = 0.19;

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

/**
 * Each arrival's gap to the next is this fraction of the gap before it. The
 * first gap comes out to ~0.054 — three lines of output — so the 2nd, 3rd, 4th
 * terminals each get a visible stretch of work in before the next one lands;
 * by the pile the gaps have shrunk to nearly nothing and it's a flood.
 */
export const SPAWN_DECAY = 0.8;

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
 * When terminal `i` appears. Gaps between arrivals decay geometrically from
 * CROWD_START to just before the hold: the first few are spaced out and
 * readable, and the acceleration never lets up, so the mess gradually and
 * then completely outruns the reader.
 */
export function spawnPoint(i: number, count: number): number {
  if (i === 0) return FIRST_SPAWN;

  const frac = (1 - SPAWN_DECAY ** (i - 1)) / (1 - SPAWN_DECAY ** (count - 1));
  return lerp(CROWD_START, ACTS.accretionEnd - 0.02, frac);
}
