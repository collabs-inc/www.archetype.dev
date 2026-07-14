import { CODA, ESSAY, type EssayBlock } from './copy';

/** Renders a copy slot, or a loud placeholder when it hasn't been written yet. */
function slot(text: string, hint: string): { text: string; empty: boolean } {
  return text === '' ? { text: `[ ${hint} ]`, empty: true } : { text, empty: false };
}

function renderBlock(block: EssayBlock, i: number): HTMLElement {
  if (block.kind === 'agent') {
    const el = document.createElement('div');
    el.className = 'chip chip--essay';
    const label = slot(block.label, `agent ${i} label`);
    el.classList.add(`chip--${block.status}`);
    if (label.empty) el.classList.add('is-empty');
    el.innerHTML = '<span class="chip__dot"></span><span class="chip__label"></span>';
    el.querySelector('.chip__label')!.textContent = label.text;
    return el;
  }

  const tag = block.kind === 'heading' ? 'h2' : block.kind === 'quote' ? 'blockquote' : 'p';
  const el = document.createElement(tag);
  el.className = `essay__${block.kind}`;
  const { text, empty } = slot(block.text, `${block.kind} ${i}`);
  if (empty) el.classList.add('is-empty');
  el.textContent = text;
  return el;
}

export function mountEssay(root: HTMLElement): void {
  const article = document.createElement('article');
  article.className = 'essay';
  ESSAY.forEach((block, i) => article.append(renderBlock(block, i)));

  const coda = document.createElement('footer');
  coda.className = 'coda';
  const line = document.createElement('p');
  const lineSlot = slot(CODA.line, 'closing line');
  if (lineSlot.empty) line.classList.add('is-empty');
  line.textContent = lineSlot.text;

  const link = document.createElement('a');
  const linkSlot = slot(CODA.linkText, 'link text');
  if (linkSlot.empty) link.classList.add('is-empty');
  link.textContent = linkSlot.text;
  link.href = CODA.linkHref;

  coda.append(line, link);
  root.append(article, coda);
}
