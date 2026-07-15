import { HERO_SESSION, SESSIONS, type Session } from './terminal-scripts';
import {
  ACTS,
  GRID_JITTER,
  GRID_SLOTS,
  HERO,
  LINE_PACE,
  T3,
  T4,
  TERMINAL_COUNT,
  clamp01,
  easeInOut,
  easeOut,
  lerp,
  mulberry32,
  spawnPoint,
  span,
} from './timeline';

/** Dead center of the crowd, in viewport percent. The hero terminal sits here. */
const CENTER_X = 50;
const CENTER_Y = 50;

interface Term {
  readonly el: HTMLElement;
  readonly body: HTMLElement;
  readonly spawn: number;
  /** Resting position in the crowd, in viewport percent. */
  readonly x: number;
  readonly y: number;
  readonly lineCount: number;
  shown: number;
  /** Hero only: the span the command types itself into, and how much is typed. */
  readonly typed: HTMLElement | null;
  typedCount: number;
}

/**
 * Where each terminal lives before it gets thrown away. Axis-aligned, always.
 *
 * The hero holds the center and the first arrivals take the ring around it,
 * clear of each other — there is still room. Everything after that lands wherever
 * it falls, on top of whatever is already there. That's the whole argument.
 */
function scatter(i: number, rnd: () => number): { x: number; y: number } {
  if (i === 0) return { x: CENTER_X, y: CENTER_Y };

  const slot = GRID_SLOTS[i - 1];
  if (slot) {
    return {
      x: slot.x + (rnd() - 0.5) * 2 * GRID_JITTER.x,
      y: slot.y + (rnd() - 0.5) * 2 * GRID_JITTER.y,
    };
  }

  const j = i - 1 - GRID_SLOTS.length;
  const spread = TERMINAL_COUNT - 1 - GRID_SLOTS.length;
  const angle = j * 2.399 + rnd() * 0.9;
  const reach = 10 + (j / spread) ** 0.7 * 42;
  return {
    x: CENTER_X + Math.cos(angle) * reach * 1.6,
    y: CENTER_Y + Math.sin(angle) * reach * 0.95,
  };
}

function buildTerminal(i: number, rnd: () => number): Term {
  const hero = i === 0;
  const session = hero ? HERO_SESSION : SESSIONS[i % SESSIONS.length]!;
  const { x, y } = scatter(i, rnd);
  const spawn = spawnPoint(i, TERMINAL_COUNT);

  const el = document.createElement('div');
  el.className = 'term';
  el.style.zIndex = String(i + 1);
  if (hero) el.classList.add('term--first');

  const bar = document.createElement('div');
  bar.className = 'term__bar';
  bar.innerHTML = '<span></span><span></span><span></span>';

  const body = document.createElement('div');
  body.className = 'term__body';

  const cmd = document.createElement('div');
  cmd.className = 'term__cmd';
  let typed: HTMLElement | null = null;
  if (hero) {
    // A raw prompt. The command arrives on scroll, with the cursor riding its end.
    cmd.innerHTML =
      '<span class="term__sigil">$</span> <span class="term__typed"></span><span class="term__cursor"></span>';
    typed = cmd.querySelector<HTMLElement>('.term__typed')!;
  } else {
    cmd.textContent = `$ ${session.cmd}`;
  }
  body.append(cmd);

  session.lines.forEach((line, lineIndex) => {
    const row = document.createElement('div');
    row.className = 'term__line';
    row.style.setProperty('--i', String(lineIndex));
    row.textContent = line;
    body.append(row);
  });

  const caret = document.createElement('div');
  caret.className = 'term__caret';
  // Phase the blink by when the window opened (film progress read as seconds of
  // wall time), so the crowd's carets don't all pulse in unison.
  caret.style.animationDelay = `${(-spawn * 60).toFixed(2)}s`;
  body.append(caret);

  el.append(bar, body);
  return {
    el,
    body,
    spawn,
    x,
    y,
    lineCount: session.lines.length,
    shown: -1,
    typed,
    typedCount: -1,
  };
}

/** The other people in the workspace, shown as colored presence avatars in Act IV. */
interface Mate {
  readonly initial: string;
  readonly color: string;
}
const TEAM: readonly Mate[] = [
  { initial: 'M', color: '#5aa9e6' },
  { initial: 'R', color: '#b58cf0' },
  { initial: 'J', color: '#ef7fae' },
  { initial: 'S', color: '#e0a458' },
];

/**
 * A block in a document: a run of prose (skeleton) or an agent chip. A chip may be
 * owned by a teammate (shown as an avatar badge) and may be `late` — revealed only
 * in Act IV, as the shared document fills with other people's agents.
 */
type Block =
  | { readonly kind: 'h' | 'p' | 'p-short' }
  | { readonly kind: 'chip'; readonly session: Session; readonly late?: boolean };

/**
 * Teammate presence within a document: which teammate (owner), the blocks they
 * read (visits, as indices into the doc's blocks), and whether they arrive only
 * as the multiuser beat lands (late).
 */
interface Presence {
  readonly owner: number;
  readonly visits: readonly number[];
  readonly late?: boolean;
}

/** A document in the product: a title, an ordered list of blocks, and who's here. */
interface Doc {
  readonly title: string;
  readonly blocks: readonly Block[];
  readonly presence?: readonly Presence[];
}

const para = { kind: 'p' } as const;
const paraShort = { kind: 'p-short' } as const;
const head = { kind: 'h' } as const;
const agentBlock = (session: Session, late?: boolean): Block => ({
  kind: 'chip',
  session,
  ...(late !== undefined ? { late } : {}),
});

/**
 * The docs Act III moves through, each a different shape: the first holds the hero
 * session and has exactly three chips (the ones the chip-cycle steps through); the
 * others vary in length and chip count, and the last runs long enough to overflow.
 */
const DOCS: readonly Doc[] = [
  {
    title: 'Auth rewrite',
    blocks: [
      head, para, para, agentBlock(HERO_SESSION), paraShort, para,
      agentBlock(SESSIONS[0]!), para, para, agentBlock(SESSIONS[1]!), paraShort,
    ],
  },
  {
    title: 'Dependency upgrade',
    blocks: [para, paraShort, agentBlock(SESSIONS[2]!), para, agentBlock(SESSIONS[3]!), paraShort],
  },
  {
    // The shared doc of Act IV: your agent up top, teammates' agents below, and
    // more of theirs (`late`) that fill in as the multiuser beat lands. Teammates
    // read along in the gutter (presence): two already here, two arriving late.
    title: 'Platform migration',
    blocks: [
      head, para, para, agentBlock(SESSIONS[8]!), paraShort, para,
      agentBlock(SESSIONS[5]!), para, agentBlock(SESSIONS[4]!), para, paraShort,
      agentBlock(SESSIONS[10]!, true), agentBlock(SESSIONS[6]!, true),
    ],
    presence: [
      { owner: 0, visits: [3, 6] },
      { owner: 1, visits: [0, 8] },
      { owner: 2, visits: [11], late: true },
      { owner: 3, visits: [12], late: true },
    ],
  },
];

/** Each doc's chip sessions, in order — what the right-hand terminal shows. */
const DOC_SESSIONS: readonly (readonly Session[])[] = DOCS.map((d) =>
  d.blocks.flatMap((b) => (b.kind === 'chip' ? [b.session] : [])),
);

/**
 * The document tree in the sidebar. Folders nest files; the three `doc` rows are
 * the only ones the doc-switch beat scrubs through, but the tree is deep so the
 * product reads as a real workspace, not a three-item list.
 */
interface TreeNode {
  readonly label: string;
  readonly kind: 'folder' | 'doc' | 'file';
  readonly depth: number;
  /** A teammate is working in this doc — shown as a presence dot in Act IV. */
  readonly active?: number;
}

const TREE: readonly TreeNode[] = [
  { label: 'Workspace', kind: 'folder', depth: 0 },
  // The three docs we scrub through are siblings in this one branch.
  { label: 'Projects', kind: 'folder', depth: 1 },
  { label: DOCS[0]!.title, kind: 'doc', depth: 2, active: 2 },
  { label: DOCS[1]!.title, kind: 'doc', depth: 2 },
  { label: DOCS[2]!.title, kind: 'doc', depth: 2 },
  { label: 'Search indexing', kind: 'file', depth: 2, active: 0 },
  { label: 'Realtime sync', kind: 'file', depth: 2 },
  { label: 'Notes', kind: 'folder', depth: 1 },
  { label: 'Architecture', kind: 'file', depth: 2, active: 3 },
  { label: 'On-call runbook', kind: 'file', depth: 2 },
  { label: 'RFC drafts', kind: 'file', depth: 2, active: 1 },
  { label: 'Archive', kind: 'folder', depth: 0 },
  { label: 'Q1 planning', kind: 'file', depth: 1 },
  { label: 'Incident 4402', kind: 'file', depth: 1 },
  { label: 'Deprecations', kind: 'file', depth: 1 },
];

/** Chips in the first doc — the ones the chip-cycle beat steps through. */
const CHIPS_PER_DOC = DOC_SESSIONS[0]!.length;

interface App {
  readonly root: HTMLElement;
  readonly sidebar: HTMLElement;
  /** Sidebar rows for the switchable docs, in DOCS order (folder/file rows excluded). */
  readonly docRows: (HTMLElement | null)[];
  /** The window shell — title bar, border, background — that unites the panes. */
  readonly frame: HTMLElement;
  /** The terminal's own border, shown while it stands alone and faded as the shell arrives. */
  readonly termFrame: HTMLElement;
  readonly docPanel: HTMLElement;
  readonly docTitle: HTMLElement;
  /** Current document's blocks — replaced when the selected doc switches. */
  skels: HTMLElement[];
  chips: HTMLElement[];
  /** Chips revealed only in Act IV, as teammates' agents fill the shared doc. */
  lateChips: HTMLElement[];
  /** Teammate avatars in this doc's gutter — rebuilt with the document. */
  gutter: GutterAvatar[];
  readonly termPanel: HTMLElement;
  readonly termCmd: HTMLElement;
  readonly termBody: HTMLElement;
  /** Presence avatars on sidebar rows — teammates working in other docs. */
  readonly presence: HTMLElement[];
}

/** A teammate reading along in a document's gutter, beside the block they're on. */
interface GutterAvatar {
  readonly el: HTMLElement;
  readonly late: boolean;
  /** Stagger offset into the pop-in, so the team doesn't arrive all at once. */
  readonly delay: number;
  /** Vertical rest positions (px, top) for each block visited, in order. */
  readonly tops: readonly number[];
}

/** Interpolate an avatar's top across the blocks it visits, t in [0,1]. */
function stepTops(tops: readonly number[], t: number): number {
  if (tops.length <= 1) return tops[0] ?? 0;
  const seg = clamp01(t) * (tops.length - 1);
  const i = Math.min(tops.length - 2, Math.floor(seg));
  return lerp(tops[i]!, tops[i + 1]!, easeInOut(seg - i));
}

/**
 * Fill the document pane with a doc's blocks, replacing whatever was there. The
 * title element is kept; only the blocks below it are rebuilt.
 */
function fillDoc(
  docPanel: HTMLElement,
  docTitle: HTMLElement,
  doc: Doc,
): Pick<App, 'skels' | 'chips' | 'lateChips' | 'gutter'> {
  while (docPanel.lastChild && docPanel.lastChild !== docTitle) docPanel.removeChild(docPanel.lastChild);
  docTitle.textContent = doc.title;

  const skels: HTMLElement[] = [];
  const chips: HTMLElement[] = [];
  const lateChips: HTMLElement[] = [];
  // Every block in order, so presence entries can index the ones they read.
  const blockEls: HTMLElement[] = [];
  for (const block of doc.blocks) {
    if (block.kind === 'chip') {
      const el = document.createElement('div');
      el.className = 'chip chip--doc';
      el.innerHTML = '<span class="chip__dot"></span><span class="chip__label"></span>';
      el.querySelector<HTMLElement>('.chip__label')!.textContent = block.session.cmd;
      docPanel.append(el);
      (block.late ? lateChips : chips).push(el);
      blockEls.push(el);
    } else {
      const el = document.createElement('div');
      el.className = `skel skel--${block.kind}`;
      docPanel.append(el);
      skels.push(el);
      blockEls.push(el);
    }
  }

  // Teammate presence lives in the document's left gutter — an avatar beside the
  // block each person is reading. Built here so its rest positions can be measured
  // against the freshly laid-out blocks; the render loop drives its `top`.
  const gutter: GutterAvatar[] = [];
  let live = 0;
  let late = 0;
  for (const person of doc.presence ?? []) {
    const mate = TEAM[person.owner]!;
    const el = document.createElement('div');
    el.className = 'doc-avatar';
    el.textContent = mate.initial;
    el.style.background = mate.color;
    docPanel.append(el);
    const tops = person.visits.map((bi) => {
      const b = blockEls[bi]!;
      return b.offsetTop + b.offsetHeight / 2 - 10;
    });
    const isLate = person.late === true;
    gutter.push({ el, late: isLate, tops, delay: isLate ? late++ * 0.25 : live++ * 0.12 });
  }

  return { skels, chips, lateChips, gutter };
}

/** Build a session's lines into the terminal. How many show is set per-frame by
 *  the render loop, so the output can stream in on scroll like an Act I window. */
function paintTerm(cmd: HTMLElement, lines: HTMLElement, session: Session): void {
  cmd.textContent = `$ ${session.cmd}`;
  lines.replaceChildren();
  session.lines.forEach((line, i) => {
    const row = document.createElement('div');
    row.className = 'term__line';
    row.style.setProperty('--i', String(i));
    row.textContent = line;
    lines.append(row);
  });
}

/** Build the three-pane app: one window shell, with sidebar, document, terminal inside. */
function buildApp(): App {
  const root = document.createElement('div');
  root.className = 'app';

  // The window shell: title bar with traffic lights, plus the frame's border/bg.
  const frame = document.createElement('div');
  frame.className = 'app__frame';
  frame.innerHTML = '<div class="app__titlebar"><span></span><span></span><span></span></div>';

  const body = document.createElement('div');
  body.className = 'app__body';

  // Left pane: the document tree
  const sidebar = document.createElement('div');
  sidebar.className = 'app__sidebar';
  const docRows: (HTMLElement | null)[] = [];
  const presence: HTMLElement[] = [];
  let docIndex = 0;
  for (const node of TREE) {
    const row = document.createElement('div');
    row.className = `app__row app__row--${node.kind}`;
    row.style.paddingLeft = `${10 + node.depth * 15}px`;

    const icon = document.createElement('span');
    icon.className = 'app__row-icon';
    icon.textContent = node.kind === 'folder' ? '▾' : '·';
    const label = document.createElement('span');
    label.className = 'app__row-label';
    label.textContent = node.label;
    row.append(icon, label);

    // A teammate working in this doc, shown as a presence avatar, revealed in Act IV.
    if (node.active !== undefined) {
      const mate = TEAM[node.active]!;
      const av = document.createElement('span');
      av.className = 'app__row-avatar';
      av.textContent = mate.initial;
      av.style.background = mate.color;
      row.append(av);
      presence.push(av);
    }

    sidebar.append(row);
    if (node.kind === 'doc') {
      docRows[docIndex] = row;
      docIndex += 1;
    }
  }

  // Center pane: the selected document
  const docPanel = document.createElement('div');
  docPanel.className = 'app__doc';
  const docTitle = document.createElement('div');
  docTitle.className = 'app__doc-title';
  docPanel.append(docTitle);
  const { skels, chips, lateChips, gutter } = fillDoc(docPanel, docTitle, DOCS[0]!);

  // Right pane: the selected terminal. Its own border lets it stand alone at first.
  const termPanel = document.createElement('div');
  termPanel.className = 'app__term';
  const termFrame = document.createElement('div');
  termFrame.className = 'app__term-frame';
  const termBodyWrap = document.createElement('div');
  termBodyWrap.className = 'app__term-body';
  termBodyWrap.innerHTML =
    '<div class="term__cmd"></div><div class="app__term-lines"></div><div class="term__caret"></div>';
  termPanel.append(termFrame, termBodyWrap);
  const termCmd = termBodyWrap.querySelector<HTMLElement>('.term__cmd')!;
  const termBody = termBodyWrap.querySelector<HTMLElement>('.app__term-lines')!;
  paintTerm(termCmd, termBody, DOC_SESSIONS[0]![0]!);

  body.append(sidebar, docPanel, termPanel);
  root.append(frame, body);

  return {
    root, frame, termFrame, sidebar, docRows, docPanel, docTitle,
    skels, chips, lateChips, gutter, termPanel, termCmd, termBody, presence,
  };
}

export function mountFilm(stage: HTMLElement): (p: number) => void {
  const rnd = mulberry32(0xa11ce);

  const crowd = document.createElement('div');
  crowd.className = 'crowd';
  const terms: Term[] = [];
  for (let i = 0; i < TERMINAL_COUNT; i += 1) {
    const t = buildTerminal(i, rnd);
    terms.push(t);
    crowd.append(t.el);
  }

  const trash = document.createElement('div');
  trash.className = 'trash';
  // A classic outlined can: handle, lid, tapered body, three ribs. The lid is its
  // own group so it can swing open while the body stays put.
  trash.innerHTML =
    '<svg viewBox="0 0 64 62" fill="none" stroke="#fff" stroke-width="3" ' +
    'stroke-linecap="round" stroke-linejoin="round">' +
    '<g class="trash__lid"><path d="M24 10V8.5a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3V10"/>' +
    '<path d="M9 10h46"/></g>' +
    '<path d="M14.5 17 17.5 54a4.5 4.5 0 0 0 4.5 4h20a4.5 4.5 0 0 0 4.5-4L49.5 17"/>' +
    '<path d="M24.5 25l1.2 24M32 25v24M39.5 25l-1.2 24"/>' +
    '</svg>';
  const lid = trash.querySelector<HTMLElement>('.trash__lid')!;

  const app = buildApp();

  stage.append(crowd, trash, app.root);

  // Tracked so DOM only rewrites when the selection actually changes, not per frame.
  let paintedDoc = -1;
  let paintedTermKey = '';
  let paintedTermShown = -1;

  return function render(p: number): void {
    // --- Act I + II: the crowd -------------------------------------------------
    for (let i = 0; i < terms.length; i += 1) {
      const t = terms[i]!;
      const el = t.el;

      if (p < t.spawn) {
        el.style.opacity = '0';
        el.style.transform = `translate3d(${t.x}vw, ${t.y}vh, 0) translate(-50%, -50%) scale(1)`;
        if (t.shown !== -1) {
          t.shown = -1;
          t.body.style.setProperty('--shown', '0');
        }
        continue;
      }

      // The window just pops in: full opacity, full size, the instant it spawns.
      // No fade, no scale-up — it is simply open now, and it wasn't before.
      const purge = easeInOut(span(p, ACTS.purgeStart + (i / TERMINAL_COUNT) * 0.05, ACTS.purgeEnd));

      // Sucked into the mouth of the can, which now sits dead center on screen.
      const x = lerp(t.x, 50, purge);
      const y = lerp(t.y, 47, purge);
      const scale = lerp(1, 0.02, purge);
      // Windows sit square. The only rotation is the tumble on the way to the trash.
      const rot = lerp(0, i % 2 ? 40 : -40, purge);
      const opacity = 1 - clamp01((purge - 0.75) / 0.25);

      el.style.opacity = String(opacity);
      el.style.transform =
        `translate3d(${x}vw, ${y}vh, 0) translate(-50%, -50%) rotate(${rot}deg) scale(${scale})`;

      // Reveal output lines as the agent "works". The hero waits for its command
      // to be typed and launched; the crowd just starts working on arrival.
      let shown: number;
      if (t.typed) {
        const cmd = HERO_SESSION.cmd;
        const chars = Math.round(span(p, HERO.typeStart, HERO.typeEnd) * cmd.length);
        if (chars !== t.typedCount) {
          t.typedCount = chars;
          t.typed.textContent = cmd.slice(0, chars);
        }
        const running = p >= HERO.runStart;
        el.classList.toggle('is-running', running);
        shown = running ? Math.min(t.lineCount, Math.floor((p - HERO.runStart) / HERO.linePace)) : 0;
      } else {
        shown = Math.min(t.lineCount, Math.floor((p - t.spawn) / LINE_PACE));
      }

      if (shown !== t.shown) {
        t.shown = shown;
        t.body.style.setProperty('--shown', String(shown));
        // Follow the tail: the window stays put, the text scrolls up inside it.
        t.body.scrollTop = t.body.scrollHeight;
      }
    }

    // --- The trash -------------------------------------------------------------
    // The can fades in just before the purge, the lid swings open to take the
    // crowd, then shuts again once the last window is in, and the closed can
    // fades away — leaving the screen empty for a beat before Act III arrives.
    const trashIn = span(p, ACTS.purgeStart - 0.02, ACTS.purgeStart);
    const trashOut = span(p, ACTS.purgeEnd + 0.005, ACTS.emptyStart);
    const lidOpen = easeOut(span(p, ACTS.purgeStart - 0.02, ACTS.purgeStart + 0.05));
    const lidShut = easeInOut(span(p, ACTS.purgeEnd, ACTS.purgeEnd + 0.015));
    const openness = lidOpen * (1 - lidShut);
    trash.style.opacity = String(trashIn * (1 - trashOut));
    lid.style.transform = `rotate(${openness * -122}deg) translateY(${openness * -1}px)`;

    // --- Act III: the product assembles ----------------------------------------
    app.root.style.opacity = String(clamp01(span(p, ACTS.docStart, ACTS.docStart + 0.004)));

    // Reveal outward from the familiar terminal: the lone terminal and its chip,
    // then the window shell + document around them, then the sidebar.
    const termIn = easeOut(span(p, T3.termInStart, T3.termInEnd));
    const docIn = easeOut(span(p, T3.docInStart, T3.docInEnd));
    const sideIn = easeOut(span(p, T3.sideInStart, T3.sideInEnd));

    // The window shell arrives with the sidebar, wrapping the already-floating
    // terminal and document into one app; the terminal's own border fades out as
    // it stops being a lone window and becomes the right pane.
    app.frame.style.opacity = String(sideIn);
    app.termFrame.style.opacity = String(1 - sideIn);
    app.root.style.setProperty('--frame', String(sideIn));

    app.termPanel.style.opacity = String(termIn);
    app.sidebar.style.opacity = String(sideIn);

    // Which document and chip is selected, and where this terminal's view began —
    // the point it starts streaming its output from.
    let selectedDoc = 0;
    let selectedChip = 0;
    let viewStart = T3.termFillStart;
    if (p >= T3.docSwitchStart) {
      // Beat 5: switch through the other docs (the first was already shown).
      const others = DOCS.length - 1;
      const w = T3.docSwitchEnd - T3.docSwitchStart;
      const k = Math.min(others - 1, Math.floor(span(p, T3.docSwitchStart, T3.docSwitchEnd) * others));
      selectedDoc = 1 + k;
      viewStart = T3.docSwitchStart + (k * w) / others;
    } else if (p >= T3.chipCycleStart) {
      // Beat 3: step through the first doc's other chips.
      const others = CHIPS_PER_DOC - 1;
      const w = T3.chipCycleEnd - T3.chipCycleStart;
      const k = Math.min(others - 1, Math.floor(span(p, T3.chipCycleStart, T3.chipCycleEnd) * others));
      selectedChip = 1 + k;
      viewStart = T3.chipCycleStart + (k * w) / others;
    }
    selectedChip = Math.min(selectedChip, DOC_SESSIONS[selectedDoc]!.length - 1);

    // Rebuild the center pane when the selected doc changes — each doc is a
    // different shape, so it's a fresh block list, not a text swap.
    if (selectedDoc !== paintedDoc) {
      paintedDoc = selectedDoc;
      const built = fillDoc(app.docPanel, app.docTitle, DOCS[selectedDoc]!);
      app.skels = built.skels;
      app.chips = built.chips;
      app.lateChips = built.lateChips;
      app.gutter = built.gutter;
      for (let i = 0; i < app.docRows.length; i += 1) {
        app.docRows[i]?.classList.toggle('is-active', i === selectedDoc);
      }
    }

    app.docTitle.style.opacity = String(docIn);
    for (const skel of app.skels) skel.style.opacity = String(docIn);
    for (let i = 0; i < app.chips.length; i += 1) {
      // The first chip arrives with the terminal; the rest with the document.
      app.chips[i]!.style.opacity = String(i === 0 ? Math.max(termIn, docIn) : docIn);
      app.chips[i]!.classList.toggle('is-selected', i === selectedChip);
    }

    // Stream the selected terminal's output like an Act I window: rebuild on
    // switch, then reveal lines as scroll passes its view start.
    const session = DOC_SESSIONS[selectedDoc]![selectedChip]!;
    const termKey = `${selectedDoc}:${selectedChip}`;
    if (termKey !== paintedTermKey) {
      paintedTermKey = termKey;
      paintedTermShown = -1;
      paintTerm(app.termCmd, app.termBody, session);
    }
    // Only the first doc's terminals stream in; docs switched to afterward show
    // their terminal already full.
    const shown =
      selectedDoc === 0
        ? Math.max(0, Math.min(session.lines.length, Math.floor((p - viewStart) / T3.fillPace)))
        : session.lines.length;
    if (shown !== paintedTermShown) {
      paintedTermShown = shown;
      app.termBody.style.setProperty('--shown', String(shown));
      app.termBody.scrollTop = app.termBody.scrollHeight;
    }

    // --- Act IV: multiuser -----------------------------------------------------
    // On the held final frame a presence layer pops in: teammates appear on other
    // docs in the sidebar, read along in this doc's gutter, and their agents fill
    // the shared document. Nothing here shows until the beat begins (p >= 1).
    const avatarsP = span(p, T4.avatarsStart, T4.avatarsEnd);
    const cursorsP = span(p, T4.cursorsStart, T4.cursorsEnd);
    const densifyP = span(p, T4.densifyStart, T4.densifyEnd);

    // Teammates working elsewhere, as presence avatars on their sidebar rows.
    for (let i = 0; i < app.presence.length; i += 1) {
      const a = easeOut(clamp01((avatarsP - i * 0.13) / 0.5));
      app.presence[i]!.style.opacity = String(a);
      app.presence[i]!.style.transform = `scale(${lerp(0.4, 1, a)})`;
    }

    // Teammates in this document, reading along in its gutter and hopping between
    // the blocks they look at. The late arrivals pop in with their own agents.
    for (const g of app.gutter) {
      const pin = g.late
        ? easeOut(clamp01((densifyP - g.delay) / 0.6))
        : easeOut(clamp01((avatarsP - g.delay) / 0.5));
      const hopP = g.late ? 1 : easeInOut(clamp01((cursorsP - g.delay) / 0.7));
      g.el.style.opacity = String(pin);
      g.el.style.transform = `scale(${lerp(0.4, 1, pin)})`;
      g.el.style.top = `${stepTops(g.tops, hopP)}px`;
    }

    // The shared document fills with teammates' agents as the beat lands.
    for (let i = 0; i < app.lateChips.length; i += 1) {
      app.lateChips[i]!.style.opacity = String(easeOut(clamp01((densifyP - i * 0.25) / 0.6)));
    }
  };
}
