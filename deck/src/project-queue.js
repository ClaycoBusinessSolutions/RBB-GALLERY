/** One continuous Osmo-style project stream. Deck keys move its viewport. */
const isMarket = scene => scene?.matches('.seminal-projects');
const isIntro = scene => scene?.dataset.compositionId === 'projects-intro';
const TITLES = {
  'projects-civic': 'Life and community',
  'projects-work': 'Work and connection',
  'projects-care': 'Care and discovery',
  'projects-industry': 'Industry and infrastructure',
};

export function mountProjectStream(scenes, { getProject, ready, onInspect } = {}) {
  const gsap = window.gsap;
  const root = document.createElement('div');
  root.className = 'project-stream';
  root.inert = true;
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', 'Seminal projects');
  const track = document.createElement('div');
  track.className = 'project-stream__track';
  root.append(track);
  const groups = new Map(), cards = [], fallback = new Map(), revealed = new Set();
  const controller = new AbortController();
  let activeScene = null, enabled = false, destroyed = false;

  for (const scene of scenes.filter(isMarket)) {
    scene.classList.add('seminal-projects--stream');
    if (scene.dataset.projectContinuation) continue;
    const originals = [...scene.querySelectorAll('.project-collage button[data-project-id]')];
    const ids = [...new Set(originals.map(button => button.dataset.projectId))];
    const section = document.createElement('section');
    section.className = 'project-stream__market';
    section.dataset.market = scene.dataset.compositionId;
    const heading = document.createElement('h2');
    heading.className = 'project-stream__title';
    heading.textContent = TITLES[scene.dataset.compositionId] || scene.dataset.label;
    const grid = document.createElement('div');
    grid.className = 'project-stream__grid';
    section.append(heading, grid);
    track.append(section);
    groups.set(scene.dataset.compositionId, section);
    for (const id of ids) {
      const original = originals.find(button => button.dataset.projectId === id);
      fallback.set(id, {
        id, title: original.querySelector('.project-caption')?.textContent.trim() || id,
        image: original.querySelector('img')?.getAttribute('src') || '',
        imageType: original.querySelector('.project-image-type')?.textContent || 'Photography',
      });
      const card = document.createElement('button');
      card.type = 'button'; card.className = 'project-stream__card'; card.dataset.projectId = id;
      card.innerHTML = '<span class="project-stream__photo"><img alt="" decoding="async" draggable="false"><span class="project-stream__image-type" hidden></span></span><span class="project-stream__caption"><span class="project-stream__name"></span><span class="project-stream__location"></span><span class="project-stream__arrow" aria-hidden="true">↗</span></span>';
      card.addEventListener('click', event => {
        event.stopPropagation();
        if (enabled && !destroyed) onInspect?.(card);
      }, { signal: controller.signal });
      grid.append(card); cards.push(card);
    }
  }
  scenes.find(isMarket)?.prepend(root);
  const positions = new Map();

  function measure() {
    for (const card of cards) {
      const group = card.closest('.project-stream__market');
      const grid = card.parentElement;
      positions.set(card, { top: group.offsetTop + grid.offsetTop + card.offsetTop, height: card.offsetHeight });
    }
  }
  function hydrate() {
    if (destroyed) return;
    for (const card of cards) {
      const project = getProject?.(card.dataset.projectId) || fallback.get(card.dataset.projectId);
      const image = card.querySelector('img');
      if (image.getAttribute('src') !== project.image) image.src = project.image;
      card.querySelector('.project-stream__name').textContent = project.shortTitle || project.title;
      card.querySelector('.project-stream__location').textContent = project.location || '';
      const badge = card.querySelector('.project-stream__image-type');
      badge.hidden = !project.imageType || /^photography$/i.test(project.imageType);
      badge.textContent = badge.hidden ? '' : project.imageType;
      card.setAttribute('aria-label', `View details: ${project.title}${project.location ? '. ' + project.location : ''}`);
    }
    measure();
  }
  hydrate();
  Promise.resolve(ready).then(hydrate, () => {});
  gsap.set(cards, { autoAlpha: 0, y: 64 });

  function targetY(scene) {
    const group = groups.get(scene.dataset.projectContinuation || scene.dataset.compositionId);
    // A final stop exposes the third industrial row at the same image size.
    const grid = group.querySelector('.project-stream__grid');
    const continuation = scene.dataset.projectContinuation ? grid.offsetTop + (grid.children[4]?.offsetTop || 0) : 0;
    return 80 - group.offsetTop - continuation;
  }
  function mount(scene) { if (root.parentElement !== scene) scene.prepend(root); }
  function settleVisible(y) {
    const height = root.clientHeight;
    for (const card of cards) {
      const box = positions.get(card), top = box.top + y;
      if (top < height) { revealed.add(card); gsap.set(card, { autoAlpha: 1, y: 0 }); }
    }
  }
  function accessible(y) {
    const height = root.clientHeight;
    for (const card of cards) {
      const box = positions.get(card), top = box.top + y;
      const visible = top + box.height > 30 && top < height - 60;
      card.inert = !visible;
      card.tabIndex = visible ? 0 : -1;
      card.setAttribute('aria-hidden', String(!visible));
    }
    for (const section of groups.values()) {
      const top = section.offsetTop + y;
      section.setAttribute('aria-hidden', String(top + section.offsetHeight < 0 || top > height));
    }
  }
  function activate(scene) {
    if (destroyed || !isMarket(scene)) { pause(); return; }
    activeScene = scene; mount(scene); measure();
    const y = targetY(scene);
    gsap.set(track, { y }); settleVisible(y); accessible(y);
    enabled = true; root.inert = false;
  }
  function pause() { enabled = false; root.inert = true; }
  async function prepare(scene) {
    if (!isMarket(scene)) return;
    await ready;
    // Decode the next market before it approaches the bottom edge.
    const section = groups.get(scene.dataset.projectContinuation || scene.dataset.compositionId);
    await Promise.allSettled([...section.querySelectorAll('img')].map(image => image.decode()));
  }
  function transition(from, to) {
    const timeline = gsap.timeline({ paused: true });
    const intro = isIntro(from) ? from : isIntro(to) ? to : null;
    const market = isMarket(to) ? to : from;
    mount(market); measure(); pause();
    const viewport = root.clientHeight;
    const entering = isIntro(from), leaving = isIntro(to);
    const start = entering ? viewport : targetY(from);
    const end = leaving ? viewport : targetY(to);
    const duration = 2.15;
    const ease = gsap.parseEase('power2.inOut');
    gsap.set(track, { y: start });
    gsap.set([from, to], { opacity: 1 });
    timeline.to(track, { y: end, duration, ease: 'power2.inOut' }, 0);
    if (intro) {
      gsap.set(market, { zIndex: 3 });
      gsap.set(intro, { zIndex: 4 });
      timeline.fromTo(intro, { y: entering ? 0 : -viewport },
        { y: entering ? -viewport : 0, duration, ease: 'power2.inOut', immediateRender: false }, 0);
    }
    // This is the source reveal queue; the moving track substitutes for native
    // scrolling. Old cards never fade/reset. New cards reveal at the bottom edge.
    let lastStart = -Infinity;
    for (const card of cards) {
      if (revealed.has(card)) continue;
      const { top, height } = positions.get(card);
      if (top + end >= viewport || top + start + height <= 0) continue;
      let crossing = 0;
      if (start > end && top + start > viewport) {
        const progress = Math.max(0, Math.min(1, (top + start - viewport) / (start - end)));
        let low = 0, high = 1;
        for (let i = 0; i < 20; i++) { const mid = (low + high) / 2; if (ease(mid) < progress) low = mid; else high = mid; }
        crossing = high * duration;
      }
      const at = Math.max(crossing + .1, lastStart + .075);
      lastStart = at; revealed.add(card);
      timeline.to(card, { autoAlpha: 1, duration: 1.2, ease: 'power1.out' }, at);
      timeline.to(card, { y: 0, duration: 1.2, ease: 'expo.out' }, at);
    }
    return { timeline, finish() {
      gsap.set(track, { y: end });
      if (intro) gsap.set(intro, { clearProps: 'transform' });
      if (isMarket(to)) { activeScene = to; accessible(end); }
    } };
  }
  return {
    activate, pause, prepare, transition,
    getIds: () => cards.map(card => card.dataset.projectId),
    destroy() {
      destroyed = true; enabled = false; controller.abort(); root.remove();
      scenes.forEach(scene => scene.classList.remove('seminal-projects--stream'));
    },
  };
}
