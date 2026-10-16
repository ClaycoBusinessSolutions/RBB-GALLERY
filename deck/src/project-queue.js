/**
 * Finite project-card queues for presenter-controlled chapter transitions.
 * The parent deck owns the Osmo-inspired queue choreography and navigation;
 * this renderer only supplies accessible cards and a stable resting layout.
 */
const MARKET_DESCRIPTIONS = {
  'projects-civic': 'Residential, hospitality, education, sports and entertainment.',
  'projects-work': 'Commercial workplaces and corporate campuses.',
  'projects-care': 'Healthcare, life sciences and frontier research.',
  'projects-industry': 'Manufacturing, logistics, aerospace and digital infrastructure.',
};

export function mountProjectQueue(scene, { getProject, ready, onInspect } = {}) {
  const originals = [...scene.querySelectorAll('.project-collage button[data-project-id]')];
  const ids = [...new Set(originals.map(button => button.dataset.projectId))];
  if (!ids.length) return { getIds: () => [], activate() {}, pause() {}, destroy() {} };

  const fallback = new Map(originals.map(button => {
    const image = button.querySelector('img');
    const caption = button.querySelector('.project-caption,.seminal-projects__caption');
    const label = caption?.cloneNode(true);
    label?.querySelector('small')?.remove();
    return [button.dataset.projectId, {
      id: button.dataset.projectId,
      title: label?.textContent.trim() || button.getAttribute('aria-label') || 'Clayco project',
      image: image?.getAttribute('src') || '',
      location: caption?.querySelector('small')?.textContent.trim() || '',
      imageType: button.querySelector('.project-image-type')?.textContent.trim() || 'Photography',
    }];
  }));
  const record = id => getProject?.(id) || fallback.get(id);
  const controller = new AbortController();
  let enabled = false, destroyed = false;
  const originalStates = [...scene.querySelectorAll('.project-collage')]
    .map(element => ({ element, hidden: element.hidden, inert: element.inert }));
  originalStates.forEach(({ element }) => { element.hidden = true; element.inert = true; });
  const hadClass = scene.classList.contains('seminal-projects--queued');
  scene.classList.add('seminal-projects--queued');

  const root = document.createElement('div');
  root.className = 'project-queue';
  root.inert = true;
  root.setAttribute('role', 'region');
  root.setAttribute('aria-label', `${scene.dataset.label || 'Seminal projects'}: selected projects`);
  root.dataset.queueRows = String(Math.ceil(ids.length / 4));
  const description = document.createElement('p');
  description.className = 'project-queue__description';
  description.textContent = MARKET_DESCRIPTIONS[scene.dataset.compositionId] || 'Selected projects from across Clayco’s work.';
  const viewport = document.createElement('div');
  viewport.className = 'project-queue__viewport';
  const grid = document.createElement('div');
  grid.className = 'project-queue__grid';
  grid.style.setProperty('--queue-rows', Math.ceil(ids.length / 4));
  viewport.append(grid);
  root.append(description, viewport);
  scene.prepend(root);

  const cards = ids.map((id, index) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'project-queue__card';
    card.dataset.projectId = id;
    card.dataset.queueIndex = String(index);
    card.dataset.queueRow = String(Math.floor(index / 4));
    card.innerHTML = '<span class="project-queue__photo"><img alt="" decoding="async" draggable="false"><span class="project-queue__image-type" hidden></span></span><span class="project-queue__caption"><span class="project-queue__name"></span><span class="project-queue__location"></span><span class="project-queue__arrow" aria-hidden="true">↗</span></span>';
    card.addEventListener('click', event => {
      event.stopPropagation();
      if (enabled && !destroyed) onInspect?.(card);
    }, { signal: controller.signal });
    grid.append(card);
    return card;
  });

  function hydrate() {
    if (destroyed) return;
    ids.forEach((id, index) => {
      const project = record(id), card = cards[index];
      const image = card.querySelector('img');
      if (image.getAttribute('src') !== project.image) image.src = project.image || '';
      card.querySelector('.project-queue__name').textContent = project.shortTitle || project.title;
      card.querySelector('.project-queue__location').textContent = project.location || '';
      const badge = card.querySelector('.project-queue__image-type');
      badge.hidden = !project.imageType || /^photography$/i.test(project.imageType);
      badge.textContent = badge.hidden ? '' : project.imageType;
      card.setAttribute('aria-label', `View details: ${project.title}${project.location ? '. ' + project.location : ''}`);
    });
  }
  hydrate();
  Promise.resolve(ready).then(hydrate, () => {});

  return {
    getIds: () => [...ids],
    // The parent transition owns transforms. Activation must not replay or reset it.
    activate() { if (!destroyed) { enabled = true; root.inert = false; } },
    pause() { enabled = false; root.inert = true; },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      enabled = false;
      controller.abort();
      originalStates.forEach(({ element, hidden, inert }) => { element.hidden = hidden; element.inert = inert; });
      root.remove();
      if (!hadClass) scene.classList.remove('seminal-projects--queued');
    },
  };
}
