/**
 * RBB adaptation of Osmo's licensed Footer with Parallax Effect and Underline
 * Link. Source supplied through the user's Osmo account; see
 * build/research/osmo/MUSEUM_MENU_README.md. Original logo/content excluded.
 */
const GROUPS = [
  { title: 'Invitation', ids: ['invitation-cover', 'living-portrait', 'why-we-build', 'partner-invitation'] },
  { title: 'Seminal projects', ids: ['projects-intro','projects-civic', 'projects-work', 'projects-care', 'projects-industry'] },
  { title: 'Art and collaboration', ids: ['collection-intro', 'office-art', 'collection-artists', 'hope-plaza'] },
  { title: 'Possibilities', ids: ['spaces-intro','opportunities-plan','opportunity-prefunction','opportunity-timeline','possibility'] },
];
const LABELS = {
  'invitation-cover': 'How vision takes form', 'living-portrait': 'A living portrait',
  'why-we-build': 'Why we build', 'partner-invitation': 'The invitation',
  'projects-civic': 'Life and community', 'projects-work': 'Work and connection',
  'projects-care': 'Care and discovery', 'projects-industry': 'Making what comes next',
  'hope-plaza': 'A place for hope',
  'office-art': 'Art in our spaces', 'collection-artists': 'Artists and perspectives',
  possibility: 'Imagine together',
  'projects-intro':'The story behind the work', 'collection-intro':'Art as part of life', 'spaces-intro':'Space for possibility',
  'opportunities-plan': 'One possible setting',
  'opportunity-prefunction': 'Pre-function gallery', 'opportunity-timeline': 'Timeline corridor',
};

function loadStyles() {
  const href = new URL('../museum-menu.css?v=5e8b53d4d8440aa3cca6', import.meta.url).href;
  if ([...document.styleSheets].some(sheet => sheet.href === href)) return Promise.resolve();
  let link = [...document.querySelectorAll('link[rel="stylesheet"]')].find(item => item.href === href);
  return new Promise(resolve => {
    if (!link) {
      link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      link.dataset.museumMenuStyles = '';
      document.head.append(link);
    }
    link.addEventListener('load', resolve, { once: true });
    link.addEventListener('error', resolve, { once: true });
  });
}

/** Callbacks request owner actions so the menu and deck lift can run together. */
export function mountMuseumMenu(host, { scenes = [], onSelect, onClose, getIndex = () => 0 } = {}) {
  if (!(host instanceof HTMLElement)) throw new TypeError('mountMuseumMenu requires a host element.');
  const gsap = window.gsap;
  if (!gsap) throw new Error('The museum menu requires the existing GSAP runtime.');
  const stylesReady = loadStyles();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const phone = matchMedia('(max-width: 900px)');
  const previewAllowed = matchMedia('(min-width: 992px)');
  const controller = new AbortController();
  const signal = controller.signal;
  const original = { html: host.innerHTML, className: host.className, hidden: host.hidden, inert: host.inert, role: host.getAttribute('role'), label: host.getAttribute('aria-label'), modal: host.getAttribute('aria-modal'), ariaHidden: host.getAttribute('aria-hidden') };
  let phase = 'closed', disposed = false, returnFocus = null, currentIndex = 0;
  let requestGeneration = 0;
  let timeline = null, finishMotion = null, motionPromise = Promise.resolve(true);

  host.classList.add('museum-menu');
  host.setAttribute('role', 'dialog');
  host.setAttribute('aria-modal', 'true');
  host.setAttribute('aria-label', 'Clayco exhibition menu');
  host.setAttribute('aria-hidden', 'true');
  host.hidden = true;
  host.inert = true;
  host.innerHTML = `
    <div class="museum-menu__inner" data-footer-parallax-inner>
      <div class="museum-menu__top-row">
        <p class="museum-menu__menu-label">MENU</p>
        <button class="museum-menu__close" type="button" aria-label="Close menu"><span data-museum-underline>Close</span><span class="museum-menu__close-icon" aria-hidden="true">×</span></button>
      </div>
      <nav class="museum-menu__links-row" aria-label="Presentation chapters"></nav>
      <div class="museum-menu__logo-row">
        <img class="museum-menu__wordmark" src="assets/brand/clayco-black.svg" width="204" height="51" alt="Clayco">
        <figure class="museum-menu__preview" aria-hidden="true" hidden>
          <div class="museum-menu__preview-window"></div>
          <figcaption class="museum-menu__preview-caption"></figcaption>
        </figure>
      </div>
    </div>
    <div class="museum-menu__shade" data-footer-parallax-dark aria-hidden="true"></div>`;

  const inner = host.querySelector('.museum-menu__inner');
  const shade = host.querySelector('.museum-menu__shade');
  const closeButton = host.querySelector('.museum-menu__close');
  const linksRow = host.querySelector('.museum-menu__links-row');
  const buttons = new Map();
  const sceneList = Array.from(scenes);
  const preview = host.querySelector('.museum-menu__preview');
  const previewWindow = host.querySelector('.museum-menu__preview-window');
  const previewCaption = host.querySelector('.museum-menu__preview-caption');
  let previewFrame = null, previewTimer = null, previewScene = null, previewLoaded = false;
  function sizePreview() {
    if (previewFrame) previewFrame.style.transform = `scale(${previewWindow.clientWidth / 1920})`;
  }
  const previewResize = new ResizeObserver(sizePreview);
  previewResize.observe(previewWindow);
  function stopPreview() {
    clearTimeout(previewTimer);
    previewFrame?.remove(); previewFrame = null; previewLoaded = false; previewScene = null;
    preview.hidden = true; delete preview.dataset.ready;
  }
  function navigatePreview() {
    if (previewLoaded && previewScene && previewFrame?.contentWindow) {
      previewFrame.contentWindow.postMessage({ type: 'RBB_NAVIGATE', scene: previewScene }, location.origin);
    }
  }
  function showPreview(index) {
    if (disposed || !previewAllowed.matches || !['open', 'opening'].includes(phase)) return;
    const button = buttons.get(index);
    if (!button) return;
    previewScene = button.dataset.menuScene;
    previewCaption.textContent = `${String(index + 1).padStart(2, '0')} / ${button.querySelector('.museum-menu__link-label').textContent}`;
    preview.hidden = false;
    if (!previewFrame) {
      previewFrame = document.createElement('iframe');
      previewFrame.title = 'Animated slide preview';
      previewFrame.tabIndex = -1; previewFrame.inert = true;
      previewFrame.setAttribute('aria-hidden', 'true');
      const url = new URL(location.href);
      url.searchParams.set('menu-preview', '1'); url.hash = previewScene;
      previewFrame.src = url.href;
      previewFrame.addEventListener('load', () => { previewLoaded = true; navigatePreview(); }, { signal });
      previewWindow.append(previewFrame); sizePreview();
    } else navigatePreview();
  }
  function requestPreview(index) {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => showPreview(index), 120);
  }
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== previewFrame?.contentWindow || event.data?.type !== 'RBB_PREVIEW_SCENE') return;
    if (event.data.scene === previewScene) preview.dataset.ready = 'true';
  }, { signal });

  for (const group of GROUPS) {
    const column = document.createElement('div');
    column.className = 'museum-menu__col';
    const label = document.createElement('p');
    label.className = 'museum-menu__eyebrow';
    label.textContent = group.title;
    const links = document.createElement('div');
    links.className = 'museum-menu__links';
    for (const id of group.ids) {
      const index = sceneList.findIndex(scene => (scene.dataset?.compositionId || scene.sceneId) === id);
      if (index < 0) continue;
      const scene = sceneList[index];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'museum-menu__link';
      button.dataset.menuIndex = String(index);
      button.dataset.menuScene = id;
      const number = document.createElement('span');
      number.className = 'museum-menu__number';
      number.textContent = String(index + 1).padStart(2, '0');
      number.setAttribute('aria-hidden', 'true');
      const name = document.createElement('span');
      name.className = 'museum-menu__link-label';
      name.dataset.museumUnderline = '';
      name.textContent = scene.dataset?.menuLabel || scene.menuLabel || LABELS[id] || scene.dataset?.label || scene.label;
      const fullLabel = scene.dataset?.label || scene.label || name.textContent;
      button.setAttribute('aria-label', `Slide ${index + 1}: ${fullLabel}`);
      button.append(number, name);
      button.addEventListener('click', () => onSelect?.(index), { signal });
      button.addEventListener('pointerenter', () => requestPreview(index), { signal });
      button.addEventListener('focus', () => requestPreview(index), { signal });
      links.append(button);
      buttons.set(index, button);
    }
    column.append(label, links);
    linksRow.append(column);
  }

  function requestClose() {
    if (onClose) onClose();
    else close();
  }
  closeButton.addEventListener('click', requestClose, { signal });

  function focusables() {
    return [...host.querySelectorAll('button:not(:disabled),a[href],[tabindex="0"]')].filter(el => !el.hidden && el.getClientRects().length);
  }
  function focusCurrent() {
    (buttons.get(currentIndex) || closeButton).focus({ preventScroll: true });
  }
  document.addEventListener('keydown', event => {
    if (phase === 'closed' || disposed) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      requestClose();
    } else if (event.key === 'Tab') {
      const items = focusables();
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      const outside = !host.contains(document.activeElement);
      if (outside || event.shiftKey && document.activeElement === first || !event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus({ preventScroll: true });
      }
    }
  }, { capture: true, signal });
  document.addEventListener('focusin', event => {
    if ((phase === 'open' || phase === 'opening') && !host.contains(event.target)) focusCurrent();
  }, { signal });

  function setIndex(index) {
    if (!Number.isInteger(Number(index))) return;
    currentIndex = Number(index);
    for (const [i, button] of buttons) {
      if (i === currentIndex) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    }
  }
  function stopMotion() {
    timeline?.kill();
    timeline = null;
    finishMotion?.(false);
    finishMotion = null;
  }
  function animate(opening) {
    stopMotion();
    motionPromise = new Promise(resolve => {
      finishMotion = resolve;
      timeline = gsap.timeline({ onComplete: () => {
        timeline = null;
        finishMotion = null;
        phase = opening ? 'open' : 'closed';
        host.dataset.menuState = phase;
        if (opening) focusCurrent();
        else {
          host.hidden = true;
          host.inert = true;
          host.setAttribute('aria-hidden', 'true');
          requestAnimationFrame(() => {
            if (!disposed && phase === 'closed' && returnFocus?.isConnected && !returnFocus.closest('[inert]')) returnFocus.focus({ preventScroll: true });
          });
        }
        resolve(true);
      } });
      const duration = reduced.matches ? 0 : phone.matches ? .7 : 1.2;
      if (phone.matches) timeline.to(host, { opacity: opening ? 1 : 0, duration, ease: 'power2.inOut' }, 0);
      // A long vertical phone menu should fade/rise a few pixels, rather than
      // move a quarter of its entire scrollable height like the desktop footer.
      timeline.to(inner, {
        yPercent: phone.matches ? 0 : opening ? 0 : -25,
        y: phone.matches && !opening ? 28 : 0,
        opacity: phone.matches && !opening ? 0 : 1,
        duration, ease: phone.matches ? 'power2.out' : 'power3.inOut'
      }, 0);
      timeline.to(shade, { opacity: opening ? 0 : .5, duration, ease: 'power3.inOut' }, 0);
    });
    return motionPromise;
  }
  async function open() {
    const generation = ++requestGeneration;
    await stylesReady;
    if (disposed || generation !== requestGeneration) return false;
    if (phase === 'open') return true;
    if (phase === 'opening') return motionPromise;
    if (phase === 'closed') {
      returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      host.scrollTop = 0;
      gsap.set(host, { opacity: phone.matches ? 0 : 1 });
      gsap.set(inner, { yPercent: phone.matches ? 0 : -25, y: phone.matches ? 28 : 0, opacity: phone.matches ? 0 : 1 });
      gsap.set(shade, { opacity: .5 });
    }
    phase = 'opening';
    host.dataset.menuState = phase;
    host.hidden = false;
    host.inert = false;
    host.setAttribute('aria-hidden', 'false');
    setIndex(getIndex());
    focusCurrent();
    return animate(true);
  }
  function close() {
    requestGeneration++;
    if (disposed || phase === 'closed') return Promise.resolve(false);
    if (phase === 'closing') return motionPromise;
    phase = 'closing';
    stopPreview();
    host.dataset.menuState = phase;
    return animate(false);
  }
  previewAllowed.addEventListener('change', () => {
    if (!previewAllowed.matches) stopPreview();
    else if (phase === 'open') requestPreview(currentIndex);
  }, { signal });
  phone.addEventListener('change', () => {
    // Finish the requested menu state before changing between overlay and
    // desktop footer motion; no stale phone opacity or translation may remain.
    timeline?.progress(1);
    const visible = phase === 'open' || phase === 'opening';
    gsap.set(host, { opacity: visible || !phone.matches ? 1 : 0 });
    gsap.set(inner, {
      yPercent: visible || phone.matches ? 0 : -25,
      y: phone.matches && !visible ? 28 : 0,
      opacity: visible || !phone.matches ? 1 : 0
    });
    gsap.set(shade, { opacity: visible ? 0 : .5 });
  }, { signal });
  function dispose() {
    if (disposed) return;
    disposed = true;
    stopPreview(); previewResize.disconnect();
    stopMotion();
    controller.abort();
    host.innerHTML = original.html;
    host.className = original.className;
    host.hidden = original.hidden;
    host.inert = original.inert;
    delete host.dataset.menuState;
    for (const [key, value] of [['role', original.role], ['aria-label', original.label], ['aria-modal', original.modal], ['aria-hidden', original.ariaHidden]]) {
      if (value === null) host.removeAttribute(key);
      else host.setAttribute(key, value);
    }
    if (returnFocus?.isConnected && !returnFocus.closest('[inert]')) returnFocus.focus({ preventScroll: true });
  }
  setIndex(getIndex());
  return { open, close, setIndex, dispose };
}
