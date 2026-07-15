import './style.css';
import { mountFilm } from './film';
import { clamp01, remapScroll } from './timeline';

const film = document.querySelector<HTMLElement>('#film')!;
const stage = document.querySelector<HTMLElement>('#stage')!;

const render = mountFilm(stage);

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (reduced) {
  // No scrub: show the third act, which is the argument. The chaos is a still.
  film.classList.add('film--static');
  render(1);
} else {
  let ticking = false;
  const update = (): void => {
    ticking = false;
    const rect = film.getBoundingClientRect();
    const scrollable = film.offsetHeight - window.innerHeight;
    const rawP = clamp01(-rect.top / Math.max(scrollable, 1));
    render(remapScroll(rawP));
  };

  const onScroll = (): void => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);
  update();
}
