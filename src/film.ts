import { HERO_SESSION, SESSIONS } from './terminal-scripts';
import {
  ACTS,
  GRID_SLOTS,
  HERO,
  LINE_PACE,
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
  if (slot) return { x: slot.x, y: slot.y };

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

/** The document that Act III builds: headings and prose as skeleton, agents as real blocks. */
function buildDoc(): { root: HTMLElement; items: HTMLElement[] } {
  const root = document.createElement('div');
  root.className = 'doc';

  const items: HTMLElement[] = [];
  const plan: ReadonlyArray<'h' | 'p' | 'p-short' | 'agent'> = [
    'h', 'p', 'p', 'agent', 'p-short',
    'h', 'p', 'agent', 'agent', 'p',
    'h', 'p', 'agent', 'p-short', 'agent',
  ];

  let agentIndex = 0;
  for (const kind of plan) {
    const el = document.createElement('div');
    if (kind === 'agent') {
      const session = SESSIONS[agentIndex % SESSIONS.length]!;
      agentIndex += 1;
      el.className = 'chip';
      el.innerHTML = `<span class="chip__dot"></span><span class="chip__label"></span>`;
      el.querySelector('.chip__label')!.textContent = session.cmd;
    } else {
      el.className = `skel skel--${kind}`;
    }
    root.append(el);
    items.push(el);
  }
  return { root, items };
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

  const world = document.createElement('div');
  world.className = 'world';
  const { root: doc, items } = buildDoc();
  const siblingL = document.createElement('div');
  siblingL.className = 'doc doc--sibling';
  const siblingR = document.createElement('div');
  siblingR.className = 'doc doc--sibling';
  for (const sib of [siblingL, siblingR]) {
    const { root } = buildDoc();
    sib.append(...Array.from(root.children));
  }
  world.append(siblingL, doc, siblingR);

  stage.append(crowd, trash, world);

  return function render(p: number): void {
    // --- Act I + II: the crowd -------------------------------------------------
    for (let i = 0; i < terms.length; i += 1) {
      const t = terms[i]!;
      const el = t.el;

      if (p < t.spawn) {
        el.style.opacity = '0';
        el.style.transform = `translate3d(${t.x}vw, ${t.y}vh, 0) translate(-50%, -50%) scale(.9)`;
        if (t.shown !== -1) {
          t.shown = -1;
          t.body.style.setProperty('--shown', '0');
        }
        continue;
      }

      const appear = easeOut(span(p, t.spawn, t.spawn + 0.018));
      const purge = easeInOut(span(p, ACTS.purgeStart + (i / TERMINAL_COUNT) * 0.05, ACTS.purgeEnd));

      const x = lerp(t.x, 50, purge);
      const y = lerp(t.y, 112, purge);
      const scale = lerp(lerp(0.9, 1, appear), 0.04, purge);
      // Windows sit square. The only rotation is the tumble on the way to the trash.
      const rot = lerp(0, i % 2 ? 40 : -40, purge);
      const opacity = appear * (1 - clamp01((purge - 0.75) / 0.25));

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
    const trashIn = easeOut(span(p, ACTS.purgeStart - 0.03, ACTS.purgeStart + 0.04));
    const trashOut = span(p, ACTS.purgeEnd + 0.01, ACTS.emptyEnd);
    const shake = Math.sin(p * 400) * 1.5 * (trashIn - trashOut);
    trash.style.opacity = String(trashIn * (1 - trashOut));
    trash.style.transform =
      `translate3d(-50%, ${lerp(30, 0, trashIn)}px, 0) rotate(${shake}deg) scale(${lerp(0.8, 1, trashIn)})`;

    // --- Act III: the document -------------------------------------------------
    const docP = span(p, ACTS.docStart, ACTS.pullBackStart);
    const pull = easeInOut(span(p, ACTS.pullBackStart, ACTS.docEnd));

    world.style.opacity = String(clamp01(span(p, ACTS.docStart - 0.01, ACTS.docStart + 0.03)));
    const worldScale = lerp(1, 0.42, pull);
    world.style.transform = `translate3d(-50%, -50%, 0) scale(${worldScale})`;
    world.style.setProperty('--gap', `${lerp(0, 420, pull)}px`);
    siblingL.style.opacity = String(pull);
    siblingR.style.opacity = String(pull);

    for (let i = 0; i < items.length; i += 1) {
      const item = items[i]!;
      const at = i / items.length;
      const t = easeOut(span(docP, at * 0.85, at * 0.85 + 0.16));
      item.style.opacity = String(t);
      item.style.transform = `translate3d(0, ${lerp(10, 0, t)}px, 0)`;
    }
  };
}
