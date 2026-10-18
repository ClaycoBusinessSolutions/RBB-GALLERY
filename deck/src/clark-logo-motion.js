/* Keep the official lettering still while a quiet highlight travels over its frame. */
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
  let frameBase = null;
  let frameTrace = null;
  let animations = [];
  let entered = false;
  let wantsMotion = true;
  let paused = false;
  let disposed = false;
  let unavailable = false;

  function settle() {
    animations.forEach(animation => animation.cancel());
    animations = [];
    image.style.opacity = originalOpacity;
    if (overlay) overlay.hidden = true;
    host.dataset.logoMotion = 'settled';
  }

  function syncPlayback() {
    if (!animations.length) return;
    const shouldPause = doc.hidden || paused;
    animations.forEach(animation => {
      // A completed entry fade must not rewind when returning from the menu.
      if (animation.playState !== 'finished') shouldPause ? animation.pause() : animation.play();
    });
    host.dataset.logoMotion = shouldPause ? 'paused' : 'running';
  }

  function start() {
    if (!entered || disposed || !overlay || !wantsMotion || reduced.matches || unavailable) return;
    if (animations.length) {
      syncPlayback();
      return;
    }

    image.style.opacity = '0';
    overlay.hidden = false;
    // The original frame remains present throughout. A narrow, feathered light
    // passes over it, then rests outside the artwork before a seamless restart.
    animations = [
      frameBase.animate([{ opacity: 1 }, { opacity: 0.52 }], {
        duration: 1100, easing: 'ease-out', fill: 'both'
      }),
      frameTrace.animate([
        { transform: 'translateX(-160px)', offset: 0 },
        { transform: 'translateX(564px)', offset: 0.8 },
        { transform: 'translateX(564px)', offset: 1 }
      ], { duration: 8800, iterations: Infinity, easing: 'linear' })
    ];
    syncPlayback();
  }

  const ready = (async () => {
    try {
      const response = await fetch(image.currentSrc || image.src, { signal: abort.signal });
      if (!response.ok) throw new Error('Logo artwork unavailable');
      const source = new view.DOMParser().parseFromString(await response.text(), 'image/svg+xml');
      const svg = source.documentElement;
      if (disposed) return false;
      if (svg.localName !== 'svg' || svg.querySelector('parsererror')) throw new Error('Invalid logo artwork');

      // The derived transparent asset holds the untouched source geometry in its
      // luminance mask. Reading the original asset is supported as a fallback.
      const artwork = svg.querySelector('[data-clark-source]') || svg;
      const paths = [...artwork.children].filter(child => child.localName === 'path');
      const originalFrame = paths.find(path => path.hasAttribute('stroke'));
      const letters = paths.filter(path => !path.hasAttribute('stroke') && path.getAttribute('fill') === 'white');
      if (!originalFrame || !letters.length) throw new Error('Unrecognized logo artwork');

      function element(name, attributes = {}) {
        const node = doc.createElementNS(SVG_NS, name);
        Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, value));
        return node;
      }
      const id = ++nextLogoId;
      const maskId = `clark-frame-${id}`;
      const gradientId = `clark-frame-light-${id}`;
      const animatedSvg = element('svg', {
        viewBox: svg.getAttribute('viewBox'), fill: 'none',
        'aria-hidden': 'true', focusable: 'false', preserveAspectRatio: 'xMidYMid meet'
      });
      const defs = element('defs');
      const mask = element('mask', {
        id: maskId, x: 0, y: 0, width: 404, height: 118,
        maskUnits: 'userSpaceOnUse', style: 'mask-type:luminance'
      });
      paths.filter(path => path.hasAttribute('stroke') || path.getAttribute('fill') !== 'white')
        .forEach(path => mask.append(doc.importNode(path, true)));
      const gradient = element('linearGradient', { id: gradientId, x1: 0, x2: 1, y1: 0, y2: 0 });
      [ [0, 0], [0.45, 1], [0.55, 1], [1, 0] ].forEach(([offset, opacity]) => {
        gradient.append(element('stop', { offset, 'stop-color': 'white', 'stop-opacity': opacity }));
      });
      defs.append(mask, gradient);
      const frame = element('g', { mask: `url(#${maskId})` });
      frame.classList.add('clark-logo-motion__frame');
      frameBase = element('rect', { width: 404, height: 118, fill: 'white' });
      frameBase.classList.add('clark-logo-motion__frame-base');
      frameTrace = element('rect', { x: -80, y: 0, width: 160, height: 118, fill: `url(#${gradientId})` });
      frameTrace.classList.add('clark-logo-motion__frame-trace');
      frame.append(frameBase, frameTrace);
      const lettering = element('g');
      lettering.classList.add('clark-logo-motion__lettering');
      letters.forEach(path => lettering.append(doc.importNode(path, true)));
      animatedSvg.append(defs, frame, lettering);

      overlay = doc.createElement('span');
      overlay.className = 'clark-logo-motion__overlay';
      overlay.setAttribute('aria-hidden', 'true');
      overlay.hidden = true;
      overlay.append(animatedSvg);
      wrapper.append(overlay);
      start();
      return true;
    } catch {
      unavailable = true;
      if (!disposed) settle();
      return false;
    }
  })();

  function visibilityChanged() {
    if (entered) syncPlayback();
  }
  function motionPreferenceChanged() {
    if (reduced.matches) settle();
    else start();
  }
  doc.addEventListener('visibilitychange', visibilityChanged);
  reduced.addEventListener('change', motionPreferenceChanged);

  return {
    ready,
    enter({ motion = true } = {}) {
      if (disposed) return;
      const wasEntered = entered;
      entered = true;
      wantsMotion = motion;
      if (!wasEntered) paused = false;
      if (!motion || reduced.matches || unavailable) {
        settle();
        return;
      }
      if (overlay) start();
      else host.dataset.logoMotion = 'pending';
    },
    leave() {
      entered = false;
      paused = false;
      settle();
    },
    pause() {
      paused = true;
      syncPlayback();
    },
    resume() {
      paused = false;
      start();
    },
    setMotion(enabled) {
      wantsMotion = enabled !== false;
      if (!wantsMotion || reduced.matches) settle();
      else start();
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
