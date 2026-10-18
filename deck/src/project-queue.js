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
  const phone = matchMedia('(max-width: 900px)');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
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
  let phoneMotion = true, hintFrame = 0;
  const scrollHint = document.createElement('button');
  scrollHint.type = 'button';
  scrollHint.className = 'project-scroll-hint';
  scrollHint.hidden = true;
  scrollHint.setAttribute('aria-label', 'Scroll down for more projects');
  scrollHint.innerHTML = '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 4v16m-6-6 6 6 6-6"/></svg>';
  document.querySelector('#slide-navigation .slide-navigation__steps')?.before(scrollHint);
  function updateScrollHint() {
    hintFrame = 0;
    const more = phone.matches && enabled && activeScene?.classList.contains('active') &&
      root.scrollHeight - root.scrollTop - root.clientHeight > 16;
    scrollHint.hidden = !more;
    scrollHint.dataset.motion = phoneMotion && !reduced.matches && !document.hidden ? 'running' : 'paused';
  }
  function scheduleScrollHint() {
    if (!hintFrame) hintFrame = requestAnimationFrame(updateScrollHint);
  }
  scrollHint.addEventListener('click', () => {
    root.scrollBy({ top: root.clientHeight * .65,
      behavior: phoneMotion && !reduced.matches ? 'smooth' : 'instant' });
  }, { signal: controller.signal });
  root.addEventListener('scroll', scheduleScrollHint, { passive: true, signal: controller.signal });
  addEventListener('resize', scheduleScrollHint, { signal: controller.signal });
  document.addEventListener('visibilitychange', scheduleScrollHint, { signal: controller.signal });
  reduced.addEventListener('change', scheduleScrollHint, { signal: controller.signal });
  const observer = new ResizeObserver(scheduleScrollHint);
  observer.observe(root); observer.observe(track);

  for (const scene of scenes.filter(isMarket)) {
    scene.classList.add('seminal-projects--stream');
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
      card.innerHTML = '<span class="project-stream__photo"><img alt="" decoding="async" draggable="false"><span class="project-stream__image-type" hidden></span></span><span class="project-stream__caption"><span class="project-stream__name"></span><span class="project-stream__location"></span><span class="project-stream__arrow" aria-hidden="true"><svg class="line-arrow" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M5 19 19 5M6 5h13v13"/></svg></span></span>';
      card.addEventListener('click', event => {
        event.stopPropagation();
        if (enabled && !destroyed) onInspect?.(card);
      }, { signal: controller.signal });
      card.querySelector('img').loading = 'lazy';
      grid.append(card); cards.push(card);
    }
  }
  scenes.find(isMarket)?.prepend(root);
  const positions = new Map();
  const industry = groups.get('projects-industry');
  const industryGrid = industry.querySelector('.project-stream__grid');
  const industryPhotos = [...industryGrid.querySelectorAll('.project-stream__photo')];

  function measure() {
    for (const card of cards) {
      const group = card.closest('.project-stream__market');
      const grid = card.parentElement;
      positions.set(card, { top: group.offsetTop + grid.offsetTop + card.offsetTop, height: card.offsetHeight });
    }
  }
  function layoutFor(scene) {
    const photoHeight = industryPhotos[0].offsetWidth * .75;
    const rowGap = parseFloat(getComputedStyle(industryGrid).columnGap);
    if (scene?.dataset.compositionId !== 'projects-industry') return { photoHeight, rowGap };
    const rowCaptions = [];
    [...industryGrid.children].forEach((card, index) => {
      const row = Math.floor(index / 4);
      rowCaptions[row] = Math.max(rowCaptions[row] || 0, card.querySelector('.project-stream__caption').offsetHeight);
    });
    const rows = rowCaptions.length;
    const captions = rowCaptions.reduce((sum, height) => sum + height, 0);
    const available = root.clientHeight - 80 - industryGrid.offsetTop - 80;
    const naturalHeight = rows * photoHeight + captions + (rows - 1) * rowGap;
    const fit = Math.min(1, Math.max(.1, available / naturalHeight));
    const compactGap = rowGap * fit;
    return {
      photoHeight: Math.min(photoHeight, Math.max(1, (available - captions - (rows - 1) * compactGap) / rows)),
      rowGap: compactGap,
    };
  }
  function applyLayout(layout) {
    gsap.set(industryPhotos, { height: layout.photoHeight });
    gsap.set(industryGrid, { rowGap: layout.rowGap });
  }
  function hydrate(scene = activeScene) {
    if (destroyed) return;
    for (const card of cards) {
      const project = getProject?.(card.dataset.projectId) || fallback.get(card.dataset.projectId);
      const image = card.querySelector('img');
      // On phones, only the active market requests its images. Native lazy
      // loading then follows the scene's ordinary vertical scroll viewport.
      const load = !phone.matches || card.closest('.project-stream__market').dataset.market === scene?.dataset.compositionId;
      if (load && image.getAttribute('src') !== project.image) image.src = project.image;
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
  Promise.resolve(ready).then(() => hydrate(), () => {});
  gsap.set(cards, { autoAlpha: 0, y: 64 });

  function targetY(scene) {
    return 80 - groups.get(scene.dataset.compositionId).offsetTop;
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
  function phoneLayout(scene) {
    root.classList.add('project-stream--mobile');
    gsap.set(track, { clearProps: 'transform' });
    gsap.set(industryPhotos, { clearProps: 'height' });
    gsap.set(industryGrid, { clearProps: 'rowGap' });
    hydrate(scene);
    for (const section of groups.values()) {
      const selected = section.dataset.market === scene.dataset.compositionId;
      section.hidden = !selected;
      section.setAttribute('aria-hidden', String(!selected));
      section.querySelectorAll('.project-stream__card').forEach(card => {
        gsap.set(card, { autoAlpha: 1, y: 0 });
        card.inert = !selected; card.tabIndex = selected ? 0 : -1;
        card.setAttribute('aria-hidden', String(!selected));
      });
    }
  }
  function desktopLayout() {
    if (root.classList.contains('project-stream--mobile')) {
      root.scrollTop = 0;
      revealed.clear();
      gsap.set(cards, { autoAlpha: 0, y: 64 });
    }
    root.classList.remove('project-stream--mobile');
    scrollHint.hidden = true;
    for (const section of groups.values()) section.hidden = false;
  }
  function activate(scene, { motion = true } = {}) {
    phoneMotion = motion;
    if (destroyed || !isMarket(scene)) { pause(); return; }
    const changedScene = activeScene !== scene;
    activeScene = scene; mount(scene);
    if (phone.matches && changedScene) root.scrollTop = 0;
    if (phone.matches) {
      phoneLayout(scene); enabled = true; root.inert = false; scheduleScrollHint(); return;
    }
    desktopLayout(); hydrate(); applyLayout(layoutFor(scene)); measure();
    const y = targetY(scene);
    gsap.set(track, { y }); settleVisible(y); accessible(y);
    enabled = true; root.inert = false;
  }
  function pause() { enabled = false; root.inert = true; scrollHint.hidden = true; }
  async function prepare(scene) {
    if (!isMarket(scene)) return;
    await ready;
    if (phone.matches) { hydrate(scene); return; }
    // Decode the next market before it approaches the bottom edge.
    const section = groups.get(scene.dataset.compositionId);
    await Promise.allSettled([...section.querySelectorAll('img')].map(image => { image.loading = 'eager'; return image.decode(); }));
  }
  function transition(from, to) {
    if (phone.matches) return null;
    desktopLayout();
    const timeline = gsap.timeline({ paused: true });
    const intro = isIntro(from) ? from : isIntro(to) ? to : null;
    const market = isMarket(to) ? to : from;
    mount(market); pause();
    const viewport = root.clientHeight;
    const entering = isIntro(from), leaving = isIntro(to);
    const startLayout = layoutFor(from), endLayout = layoutFor(to);
    applyLayout(startLayout); measure();
    const startPositions = new Map(positions);
    const start = entering ? viewport : targetY(from);
    applyLayout(endLayout); measure();
    const endPositions = new Map(positions);
    const end = leaving ? viewport : targetY(to);
    applyLayout(startLayout);
    const duration = 2.15;
    const ease = gsap.parseEase('power2.inOut');
    gsap.set(track, { y: start });
    gsap.set([from, to], { opacity: 1 });
    timeline.to(track, { y: end, duration, ease: 'power2.inOut' }, 0);
    // Only ten frames change height. Keep columns and text fixed, and crop images
    // with object-fit rather than distorting them with a non-uniform scale.
    timeline.to(industryPhotos, { height: endLayout.photoHeight, duration, ease: 'power2.inOut' }, 0);
    timeline.to(industryGrid, { rowGap: endLayout.rowGap, duration, ease: 'power2.inOut' }, 0);
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
      const startBox = startPositions.get(card), endBox = endPositions.get(card);
      const startTop = startBox.top + start, endTop = endBox.top + end;
      if (endTop >= viewport || startTop + startBox.height <= 0) continue;
      let crossing = 0;
      if (startTop > endTop && startTop > viewport) {
        const progress = Math.max(0, Math.min(1, (startTop - viewport) / (startTop - endTop)));
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
      applyLayout(endLayout); measure();
      if (intro) gsap.set(intro, { clearProps: 'transform' });
      if (isMarket(to)) { activeScene = to; accessible(end); }
    } };
  }
  return {
    activate, pause, prepare, transition,
    getIds: () => cards.map(card => card.dataset.projectId),
    destroy() {
      destroyed = true; enabled = false; controller.abort(); observer.disconnect();
      cancelAnimationFrame(hintFrame); scrollHint.remove(); root.remove();
      scenes.forEach(scene => scene.classList.remove('seminal-projects--stream'));
    },
  };
}
