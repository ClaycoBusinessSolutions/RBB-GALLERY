// The controls stay bare over an empty canvas. Only visible text or media
// crossing a control activates its feathered contrast veil.
export function mountMobileNavContrast({ nav, stage, phone }) {
  if (!nav || !stage) return { refresh() {}, dispose() {} };
  const controls = [...nav.querySelectorAll('#nav-menu,#nav-prev,#nav-next')];
  const events = new AbortController();
  const mediaSelector = 'img,video,canvas,svg';
  const ignored = 'script,style,noscript,template,[data-phone-exit-snapshot]';
  let frame = 0, disposed = false, dirty = true, scene = null, candidates = [];
  let intersections = [], observedKey = '', observedTargets = [];

  const rect = box => ({ left: box.left, top: box.top, right: box.right, bottom: box.bottom });
  const intersects = (a, b) => a.right > b.left && a.left < b.right && a.bottom > b.top && a.top < b.bottom;
  const intersect = (a, b) => ({ left: Math.max(a.left, b.left), top: Math.max(a.top, b.top), right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom) });
  const nonempty = box => box.right > box.left && box.bottom > box.top;

  function refresh() {
    if (!disposed && !frame) frame = requestAnimationFrame(measure);
  }
  function invalidate() { dirty = true; refresh(); }
  function clearIntersections() {
    intersections.forEach(observer => observer.disconnect());
    intersections = []; observedKey = ''; observedTargets = [];
  }
  const resize = new ResizeObserver(refresh);
  resize.observe(nav); resize.observe(stage);

  function collect(nextScene) {
    scene = nextScene; candidates = []; dirty = false;
    clearIntersections(); resize.disconnect(); resize.observe(nav); resize.observe(stage);
    if (!scene) return;
    resize.observe(scene);
    scene.querySelectorAll('.scene-inner,.project-stream,.project-stream__track').forEach(element => resize.observe(element));
    const walker = document.createTreeWalker(scene, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (node.matches(ignored)) return NodeFilter.FILTER_REJECT;
          // One SVG is one graphical candidate; do not count its hidden labels
          // or individual paths again. aria-hidden artwork still paints pixels.
          if (node.matches(mediaSelector)) return NodeFilter.FILTER_ACCEPT;
          return NodeFilter.FILTER_SKIP;
        }
        return node.textContent.trim() && !node.parentElement.closest(`${ignored},svg`)
          ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      },
    });
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.ELEMENT_NODE && node.parentElement.closest(mediaSelector)) continue;
      candidates.push({ node, element: node.nodeType === Node.TEXT_NODE ? node.parentElement : node });
    }
  }

  function watchMovement(boxes) {
    if (!window.IntersectionObserver) return;
    const key = boxes.map(box => [box.left, box.top, box.right, box.bottom].map(Math.round).join(',')).join('|');
    if (key === observedKey) return;
    clearIntersections(); observedKey = key;
    observedTargets = [...new Set(candidates.map(item => item.element))];
    // These small observation windows follow the three controls. CSS-animated
    // cover images notify us as they enter or leave, without a frame loop.
    for (const box of boxes) {
      const observer = new IntersectionObserver(refresh, {
        root: null,
        rootMargin: `${-box.top}px ${box.right - innerWidth}px ${box.bottom - innerHeight}px ${-box.left}px`,
        threshold: [0, .01],
      });
      observedTargets.forEach(element => observer.observe(element));
      intersections.push(observer);
    }
  }

  function measure() {
    frame = 0;
    const nextScene = [...stage.querySelectorAll('.scene.active')].find(element => !element.inert);
    const active = phone.matches && !document.hidden && !nav.hidden && !nav.inert &&
      !stage.closest('[inert]') && !stage.classList.contains('mobile-transitioning');
    if (dirty || nextScene !== scene) collect(nextScene);
    const hits = controls.map(() => false);
    if (active && scene) {
      const viewport = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
      const boxes = controls.map(control => {
        const box = control.getBoundingClientRect();
        // Start fading just before a glyph touches the icon, not across the
        // whole footer or the much larger feathered edge of the veil.
        return intersect({ left: box.left - 4, top: box.top - 4, right: box.right + 4, bottom: box.bottom + 4 }, viewport);
      });
      const styles = new Map(), boundaries = new Map();
      const styleFor = element => {
        if (!styles.has(element)) styles.set(element, getComputedStyle(element));
        return styles.get(element);
      };
      function boundary(element) {
        if (boundaries.has(element)) return boundaries.get(element);
        let clip = viewport;
        for (let parent = element; parent && parent !== stage.parentElement; parent = parent.parentElement) {
          const style = styleFor(parent);
          if (parent.hidden || style.display === 'none' || style.visibility !== 'visible' || Number(style.opacity) <= .02 ||
              (parent.matches('.scene') && (!parent.classList.contains('active') || parent.inert))) { clip = null; break; }
          if (parent !== element) {
            const clipsX = /hidden|clip|scroll|auto/.test(style.overflowX);
            const clipsY = /hidden|clip|scroll|auto/.test(style.overflowY);
            if (clipsX || clipsY) {
              const box = parent.getBoundingClientRect();
              clip = intersect(clip, { left: clipsX ? box.left : clip.left, right: clipsX ? box.right : clip.right,
                top: clipsY ? box.top : clip.top, bottom: clipsY ? box.bottom : clip.bottom });
              if (!nonempty(clip)) { clip = null; break; }
            }
          }
        }
        boundaries.set(element, clip); return clip;
      }
      for (const { node, element } of candidates) {
        if (!element.isConnected) continue;
        if (element.matches('img') && (!element.complete || !element.naturalWidth)) continue;
        const clip = boundary(element);
        if (!clip) continue;
        const outer = intersect(rect(element.getBoundingClientRect()), clip);
        if (!nonempty(outer) || !boxes.some((box, index) => !hits[index] && intersects(box, outer))) continue;
        let painted = [outer];
        if (node.nodeType === Node.TEXT_NODE) {
          const range = document.createRange(); range.selectNodeContents(node);
          painted = [...range.getClientRects()].map(box => intersect(rect(box), clip)).filter(nonempty);
        }
        boxes.forEach((box, index) => { if (!hits[index]) hits[index] = painted.some(area => intersects(box, area)); });
        if (hits.every(Boolean)) break;
      }
      watchMovement(boxes);
    } else clearIntersections();
    // Commit after every geometry/style read, keeping scroll handling batched.
    controls.forEach((control, index) => {
      const value = String(hits[index]);
      if (control.dataset.contentBehind !== value) control.dataset.contentBehind = value;
    });
  }

  const mutation = new MutationObserver(records => {
    if (records.some(record => record.type === 'childList' || record.type === 'characterData')) dirty = true;
    refresh();
  });
  mutation.observe(stage, { subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: ['class', 'hidden', 'inert', 'aria-hidden', 'src'] });
  // A menu may hide the footer without changing the active scene.
  const navMutation = new MutationObserver(refresh);
  navMutation.observe(nav, { attributes: true, attributeFilter: ['hidden', 'inert'] });
  stage.addEventListener('scroll', refresh, { capture: true, passive: true, signal: events.signal });
  stage.addEventListener('load', refresh, { capture: true, signal: events.signal });
  stage.addEventListener('transitionend', refresh, { capture: true, signal: events.signal });
  stage.addEventListener('animationend', refresh, { capture: true, signal: events.signal });
  window.addEventListener('resize', refresh, { passive: true, signal: events.signal });
  window.visualViewport?.addEventListener('resize', refresh, { passive: true, signal: events.signal });
  document.addEventListener('visibilitychange', refresh, { signal: events.signal });
  phone.addEventListener('change', invalidate, { signal: events.signal });
  document.fonts?.ready.then(refresh);
  refresh();
  return {
    refresh: invalidate,
    dispose() {
      disposed = true; cancelAnimationFrame(frame); events.abort(); mutation.disconnect(); navMutation.disconnect(); resize.disconnect();
      clearIntersections(); controls.forEach(control => delete control.dataset.contentBehind);
    },
  };
}
