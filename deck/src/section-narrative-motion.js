/** A measured line cascade for the three red chapter introductions.
 * The original paragraph stays in flow and accessible. Temporary, aria-hidden
 * copies follow its actual wrapped lines, then disappear after the reveal.
 */
export function createSectionNarrativeMotion({ scenes = document.querySelectorAll('.section-divider') } = {}) {
  const chapters = new Set(scenes);
  const running = new Map();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const gsap = globalThis.gsap;
  let disposed = false;

  function restore(record) {
    if (!record) return;
    record.timeline?.kill();
    record.layer?.remove();
    if (record.source?.parentNode === record.copy) {
      record.source.replaceWith(...record.source.childNodes);
    }
    record.copy?.classList.remove('section-narrative--revealing');
    if (gsap) gsap.set([record.title, record.note].filter(Boolean), { clearProps: 'opacity,visibility,transform' });
    running.delete(record.scene);
  }

  function measuredLines(source) {
    const range = document.createRange();
    const walker = document.createTreeWalker(source, NodeFilter.SHOW_TEXT);
    const words = [];
    let node;
    while ((node = walker.nextNode())) {
      for (const match of node.textContent.matchAll(/\S+/g)) {
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        const box = range.getBoundingClientRect();
        if (box.width && box.height) words.push({ node, start: match.index, end: match.index + match[0].length, top: box.top });
      }
    }
    const lines = [];
    let first = null, last = null;
    const append = () => {
      if (!first || !last) return;
      range.setStart(first.node, first.start);
      range.setEnd(last.node, last.end);
      lines.push(range.toString().replace(/\s+/g, ' ').trim());
    };
    for (const word of words) {
      if (first && Math.abs(word.top - first.top) > 2) { append(); first = null; }
      first ||= word;
      last = word;
    }
    append();
    return lines;
  }

  function enter(scene, { motion = true, delay = .38 } = {}) {
    if (disposed || !chapters.has(scene)) return;
    restore(running.get(scene));
    if (!motion || reduced.matches || !gsap) return;
    const copy = scene.querySelector('.section-divider__copy');
    const title = scene.querySelector('h2');
    const note = scene.querySelector('.placeholder-note');
    // A hidden scene has no trustworthy line geometry; leave it readable.
    if (!copy || !copy.getBoundingClientRect().width) return;
    const source = document.createElement('span');
    source.className = 'section-narrative__source';
    source.append(...copy.childNodes);
    copy.append(source);
    const lines = measuredLines(source);
    if (!lines.length) { source.replaceWith(...source.childNodes); return; }
    const layer = document.createElement('span');
    layer.className = 'section-narrative__lines';
    layer.setAttribute('aria-hidden', 'true');
    const text = lines.map(line => {
      const mask = document.createElement('span');
      mask.className = 'section-narrative__line';
      const inner = document.createElement('span');
      inner.className = 'section-narrative__line-text';
      inner.textContent = line;
      mask.append(inner); layer.append(mask);
      return inner;
    });
    copy.append(layer);
    copy.classList.add('section-narrative--revealing');
    const record = { scene, copy, source, layer, title, note, timeline: null };
    running.set(scene, record);
    gsap.set(text, { opacity: 0, yPercent: 72 });
    if (title) gsap.set(title, { opacity: 0, y: 10 });
    if (note) gsap.set(note, { opacity: 0 });
    // Slightly overlap the line movements: clear top-to-bottom reading rhythm
    // without forcing the presenter to wait for a typewriter-length sequence.
    const stagger = lines.length > 10 ? .09 : .12;
    record.timeline = gsap.timeline({ onComplete: () => restore(record) });
    if (title) record.timeline.to(title, { opacity: 1, y: 0, duration: .72, ease: 'power3.out' }, delay);
    record.timeline.to(text, { opacity: 1, yPercent: 0, duration: .78, stagger, ease: 'power3.out' }, delay + .16);
    if (note) record.timeline.to(note, { opacity: 1, duration: .5, ease: 'power2.out' }, delay + .4 + (lines.length - 1) * stagger);
  }

  function leave(scene) { restore(running.get(scene)); }
  function pause() { for (const record of [...running.values()]) restore(record); }
  // Menu close / tab return must never restart the introduction mid-reading.
  function resume() {}
  function onResize() { pause(); }
  function onReducedMotion() { if (reduced.matches) pause(); }
  addEventListener('resize', onResize, { passive: true });
  reduced.addEventListener('change', onReducedMotion);
  document.fonts?.addEventListener('loadingdone', onResize);

  return {
    enter, leave, pause, resume,
    dispose() {
      disposed = true;
      pause();
      removeEventListener('resize', onResize);
      reduced.removeEventListener('change', onReducedMotion);
      document.fonts?.removeEventListener('loadingdone', onResize);
    }
  };
}
