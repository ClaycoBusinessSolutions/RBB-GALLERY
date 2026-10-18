/* Reveal the official artwork without redrawing its lettering or changing its layout. */
const SVG_NS = 'http://www.w3.org/2000/svg';
let nextLogoId = 0;

export function createClarkLogoMotion(host) {
  const image = host?.querySelector('img');
  if (!image) return { enter() {}, leave() {}, pause() {}, resume() {}, setMotion() {}, settle() {}, dispose() {}, ready: Promise.resolve(false) };

  const doc = host.ownerDocument;
  const view = doc.defaultView;
  const reduced = view.matchMedia('(prefers-reduced-motion: reduce)');
  const abort = new AbortController();
  const wrapper = doc.createElement('span');
  wrapper.className = 'clark-logo-motion';
  image.before(wrapper);
  wrapper.append(image);

  const originalOpacity = image.style.opacity;
  let overlay = null;
  let frame = null;
  let lettering = null;
  let animations = [];
  let entered = false;
  let wantsMotion = true;
  let paused = false;
  let disposed = false;
  let unavailable = false;
  let generation = 0;

  function settle() {
    generation += 1;
    animations.forEach(animation => animation.cancel());
    animations = [];
    image.style.opacity = originalOpacity;
    if (overlay) overlay.hidden = true;
    host.dataset.logoMotion = 'settled';
  }

  function start() {
    if (!entered || disposed || !overlay || !wantsMotion || reduced.matches) return;
    settle();
    const run = ++generation;
    image.style.opacity = '0';
    overlay.hidden = false;
    host.dataset.logoMotion = 'running';

    // The frame opens first; the original lettering then rises gently into it.
    animations = [
      frame.animate([
        { clipPath: 'inset(0 100% 0 0)', opacity: 0.4 },
        { clipPath: 'inset(0 0% 0 0)', opacity: 1 }
      ], { duration: 1250, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' }),
      lettering.animate([
        { transform: 'translateY(13px)', opacity: 0 },
        { transform: 'translateY(0)', opacity: 1 }
      ], { duration: 1280, delay: 480, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' })
    ];
    if (doc.hidden || paused) animations.forEach(animation => animation.pause());
    Promise.all(animations.map(animation => animation.finished)).then(() => {
      if (!disposed && generation === run) settle();
    }).catch(() => {}); // Leaving the slide deliberately cancels the entry.
  }

  const ready = (async () => {
    try {
      const response = await fetch(image.currentSrc || image.src, { signal: abort.signal });
      if (!response.ok) throw new Error('Logo artwork unavailable');
      const source = new view.DOMParser().parseFromString(await response.text(), 'image/svg+xml');
      const svg = source.documentElement;
      if (disposed) return false;
      if (svg.localName !== 'svg' || svg.querySelector('parsererror')) throw new Error('Invalid logo artwork');

      // Keep every original path: the framed asset has one stroked frame path,
      // two black registration corrections, and white letter paths.
      const paths = [...svg.querySelectorAll(':scope > path')];
      const originalFrame = paths.find(path => path.hasAttribute('stroke'));
      const letters = paths.filter(path => !path.hasAttribute('stroke') && path.getAttribute('fill') === 'white');
      if (!originalFrame || !letters.length) throw new Error('Unrecognized logo artwork');

      const animatedSvg = doc.importNode(svg, true);
      animatedSvg.setAttribute('aria-hidden', 'true');
      animatedSvg.setAttribute('focusable', 'false');
      animatedSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      animatedSvg.removeAttribute('id');
      const copiedPaths = [...animatedSvg.querySelectorAll(':scope > path')];
      frame = doc.createElementNS(SVG_NS, 'g');
      frame.classList.add('clark-logo-motion__frame');
      lettering = doc.createElementNS(SVG_NS, 'g');
      lettering.classList.add('clark-logo-motion__lettering');
      copiedPaths.forEach(path => {
        (path.hasAttribute('stroke') || path.getAttribute('fill') !== 'white' ? frame : lettering).append(path);
      });

      const defs = doc.createElementNS(SVG_NS, 'defs');
      const clip = doc.createElementNS(SVG_NS, 'clipPath');
      const clipId = `clark-logo-lettering-${++nextLogoId}`;
      clip.id = clipId;
      clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
      const rect = doc.createElementNS(SVG_NS, 'rect');
      Object.entries({ x: 24, y: 38, width: 356, height: 42 }).forEach(([key, value]) => rect.setAttribute(key, value));
      clip.append(rect);
      defs.append(clip);
      const letteringWindow = doc.createElementNS(SVG_NS, 'g');
      letteringWindow.setAttribute('clip-path', `url(#${clipId})`);
      letteringWindow.append(lettering);
      animatedSvg.append(defs, frame, letteringWindow);

      overlay = doc.createElement('span');
      overlay.className = 'clark-logo-motion__overlay';
      overlay.setAttribute('aria-hidden', 'true');
      overlay.hidden = true;
      overlay.append(animatedSvg);
      wrapper.append(overlay);
      if (entered && wantsMotion && !reduced.matches) start();
      return true;
    } catch {
      unavailable = true;
      if (!disposed) settle();
      return false;
    }
  })();

  function visibilityChanged() {
    if (!entered) return;
    animations.forEach(animation => doc.hidden || paused ? animation.pause() : animation.play());
  }
  function motionPreferenceChanged() {
    if (reduced.matches) settle();
  }
  doc.addEventListener('visibilitychange', visibilityChanged);
  reduced.addEventListener('change', motionPreferenceChanged);

  return {
    ready,
    enter({ motion = true } = {}) {
      if (disposed) return;
      wantsMotion = motion;
      if (!motion || reduced.matches || unavailable) {
        entered = true;
        settle();
        return;
      }
      if (entered) return; // Refreshes and resizes must not replay the logo.
      entered = true;
      paused = false;
      if (overlay) start();
      else {
        // Keep the original readable while the optional animation asset loads.
        image.style.opacity = originalOpacity;
        host.dataset.logoMotion = 'pending';
      }
    },
    leave() {
      entered = false;
      paused = false;
      settle();
    },
    pause() {
      paused = true;
      animations.forEach(animation => animation.pause());
    },
    resume() {
      paused = false;
      if (entered && wantsMotion && !doc.hidden) animations.forEach(animation => animation.play());
    },
    setMotion(enabled) {
      wantsMotion = enabled !== false;
      if (!wantsMotion || reduced.matches) settle();
    },
    settle,
    dispose() {
      if (disposed) return;
      disposed = true;
      entered = false;
      abort.abort();
      settle();
      doc.removeEventListener('visibilitychange', visibilityChanged);
      reduced.removeEventListener('change', motionPreferenceChanged);
      wrapper.replaceWith(image);
      delete host.dataset.logoMotion;
    }
  };
}
