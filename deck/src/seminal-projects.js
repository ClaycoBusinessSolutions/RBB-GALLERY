/** Source-backed details layered over the continuous project stream. */
import { mountProjectStream } from './project-queue.js?v=de5c49ac8812090e1b07';
const SELECTORS = { button: 'button[data-project-id]' };

export function createSeminalProjects({ onOpen, onClose } = {}) {
  const controller = new AbortController();
  const { signal } = controller;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let stream;
  let activeScene = null, motion = true, destroyed = false;
  let projectMap = new Map(), loadError = false, returnFocus = null;
  let dialogIds = [], dialogIndex = 0, viewGeneration = 0, currentProject = null;

  const ready = fetch('assets/projects/projects.json', { signal })
    .then(response => { if (!response.ok) throw new Error(`Project manifest: ${response.status}`); return response.json(); })
    .then(data => { projectMap = new Map((Array.isArray(data) ? data : data.projects || []).map(project => [project.id, project])); })
    .catch(error => { if (error.name !== 'AbortError') { loadError = true; console.warn('Seminal project details unavailable.', error); } });

  const dialog = document.createElement('dialog');
  dialog.className = 'seminal-project-dialog';
  dialog.setAttribute('aria-labelledby', 'seminal-project-title');
  dialog.innerHTML = `
    <div class="seminal-project-dialog__bar">
      <p>SEMINAL PROJECTS</p>
      <button type="button" class="seminal-project-dialog__close" aria-label="Close project details">Close <span aria-hidden="true">×</span></button>
    </div>
    <div class="seminal-project-dialog__body">
      <figure class="seminal-project-dialog__figure"><img alt=""><figcaption></figcaption></figure>
      <div class="seminal-project-dialog__copy">
        <p class="seminal-project-dialog__location"></p>
        <h2 id="seminal-project-title"></h2>
        <p class="seminal-project-dialog__meaning"></p>
        <p class="seminal-project-dialog__scope"></p>
        <a class="seminal-project-dialog__source" target="_blank" rel="noopener noreferrer">View project on Clayco <span aria-hidden="true"><svg class="line-arrow" width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"><path d="M5 19 19 5M6 5h13v13"/></svg></span></a>
        <div class="seminal-project-dialog__members" aria-label="Projects in this group" hidden></div>
      </div>
    </div>
    <div class="seminal-project-dialog__navigation">
      <button type="button" data-project-direction="-1" aria-label="Previous project">← Previous</button>
      <p class="seminal-project-dialog__count" aria-live="polite"></p>
      <button type="button" data-project-direction="1" aria-label="Next project">Next →</button>
    </div>`;
  document.body.append(dialog);
  const closeButton = dialog.querySelector('.seminal-project-dialog__close');
  const image = dialog.querySelector('img');
  const caption = dialog.querySelector('figcaption');
  const title = dialog.querySelector('h2');
  const location = dialog.querySelector('.seminal-project-dialog__location');
  const meaning = dialog.querySelector('.seminal-project-dialog__meaning');
  const scope = dialog.querySelector('.seminal-project-dialog__scope');
  const source = dialog.querySelector('.seminal-project-dialog__source');
  const members = dialog.querySelector('.seminal-project-dialog__members');
  const count = dialog.querySelector('.seminal-project-dialog__count');

  function setSource(url) {
    // Project links are evidence, and all expected sources are the public Clayco site.
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || !/(^|\.)claycorp\.com$/.test(parsed.hostname)) throw new Error('Unsupported source');
      source.href = parsed.href;
      source.hidden = false;
    } catch { source.removeAttribute('href'); source.hidden = true; }
  }
  function showImage(record) {
    // A member without photography may use the overview image, but its caption
    // must continue to identify the project actually pictured.
    const pictured = record.image ? record : currentProject;
    image.src = pictured?.image || '';
    image.alt = pictured?.title || 'Clayco project';
    caption.textContent = [pictured?.title, pictured?.imageType].filter(Boolean).join(' / ');
    setSource(record.url || currentProject?.url);
  }
  function showDetails(record) {
    title.textContent = record.title || '';
    location.textContent = record.location || '';
    location.hidden = !record.location;
    meaning.textContent = record.significance || '';
    meaning.hidden = !record.significance;
    scope.textContent = record.scope || '';
    scope.hidden = !record.scope;
    showImage(record);
  }
  function fallbackProject(id) {
    const button = [...document.querySelectorAll(SELECTORS.button)].find(item => item.dataset.projectId === id);
    return { id, title: button?.getAttribute('aria-label') || button?.textContent.trim() || 'Project', image: button?.querySelector('img')?.getAttribute('src'), scope: loadError ? 'Project details are unavailable. Please try opening the presentation again.' : '' };
  }
  async function renderProject(index) {
    const generation = ++viewGeneration;
    dialogIndex = Math.max(0, Math.min(dialogIds.length - 1, index));
    const id = dialogIds[dialogIndex];
    currentProject = projectMap.get(id) || fallbackProject(id);
    members.replaceChildren();
    members.hidden = true;
    showDetails(currentProject);
    count.textContent = `${String(dialogIndex + 1).padStart(2, '0')} / ${String(dialogIds.length).padStart(2, '0')}`;
    dialog.querySelector('[data-project-direction="-1"]').disabled = dialogIndex === 0;
    dialog.querySelector('[data-project-direction="1"]').disabled = dialogIndex === dialogIds.length - 1;
    await ready;
    if (destroyed || !dialog.open || generation !== viewGeneration) return;
    currentProject = projectMap.get(id) || fallbackProject(id);
    showDetails(currentProject);
    const grouped = currentProject.members || [];
    members.hidden = grouped.length === 0;
    if (grouped.length) {
      const overview = document.createElement('button');
      overview.type = 'button';
      overview.textContent = 'Overview';
      overview.setAttribute('aria-pressed', 'true');
      overview.addEventListener('click', () => {
        for (const sibling of members.children) sibling.setAttribute('aria-pressed', String(sibling === overview));
        showDetails(currentProject);
      }, { signal });
      members.append(overview);
    }
    grouped.forEach(member => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = member.title;
      button.setAttribute('aria-pressed', 'false');
      button.addEventListener('click', () => {
        for (const sibling of members.children) sibling.setAttribute('aria-pressed', String(sibling === button));
        showDetails(member);
      }, { signal });
      members.append(button);
    });
    dialog.querySelector('.seminal-project-dialog__copy').scrollTop = 0;
  }
  function openProject(button) {
    if (destroyed || !activeScene || !activeScene.contains(button)) return;
    returnFocus = button;
    dialogIds = stream.getIds();
    const index = dialogIds.indexOf(button.dataset.projectId);
    stream?.pause();
    // Open first, so the deck's overlay check sees the modal in onOpen.
    if (!dialog.open) dialog.showModal();
    onOpen?.();
    renderProject(index);
    closeButton.focus({ preventScroll: true });
  }
  closeButton.addEventListener('click', () => dialog.close(), { signal });
  dialog.addEventListener('close', () => {
    viewGeneration++;
    if (destroyed) return;
    onClose?.();
    if (returnFocus?.isConnected && !returnFocus.closest('[inert]') && returnFocus.closest('.scene.active')) returnFocus.focus({ preventScroll: true });
  }, { signal });
  dialog.addEventListener('click', event => {
    const direction = event.target.closest('[data-project-direction]');
    if (direction) renderProject(dialogIndex + Number(direction.dataset.projectDirection));
  }, { signal });
  dialog.addEventListener('keydown', event => {
    if (!dialog.open || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    renderProject(dialogIndex + (event.key === 'ArrowRight' ? 1 : -1));
  }, { signal });

  function pause() {
    activeScene = null;
    stream?.pause();
  }
  function activate(scene, { motion: animate = true } = {}) {
    if (destroyed) return;
    if (!scene?.matches('.seminal-projects')) { pause(); return; }
    if (activeScene !== scene) stream?.pause();
    activeScene = scene;
    motion = Boolean(animate);
    scene.classList.toggle('seminal-projects--still', !motion || reduced.matches);
    stream.activate(scene, { motion });
  }
  // Build before prepareScene/reveal sees the slide, preventing an unstyled-card flash.
  stream = mountProjectStream([...document.querySelectorAll('.scene')], {
    getProject: id => projectMap.get(id), ready, onInspect: openProject,
  });
  reduced.addEventListener('change', () => { if (activeScene) activate(activeScene, { motion }); }, { signal });
  return {
    activate, pause, prepare: scene => stream.prepare(scene),
    settle: scene => { if (scene?.matches('.seminal-projects')) { stream.activate(scene); stream.pause(); } },
    beginTransition: (from, to) => stream.transition(from, to),
    destroy() {
      if (destroyed) return;
      destroyed = true;
      viewGeneration++;
      controller.abort();
      stream.destroy();
      if (dialog.open) dialog.close();
      dialog.remove();
      projectMap.clear();
    },
  };
}
