/**
 * Every word on the page lives here. Nothing else needs editing to change copy.
 *
 * Empty string = unwritten. Unwritten slots render as a visible red placeholder
 * in dev so nothing ships blank by accident.
 */

/** A line that lands on a beat of the film. */
export interface Beat {
  /** Scroll progress (0-1) at which the line reaches full opacity. */
  readonly at: number;
  readonly text: string;
}

export const FILM_BEATS: readonly Beat[] = [
  { at: 0.02, text: '' }, // opening — one agent, calm
  { at: 0.3, text: '' }, // it's getting crowded
  { at: 0.5, text: '' }, // the mess is total
  { at: 0.63, text: '' }, // the purge
  { at: 0.75, text: '' }, // the empty beat
  { at: 0.88, text: '' }, // an agent is born in place
  { at: 0.97, text: '' }, // the thesis, on the pull-back
];

/** Blocks the essay is built from. Order here is order on the page. */
export type EssayBlock =
  | { readonly kind: 'heading'; readonly text: string }
  | { readonly kind: 'paragraph'; readonly text: string }
  | { readonly kind: 'quote'; readonly text: string }
  | { readonly kind: 'agent'; readonly label: string; readonly status: AgentStatus };

export type AgentStatus = 'working' | 'idle' | 'done';

export const ESSAY: readonly EssayBlock[] = [
  { kind: 'heading', text: '' },
  { kind: 'paragraph', text: '' },
  { kind: 'paragraph', text: '' },
  { kind: 'agent', label: '', status: 'working' },
  { kind: 'paragraph', text: '' },
  { kind: 'quote', text: '' },
  { kind: 'heading', text: '' },
  { kind: 'paragraph', text: '' },
  { kind: 'agent', label: '', status: 'done' },
  { kind: 'paragraph', text: '' },
];

/** The last line on the page, and the one link out. */
export const CODA = {
  line: '',
  linkText: '',
  linkHref: '#',
} as const;

export const SITE_TITLE = 'Archetype';
