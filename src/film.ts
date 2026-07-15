import { HERO_SESSION, SESSIONS, type Session } from './terminal-scripts';
import {
  ACTS,
  GRID_JITTER,
  GRID_SLOTS,
  HERO,
  LINE_PACE,
  T3,
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
  body.append(caret);

  el.append(bar, body);
  return {
    el,
    body,
    spawn: spawnPoint(i, TERMINAL_COUNT),
    x,
    y,
    lineCount: session.lines.length,
    shown: -1,
    typed,
    typedCount: -1,
  };
}

/** A document in the product: a title, and the agent sessions that live inside it. */
interface Doc {
  readonly title: string;
  readonly chips: readonly Session[];
}

/** The docs Act III moves through. The first holds the hero session from the film. */
const DOCS: readonly Doc[] = [
  { title: 'Auth rewrite', chips: [HERO_SESSION, SESSIONS[0]!, SESSIONS[1]!] },
  { title: 'Dependency upgrade', chips: [SESSIONS[2]!, SESSIONS[3]!, SESSIONS[4]!] },
  { title: 'Platform migration', chips: [SESSIONS[8]!, SESSIONS[5]!, SESSIONS[10]!] },
];

/** The document tree in the sidebar. Section headers, then the switchable docs. */
const TREE: ReadonlyArray<{ label: string; kind: 'header' | 'doc' | 'muted' }> = [
  { label: 'PROJECTS', kind: 'header' },
  { label: DOCS[0]!.title, kind: 'doc' },
  { label: DOCS[1]!.title, kind: 'doc' },
  { label: DOCS[2]!.title, kind: 'doc' },
  { label: 'ARCHIVE', kind: 'header' },
  { label: 'Q1 planning', kind: 'muted' },
  { label: 'Incident 4402', kind: 'muted' },
];

/** How many agent chips each doc shows. All docs share this layout so switching is clean. */
const CHIPS_PER_DOC = 3;

interface App {
  readonly root: HTMLElement;
  readonly sidebar: HTMLElement;
  /** Sidebar rows, indexed to match DOCS (headers/muted rows are null). */
  readonly docRows: (HTMLElement | null)[];
  readonly docPanel: HTMLElement;
  /** The panel's frame — background/border/shadow — revealed after the first chip. */
  readonly docBg: HTMLElement;
  readonly docTitle: HTMLElement;
  readonly skels: HTMLElement[];
  readonly chips: HTMLElement[];
  readonly chipLabels: HTMLElement[];
  readonly termPanel: HTMLElement;
  readonly termCmd: HTMLElement;
  readonly termBody: HTMLElement;
}

/** One terminal window's worth of markup, filled by `paintTerm`. */
function buildTermPanel(): { panel: HTMLElement; cmd: HTMLElement; body: HTMLElement } {
  const panel = document.createElement('div');
  panel.className = 'app__term';
  panel.innerHTML =
    '<div class="term__bar"><span></span><span></span><span></span></div>' +
    '<div class="app__term-body"><div class="term__cmd"></div><div class="app__term-lines"></div>' +
    '<div class="term__caret"></div></div>';
  return {
    panel,
    cmd: panel.querySelector<HTMLElement>('.term__cmd')!,
    body: panel.querySelector<HTMLElement>('.app__term-lines')!,
  };
}

/** Print a session into the right-hand terminal: prompt, every line, last one active. */
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
  // --shown = line count: every line is revealed, and the last one reads as active.
  lines.style.setProperty('--shown', String(session.lines.length));
  lines.scrollTop = lines.scrollHeight;
}

/** Build the three-pane app: sidebar tree, center document, right terminal. */
function buildApp(): App {
  const root = document.createElement('div');
  root.className = 'app';

  // Sidebar
  const sidebar = document.createElement('div');
  sidebar.className = 'app__sidebar';
  const docRows: (HTMLElement | null)[] = [];
  let docIndex = 0;
  for (const node of TREE) {
    const row = document.createElement('div');
    row.className = `app__row app__row--${node.kind}`;
    row.textContent = node.label;
    sidebar.append(row);
    if (node.kind === 'doc') {
      docRows[docIndex] = row;
      docIndex += 1;
    }
  }

  // Center document. The frame is a separate layer so the first chip can float
  // in the center before the document around it is revealed.
  const docPanel = document.createElement('div');
  docPanel.className = 'app__doc';
  const docBg = document.createElement('div');
  docBg.className = 'app__doc-bg';
  docPanel.append(docBg);
  const docTitle = document.createElement('div');
  docTitle.className = 'app__doc-title';
  docTitle.textContent = DOCS[0]!.title;
  docPanel.append(docTitle);

  const layout: ReadonlyArray<'p' | 'p-short' | 'chip'> = [
    'p', 'p', 'chip', 'p-short', 'p', 'chip', 'p', 'chip', 'p-short',
  ];
  const skels: HTMLElement[] = [];
  const chips: HTMLElement[] = [];
  const chipLabels: HTMLElement[] = [];
  for (const kind of layout) {
    if (kind === 'chip') {
      const chip = document.createElement('div');
      chip.className = 'chip chip--doc';
      chip.innerHTML = '<span class="chip__dot"></span><span class="chip__label"></span>';
      const label = chip.querySelector<HTMLElement>('.chip__label')!;
      label.textContent = DOCS[0]!.chips[chips.length]!.cmd;
      docPanel.append(chip);
      chips.push(chip);
      chipLabels.push(label);
    } else {
      const skel = document.createElement('div');
      skel.className = `skel skel--${kind}`;
      docPanel.append(skel);
      skels.push(skel);
    }
  }

  const { panel: termPanel, cmd: termCmd, body: termBody } = buildTermPanel();
  paintTerm(termCmd, termBody, DOCS[0]!.chips[0]!);

  root.append(sidebar, docPanel, termPanel);
  return {
    root, sidebar, docRows, docPanel, docBg, docTitle,
    skels, chips, chipLabels, termPanel, termCmd, termBody,
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
  trash.innerHTML = '<div class="trash__lid"></div><div class="trash__can"></div>';
  const lid = trash.querySelector<HTMLElement>('.trash__lid')!;

  const app = buildApp();

  stage.append(crowd, trash, app.root);

  // Tracked so DOM only rewrites when the selection actually changes, not per frame.
  let paintedDoc = -1;
  let paintedTermKey = '';

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

      // Sucked into the mouth of the can, not off the bottom of the screen.
      const x = lerp(t.x, 50, purge);
      const y = lerp(t.y, 89, purge);
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
    // The can rises into place just before the purge, then the lid swings open to
    // take the crowd, and the whole thing leaves once the screen is clear.
    const trashIn = easeOut(span(p, ACTS.purgeStart - 0.05, ACTS.purgeStart));
    const trashOut = span(p, ACTS.purgeEnd + 0.01, ACTS.emptyEnd);
    const lidOpen = easeOut(span(p, ACTS.purgeStart - 0.02, ACTS.purgeStart + 0.05));
    const shake = Math.sin(p * 400) * 1.5 * (trashIn - trashOut);
    trash.style.opacity = String(trashIn * (1 - trashOut));
    trash.style.transform =
      `translate3d(-50%, ${lerp(30, 0, trashIn)}px, 0) rotate(${shake}deg) scale(${lerp(0.8, 1, trashIn)})`;
    lid.style.transform = `rotate(${lerp(0, -122, lidOpen)}deg) translateY(${lerp(0, -1, lidOpen)}px)`;

    // --- Act III: the product assembles ----------------------------------------
    app.root.style.opacity = String(clamp01(span(p, ACTS.docStart, ACTS.docStart + 0.004)));

    // Panels reveal outward from the familiar terminal: term + its lone chip, then
    // the document frame around it, then the sidebar.
    const termIn = easeOut(span(p, T3.termInStart, T3.termInEnd));
    const docIn = easeOut(span(p, T3.docInStart, T3.docInEnd));
    const sideIn = easeOut(span(p, T3.sideInStart, T3.sideInEnd));

    app.termPanel.style.opacity = String(termIn);
    app.sidebar.style.opacity = String(sideIn);
    app.docBg.style.opacity = String(docIn);
    app.docTitle.style.opacity = String(docIn);
    for (const skel of app.skels) skel.style.opacity = String(docIn);
    for (let i = 0; i < app.chips.length; i += 1) {
      // The first chip arrives with the terminal; the rest with the document.
      app.chips[i]!.style.opacity = String(i === 0 ? Math.max(termIn, docIn) : docIn);
    }

    // Which document, and which chip within it, is selected.
    let selectedDoc = 0;
    let selectedChip: number;
    if (p >= T3.docSwitchStart) {
      const step = span(p, T3.docSwitchStart, T3.docSwitchEnd) * DOCS.length;
      selectedDoc = Math.min(DOCS.length - 1, Math.floor(step));
      selectedChip = 0;
    } else if (p >= T3.chipCycleEnd) {
      selectedChip = CHIPS_PER_DOC - 1;
    } else if (p >= T3.chipCycleStart) {
      const step = span(p, T3.chipCycleStart, T3.chipCycleEnd) * CHIPS_PER_DOC;
      selectedChip = Math.min(CHIPS_PER_DOC - 1, Math.floor(step));
    } else {
      selectedChip = 0;
    }

    if (selectedDoc !== paintedDoc) {
      paintedDoc = selectedDoc;
      const d = DOCS[selectedDoc]!;
      app.docTitle.textContent = d.title;
      for (let i = 0; i < app.chipLabels.length; i += 1) app.chipLabels[i]!.textContent = d.chips[i]!.cmd;
      for (let i = 0; i < app.docRows.length; i += 1) {
        app.docRows[i]?.classList.toggle('is-active', i === selectedDoc);
      }
    }

    for (let i = 0; i < app.chips.length; i += 1) {
      app.chips[i]!.classList.toggle('is-selected', i === selectedChip);
    }

    const termKey = `${selectedDoc}:${selectedChip}`;
    if (termKey !== paintedTermKey) {
      paintedTermKey = termKey;
      paintTerm(app.termCmd, app.termBody, DOCS[selectedDoc]!.chips[selectedChip]!);
    }
  };
}
