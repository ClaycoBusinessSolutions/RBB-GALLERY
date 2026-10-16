// Osmo Queued Scroll Reveal rhythm, advanced by the presentation's Next/Previous.
// One parent timeline owns the entire handoff; there are no scroll listeners.
const isMarket = scene => scene?.matches('.seminal-projects');
const isIntro = scene => scene?.dataset.compositionId === 'projects-intro';
export const isProjectSequence = (from, to) =>
  (isMarket(from) && (isMarket(to) || isIntro(to))) || (isIntro(from) && isMarket(to));

export function createProjectSequence(from, to, { direction = 1 } = {}) {
  const gsap = window.gsap;
  const timeline = gsap.timeline({ paused: true });
  const outgoing = [...from.querySelectorAll('.project-queue__card')];
  const incoming = [...to.querySelectorAll('.project-queue__card')];
  const incomingCopy = [...to.querySelectorAll('.eyebrow,h2,.project-queue__description')];
  const outgoingCopy = [...from.querySelectorAll('.eyebrow,h2,.project-queue__description')];
  const animated = [...outgoing, ...incoming, ...incomingCopy, ...outgoingCopy];
  let title;
  gsap.set(to, { opacity: 1 });

  if (isIntro(from) || isIntro(to)) {
    // The red introduction lifts away as the black project field opens beneath it.
    // Reversing restores that same sheet, rather than cutting to another effect.
    const intro = isIntro(from) ? from : to;
    const market = isIntro(from) ? to : from;
    const entering = isIntro(from);
    gsap.set(intro, { zIndex: 4 });
    gsap.set(market, { zIndex: 3 });
    timeline.fromTo(intro, { yPercent: entering ? 0 : -100 },
      { yPercent: entering ? -100 : 0, duration: 1.2, ease: 'power3.inOut', immediateRender: false }, 0);
    const introCopy = intro.querySelectorAll('.section-divider__copy,.placeholder-note');
    animated.push(...introCopy);
    timeline.fromTo(introCopy, { autoAlpha: entering ? 1 : 0, y: entering ? 0 : -30 },
      { autoAlpha: entering ? 0 : 1, y: entering ? -30 : 0, duration: .5, ease: 'power2.out' }, entering ? 0 : .65);

    // Carry the section title into its new role as the market's small upper label.
    const heading = intro.querySelector('h2'), label = market.querySelector('.eyebrow');
    if (heading && label) {
      const stage = intro.parentElement, stageBox = stage.getBoundingClientRect();
      const scale = stageBox.width / stage.offsetWidth;
      const a = heading.getBoundingClientRect(), b = label.getBoundingClientRect();
      title = document.createElement('span');
      title.className = 'project-sequence-title';
      title.textContent = 'Seminal projects';
      title.setAttribute('aria-hidden', 'true');
      Object.assign(title.style, { position: 'absolute', zIndex: '6', pointerEvents: 'none',
        left: `${(a.left + a.width / 2 - stageBox.left) / scale}px`,
        top: `${(a.top - stageBox.top) / scale}px`, width: '500px', marginLeft: '-250px',
        textAlign: 'center', fontSize: '32px', lineHeight: '1.25', color: 'var(--paper)' });
      stage.append(title);
      const dx = (b.left - (a.left + a.width / 2)) / scale + 250;
      const dy = (b.top - a.top) / scale;
      gsap.set(heading, { opacity: 0 });
      animated.push(heading);
      timeline.fromTo(title, { x: entering ? 0 : dx, y: entering ? 0 : dy, opacity: entering ? 1 : 0 },
        { x: entering ? dx : 0, y: entering ? dy : 0, opacity: entering ? 0 : 1,
          duration: 1.1, ease: 'power3.inOut' }, 0);
    }
  } else {
    // Advance an entire market (two or three rows), with a short tail on each card.
    timeline.to(outgoingCopy, { autoAlpha: 0, y: -direction * 35, duration: .36, stagger: .025, ease: 'power2.in' }, 0);
    timeline.to(direction > 0 ? outgoing : outgoing.slice().reverse(),
      { autoAlpha: 0, y: -direction * 120, duration: .48, stagger: .025, ease: 'power2.in' }, .04);
    // Let the outgoing cards remain visible while the next queue comes forward.
    timeline.fromTo(to, { opacity: 0 }, { opacity: 1, duration: .24, ease: 'none' }, .4);
  }

  if (incoming.length) {
    const start = isIntro(from) ? .45 : .48;
    timeline.fromTo(incomingCopy, { autoAlpha: 0, y: direction * 35 },
      { autoAlpha: 1, y: 0, duration: .75, stagger: .065, ease: 'expo.out' }, start);
    const cards = direction > 0 ? incoming : incoming.slice().reverse();
    // Source rhythm: 0.075s queue interval, 1.2s rise, expo.out, power1.out fade.
    timeline.fromTo(cards, { y: direction * 64 },
      { y: 0, duration: 1.2, stagger: .075, ease: 'expo.out' }, start + .1);
    timeline.fromTo(cards, { autoAlpha: 0 },
      { autoAlpha: 1, duration: 1.2, stagger: .075, ease: 'power1.out' }, start + .1);
  }

  return { timeline, finish() {
    title?.remove();
    gsap.set([from, to], { clearProps: 'transform' });
    gsap.set(animated, { clearProps: 'opacity,visibility,transform' });
  } };
}
