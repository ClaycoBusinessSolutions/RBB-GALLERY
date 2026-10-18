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
  const shortLandscape = matchMedia('(max-height: 540px) and (orientation: landscape)');
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
  const phonePages = new Map(), phoneFirstCards = new Map();
  let phoneTween = null;

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
      card.innerHTML = '<span class="project-stream__photo"><img alt="" decoding="async" draggable="false"><span class="project-stream__image-type" hidden></span></span><span class="project-stream__caption"><span class="project-stream__name"></span><span class="project-stream__location"></span><span class="project-stream__arrow" aria-hidden="true">↗</span></span>';
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
  const phonePageSize = () => shortLandscape.matches ? 2 : 4;
  function finishPhoneTween() {
    const tween = phoneTween;
    if (!tween) return;
    tween.progress(1); tween.kill();
    if (phoneTween === tween) phoneTween = null;
  }
  function unwrapPhonePages(record) {
    for (const page of record.pages) for (const card of [...page.children]) record.grid.append(card);
    for (const page of record.pages) page.remove();
    record.count.remove();
    delete record.grid.dataset.phonePageSize;
  }
  function ensurePhonePages(section) {
    const id = section.dataset.market, size = phonePageSize();
    let record = phonePages.get(id);
    if (record?.size === size) return record;
    if (record) { unwrapPhonePages(record); phonePages.delete(id); }
    const grid = section.querySelector('.project-stream__grid');
    const items = [...grid.querySelectorAll('.project-stream__card')];
    const count = document.createElement('p');
    count.className = 'project-stream__page-count';
    count.setAttribute('aria-live', 'polite'); count.setAttribute('aria-atomic', 'true');
    section.insertBefore(count, grid);
    const pages = [];
    for (let first = 0; first < items.length; first += size) {
      const page = document.createElement('div');
      page.className = 'project-stream__phone-page';
      page.dataset.phonePage = String(pages.length);
      for (const card of items.slice(first, first + size)) page.append(card);
      grid.append(page); pages.push(page);
    }
    grid.dataset.phonePageSize = String(size);
    const index = Math.min(pages.length - 1, Math.floor((phoneFirstCards.get(id) || 0) / size));
    record = { id, grid, pages, count, size, total: items.length, index };
    phonePages.set(id, record);
    phoneFirstCards.set(id, index * size);
    return record;
  }
  function fitPhonePage(page) {
    const captions = [...page.querySelectorAll('.project-stream__caption')];
    for (const caption of captions) caption.style.removeProperty('--phone-caption-height');
    for (let index = 0; index < captions.length; index += 2) {
      const row = captions.slice(index, index + 2);
      const height = Math.max(...row.map(caption => caption.offsetHeight));
      for (const caption of row) caption.style.setProperty('--phone-caption-height', `${height}px`);
    }
  }
  function settlePhonePage(record) {
    record.pages.forEach((page, index) => {
      const selected = index === record.index;
      page.hidden = !selected; page.inert = !selected;
      page.setAttribute('aria-hidden', String(!selected));
      gsap.set(page, { clearProps: 'transform,opacity' });
      page.querySelectorAll('.project-stream__card').forEach(card => {
        card.inert = !selected; card.tabIndex = selected ? 0 : -1;
        card.setAttribute('aria-hidden', String(!selected));
      });
    });
    fitPhonePage(record.pages[record.index]);
    record.count.textContent = `${record.index + 1} / ${record.pages.length}`;
    record.count.setAttribute('aria-label', `Project page ${record.index + 1} of ${record.pages.length}`);
    root.dataset.phonePage = String(record.index + 1);
    root.dataset.phonePageCount = String(record.pages.length);
  }
  function setPhoneEntry(scene, direction = 1) {
    if (!phone.matches || !isMarket(scene)) return;
    finishPhoneTween();
    const id = scene.dataset.compositionId, section = groups.get(id), size = phonePageSize();
    const total = section.querySelectorAll('.project-stream__card').length;
    const first = direction < 0 ? Math.floor((total - 1) / size) * size : 0;
    phoneFirstCards.set(id, first);
    const record = phonePages.get(id);
    if (record) record.index = Math.floor(first / record.size);
  }
  function phoneLayout(scene) {
    finishPhoneTween();
    root.classList.add('project-stream--mobile', 'project-stream--paged');
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
      if (selected) settlePhonePage(ensurePhonePages(section));
    }
  }
  function stepPhone(delta, { motion = true } = {}) {
    if (!phone.matches || destroyed || !enabled || !isMarket(activeScene)) return false;
    finishPhoneTween();
    const section = groups.get(activeScene.dataset.compositionId);
    const record = ensurePhonePages(section), direction = Math.sign(delta);
    if (!direction) return false;
    const next = record.index + direction;
    if (next < 0 || next >= record.pages.length) return false;
    const outgoing = record.pages[record.index], incoming = record.pages[next];
    record.index = next; phoneFirstCards.set(record.id, next * record.size);
    record.count.textContent = `${next + 1} / ${record.pages.length}`;
    record.count.setAttribute('aria-label', `Project page ${next + 1} of ${record.pages.length}`);
    if (!motion || reduced.matches || document.hidden) { settlePhonePage(record); return true; }
    incoming.hidden = false;
    for (const image of incoming.querySelectorAll('img')) image.loading = 'eager';
    fitPhonePage(incoming);
    outgoing.inert = true; incoming.inert = true;
    incoming.setAttribute('aria-hidden', 'true');
    const tween = gsap.timeline({ onComplete: () => {
      settlePhonePage(record);
      if (phoneTween === tween) phoneTween = null;
    } });
    phoneTween = tween;
    tween.fromTo(incoming, { yPercent: direction * 108 }, { yPercent: 0, duration: 1.15, ease: 'power3.inOut' }, 0);
    tween.to(outgoing, { yPercent: -direction * 108, duration: 1.15, ease: 'power3.inOut' }, 0);
    return true;
  }
  function desktopLayout() {
    finishPhoneTween();
    root.classList.remove('project-stream--mobile', 'project-stream--paged');
    if (phonePages.size) {
      for (const record of phonePages.values()) unwrapPhonePages(record);
      phonePages.clear(); revealed.clear();
      for (const card of cards) card.querySelector('.project-stream__caption').style.removeProperty('--phone-caption-height');
      gsap.set(cards, { autoAlpha: 0, y: 64 });
    }
    for (const section of groups.values()) section.hidden = false;
  }
  function activate(scene) {
    if (destroyed || !isMarket(scene)) { pause(); return; }
    activeScene = scene; mount(scene);
    if (phone.matches) {
      phoneLayout(scene); enabled = true; root.inert = false; return;
    }
    desktopLayout(); hydrate(); applyLayout(layoutFor(scene)); measure();
    const y = targetY(scene);
    gsap.set(track, { y }); settleVisible(y); accessible(y);
    enabled = true; root.inert = false;
  }
  function pause() { finishPhoneTween(); enabled = false; root.inert = true; }
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
    activate, pause, prepare, transition, stepPhone, setPhoneEntry,
    getIds: () => cards.map(card => card.dataset.projectId),
    destroy() {
      finishPhoneTween(); destroyed = true; enabled = false; controller.abort(); root.remove();
      scenes.forEach(scene => scene.classList.remove('seminal-projects--stream'));
    },
  };
}
