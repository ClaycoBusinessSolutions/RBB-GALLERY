import { mountArtField } from './art-field.js?v=4a70eb9f4c3945011126';
import { mountProjectField } from './project-field.js?v=4a70eb9f4c3945011126';
import { mountArcTransition } from './arc-transition.js?v=4a70eb9f4c3945011126';
import { mountMuseumMenu } from './museum-menu.js?v=4a70eb9f4c3945011126';
import { addSceneReveal, settleSceneReveal, SCENE_MOTION } from './scene-reveal.js?v=4a70eb9f4c3945011126';
import { createSeminalProjects } from './seminal-projects.js?v=4a70eb9f4c3945011126';
import { isProjectSequence } from './project-sequence.js?v=4a70eb9f4c3945011126';
import { createHopeGallery } from './hope-gallery.js?v=4a70eb9f4c3945011126';
import { createSpaceOpportunities } from './space-opportunities.js?v=4a70eb9f4c3945011126';
import { normalizeSceneId, validSceneId as validateSceneId, sceneFromHash as parseSceneHash, initialSceneId, navigationSceneFromMessage } from './mobile-runtime.js?v=4a70eb9f4c3945011126';
import { mountMobileNavContrast } from './mobile-nav-contrast.js?v=4a70eb9f4c3945011126';

const $ = selector => document.querySelector(selector);
const scenes = [...document.querySelectorAll('.scene')];
const sceneIds = scenes.map(scene => scene.dataset.compositionId);
const stage = $('#stage');
const gsap = window.gsap;
const arcs = mountArcTransition(stage);
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const phone = matchMedia('(max-width: 900px)');
const sceneStorageKey = `rbb:last-scene:${location.pathname}`;
const state = { index: 0, transitioning: false, motion: !reduced.matches, autoplay: false, mode: 'live' };
const sheet = $('#presentation-sheet') || document.createElement('div');
if (!sheet.isConnected) { sheet.id = 'presentation-sheet'; stage.before(sheet); }
for (const element of [stage, $('#deck-chrome'), $('#slide-navigation')]) if (element && element.parentElement !== sheet) sheet.append(element);
const nav = $('#slide-navigation');
const navContrast = mountMobileNavContrast({ nav, stage, phone });
const timelines = window.__timelines ||= {};
const focus = { value: 0 };
let art, artPromise, projectField, projectFieldPromise, artworks = [], museumMenu, officeAccordion, officeAccordionPromise;
let initialized = false, pendingExternalScene = null, fieldGeneration = 0;
let queue = null, navigationTarget = 0, autoTimer, transition, menuBusy = false;
let menuWanted = false, menuGeneration = 0, menuPromise = Promise.resolve(true), menuSheetTween;
let pendingOverviewOpen = null;
const isProjectCover = scene => scene?.dataset.compositionId === 'invitation-cover';
const isCollection = scene => scene?.dataset.compositionId === 'collection';
const isOverlay = () => !$('#overview').hidden || !!document.querySelector('dialog[open]');
const transitionMotion = () => state.motion && !reduced.matches && !document.hidden && !isOverlay() && state.mode === 'live';
const moving = () => !phone.matches && transitionMotion();
const seminalProjects = createSeminalProjects({ onOpen: pauseForOverlay, onClose: refreshMotion });
const hopeGallery = createHopeGallery();
const spaceOpportunities = createSpaceOpportunities({ onNavigate: go, onOpen: pauseForOverlay, onClose: refreshMotion });

function resize() {
 const root = document.documentElement, width = root.clientWidth, height = root.clientHeight;
 const scale = phone.matches ? 1 : Math.min(width / 1920, height / 1080);
 root.classList.toggle('mobile-deck', phone.matches);
 root.style.setProperty('--scale', scale);
 root.style.setProperty('--stage-width', `${width / scale}px`);
 root.style.setProperty('--stage-height', `${height / scale}px`);
 root.style.setProperty('--content-left', `${phone.matches ? 0 : (width / scale - 1920) / 2}px`);
 root.style.setProperty('--content-top', `${phone.matches ? 0 : (height / scale - 1080) / 2}px`);
 root.style.setProperty('--bleed-scale', phone.matches ? 1 : Math.max(width / 1920, height / 1080) / scale);
 if (!state.transitioning && scenes[state.index]?.classList.contains('active') && !isOverlay()) {
  seminalProjects.activate(scenes[state.index], { motion: transitionMotion() });
 }
}
addEventListener('resize', resize); resize();

// Paused, seekable scene timelines support the existing HyperFrames wrapper.
for (const scene of scenes) {
 const timeline = gsap.timeline({ paused: true });
 timeline.fromTo(scene.querySelector('.scene-inner'), { y: 42, opacity: 0 }, { y: 0, opacity: 1, duration: 1.15, ease: 'power3.out' }, 0);
 timeline.to({}, { duration: Math.max(0, Number(scene.dataset.duration) - 1.15) });
 timelines[scene.dataset.compositionId] = timeline;
 scene.inert = true;
 scene.setAttribute('aria-hidden', 'true');
}
function setText(selector, value) { const element = $(selector); if (element) element.textContent = value; }
function updateChrome() {
 const current = scenes[state.index];
 const count = `${String(state.index + 1).padStart(2, '0')} / ${String(scenes.length).padStart(2, '0')}`;
 setText('#slide-label', current.dataset.label);
 setText('#counter', count);
 setText('#nav-count', count);
 for (const selector of ['#prev', '#nav-prev']) { const button = $(selector); if (button) button.disabled = state.index === 0; }
 for (const selector of ['#next', '#nav-next']) { const button = $(selector); if (button) button.disabled = state.index === scenes.length - 1; }
 if ($('#progress')) $('#progress').style.width = `${(state.index + 1) / scenes.length * 100}%`;
 setText('#autoplay-button', state.autoplay ? 'Pause' : 'Play');
 $('#autoplay-button')?.setAttribute('aria-label', state.autoplay ? 'Pause presentation' : 'Play presentation');
 setText('#motion-button', state.motion ? 'Motion on' : 'Motion off');
 $('#motion-button')?.setAttribute('aria-label', state.motion ? 'Pause motion' : 'Resume motion');
 $('#motion-button')?.setAttribute('aria-pressed', String(state.motion));
 setText('#status', `Slide ${state.index + 1}. ${current.dataset.label}`);
 if (nav) {
  const surface = getComputedStyle(current);
  const surfaceColor = surface.backgroundColor;
  nav.style.setProperty('--nav-surface', surfaceColor === 'transparent' || surfaceColor === 'rgba(0, 0, 0, 0)' ? getComputedStyle(stage).backgroundColor : surfaceColor);
  nav.style.setProperty('--nav-ink', surface.color);
  nav.dataset.theme = current.matches('.source-statement,.invitation-cover,.seminal-projects,.office-art,.collaboration-invitation,.section-divider,.clark-cover,.space-opportunity--night') ? 'dark' : 'light';
  nav.hidden = menuWanted || menuBusy;
  nav.inert = menuWanted || menuBusy;
 }
 museumMenu?.setIndex(state.index);
 navContrast.refresh();
}
// Keep both large cover fields dormant until their scene is actually requested.
// Restoring a later phone slide should not decode a second, hidden image field.
function prepareCover(scene) {
 const generation = fieldGeneration;
 if (isProjectCover(scene)) {
  projectFieldPromise ||= mountProjectField($('#project-field'))
   .then(field => {
    if (generation !== fieldGeneration) { field.dispose(); return; }
    projectField = field; if (scenes[state.index] === scene && scene.classList.contains('active')) startAmbient(scene);
   })
   .catch(error => { console.warn('Project cover unavailable.', error); if (generation === fieldGeneration) projectFieldPromise = null; });
  return projectFieldPromise;
 }
 if (isCollection(scene)) {
  artPromise ||= (async () => {
   const response = await fetch('assets/art/manifest.json');
   if (!response.ok) throw new Error('The artwork catalogue could not be loaded.');
   const manifest = await response.json();
   if (generation !== fieldGeneration) return;
   artworks = manifest;
   art = mountArtField($('#art-field'), artworks, { onSelect: openArt });
   if (scenes[state.index] === scene && scene.classList.contains('active')) startAmbient(scene);
  })().catch(error => { console.warn('Artwork field unavailable.', error); if (generation === fieldGeneration) artPromise = null; });
  return artPromise;
 }
 return Promise.resolve();
}
async function prepareScene(scene) {
 await Promise.allSettled([prepareCover(scene), hopeGallery.prepare(scene), spaceOpportunities.prepare(scene), seminalProjects.prepare(scene)]);
 if (scene.dataset.compositionId === 'office-art') {
  const generation = fieldGeneration;
  if (!officeAccordionPromise) officeAccordionPromise = import('./wavy-accordion.js?v=4a70eb9f4c3945011126').then(async ({ mountWavyAccordion }) => {
   if (generation !== fieldGeneration) return null;
   const root = scene.querySelector('[data-wavy-accordion-init]');
   officeAccordion = mountWavyAccordion(root, { onSelect: index => openOfficePhoto(root, index) });
   await officeAccordion.ready;
   return officeAccordion;
  });
  await officeAccordionPromise;
 }
 if (!phone.matches && scene.matches('.source-art-pair,.hope-plaza,.seminal-projects,.invitation-cover')) {
  // Incoming slides are still hidden; start lazy image requests explicitly
  // before waiting for decode so preparation cannot wait on visibility.
  await Promise.allSettled([...scene.querySelectorAll('img')].map(image => { image.loading = 'eager'; return image.decode(); }));
 }
}
function stopAmbient(scene) {
 if (isProjectCover(scene)) projectField?.setActive(false);
 if (scene?.dataset.compositionId === 'office-art') officeAccordion?.setActive(false);
 if (isCollection(scene)) { art?.setActive(false); }
 seminalProjects.pause(); hopeGallery.pause(); spaceOpportunities.pause();
}
function startAmbient(scene) {
 projectField?.setMotion(transitionMotion() && state.mode === 'live');
 projectField?.setActive(isProjectCover(scene) && (phone.matches || moving()) && state.mode === 'live');
 if (scene.dataset.compositionId === 'office-art') {
  officeAccordion?.setMotion(moving() && state.mode === 'live');
  officeAccordion?.setActive(true);
 }
 const collection = isCollection(scene);
 if ($('#art-field')) { $('#art-field').inert = !collection; $('#art-field').setAttribute('aria-hidden', String(!collection)); $('#art-field').style.opacity = collection ? '1' : '0'; }
 art?.setMotion(transitionMotion() && state.mode === 'live');
 art?.setActive(collection && (phone.matches || moving()) && state.mode === 'live');
 seminalProjects.activate(scene, { motion: transitionMotion() && state.mode === 'live' });
 hopeGallery.activate(scene, { motion: moving() && state.mode === 'live' });
 spaceOpportunities.activate(scene, { motion: moving() && state.mode === 'live' });
}
function refreshMotion() {
 if (state.transitioning) {
  if (!transitionMotion()) transition?.progress(1);
  updateChrome();
  return;
 }
 const scene = scenes[state.index];
 stopAmbient(scene); startAmbient(scene); updateChrome(); scheduleAuto();
}
function scheduleAuto() {
 clearTimeout(autoTimer);
 if (state.autoplay && !document.hidden && !isOverlay() && !state.transitioning) {
  autoTimer = setTimeout(() => {
   if (state.index < scenes.length - 1) go(state.index + 1);
   else { state.autoplay = false; updateChrome(); }
  }, Number(scenes[state.index].dataset.duration) * 1000);
 }
}
function validSceneId(value) { return validateSceneId(value, sceneIds); }
function sceneFromHash() { return parseSceneHash(location.hash, sceneIds); }
function savedSceneId() {
 try { return validSceneId(sessionStorage.getItem(sceneStorageKey)); } catch { return null; }
}
function rememberScene(scene, { notify = true } = {}) {
 const id = scene?.dataset.compositionId;
 if (!id || state.mode !== 'live') return;
 try { sessionStorage.setItem(sceneStorageKey, id); } catch { /* Private browsing may restrict storage. */ }
 const url = new URL(location.href); url.hash = id;
 history.replaceState(null, '', url);
 // The public page hosts this deck in an iframe. Sync its URL as well so an
 // iOS tab reload or a shared link returns to the same place in the invitation.
 if (notify && parent !== window && location.origin !== 'null') {
  parent.postMessage({ type: 'RBB_SCENE', scene: id }, location.origin);
 }
}
function externalNavigation(id) {
 const sceneId = validSceneId(id);
 if (!sceneId) return;
 pendingExternalScene = sceneId;
 if (initialized) go(sceneId);
}
addEventListener('hashchange', () => externalNavigation(sceneFromHash()));
addEventListener('message', event => {
 const sceneId = navigationSceneFromMessage(event, { parentWindow: parent, ownWindow: window, origin: location.origin, sceneIds });
 if (sceneId) externalNavigation(sceneId);
});
addEventListener('pagehide', () => {
 rememberScene(scenes[state.transitioning ? navigationTarget : state.index], { notify: false });
 stopAmbient(scenes[state.index]); clearTimeout(autoTimer);
});
addEventListener('pageshow', event => { if (event.persisted && initialized) { resize(); refreshMotion(); } });
// Market slides share one live stream. Preserve just the outgoing market while
// the stream moves to its new scene, so phone transitions never reveal an empty
// black page. This is a short-lived inert DOM copy, not a second interactive view.
function snapshotPhoneMarket(scene) {
 const live = scene.querySelector(':scope > .project-stream');
 const track = live?.querySelector('.project-stream__track');
 const market = track?.querySelector(`[data-market="${scene.dataset.compositionId}"]`);
 if (!live || !track || !market) return null;
 const snapshot = live.cloneNode(false), copyTrack = track.cloneNode(false);
 copyTrack.append(market.cloneNode(true)); snapshot.append(copyTrack);
 snapshot.dataset.phoneExitSnapshot = '';
 snapshot.inert = true; snapshot.setAttribute('aria-hidden', 'true');
 for (const node of [snapshot, ...snapshot.querySelectorAll('*')]) {
  for (const attribute of ['id', 'aria-labelledby', 'aria-describedby', 'aria-controls', 'autofocus']) node.removeAttribute(attribute);
  if (node.matches('button,a,input,[tabindex]')) node.tabIndex = -1;
 }
 scene.append(snapshot);
 snapshot.scrollTop = live.scrollTop;
 return snapshot;
}
function stepBy(delta) {
 return go((queue ?? (state.transitioning ? navigationTarget : state.index)) + delta);
}
async function go(index, { instant = false, seek = false } = {}) {
 if (typeof index === 'string' && !/^\d+$/.test(index)) {
  index = normalizeSceneId(index);
  index = scenes.findIndex(scene => scene.dataset.compositionId === index);
  if (index < 0) return;
 }
 index = Math.max(0, Math.min(scenes.length - 1, Number(index)));
 if (!Number.isFinite(index)) return;
 if (state.transitioning) { queue = index; return; }
 if (index === state.index && scenes[index].classList.contains('active')) { if (!seek) rememberScene(scenes[index]); return; }
 navigationTarget = index;
 state.transitioning = true;
 clearTimeout(autoTimer);
 const from = scenes[state.index], to = scenes[index], direction = index >= state.index ? 1 : -1;
 stopAmbient(from);
 gsap.set(to, { opacity: 0 });
 // Phone navigation must remain usable on a slow connection. Content can finish
 // loading after the slide appears; failed optional media cannot lock Next.
 const preparation = prepareScene(to).catch(error => console.warn('Optional slide media unavailable.', error));
 if (phone.matches) {
  let timeout;
  await Promise.race([preparation, new Promise(resolve => { timeout = setTimeout(resolve, 2000); })]);
  clearTimeout(timeout);
 } else await preparation;
 const hasFrom = from.classList.contains('active');
 state.index = index; updateChrome();
 const phoneTransition = phone.matches;
 const animate = !instant && !pendingOverviewOpen && transitionMotion();
 const duration = animate ? phoneTransition ? 1.25 : SCENE_MOTION.duration : 0;
 const projectStep = animate && hasFrom && isProjectSequence(from, to);
 const useProjectSequence = !phoneTransition && projectStep;
 const phoneProjectStep = phoneTransition && projectStep;
 const phoneSnapshot = phoneTransition && animate && hasFrom && from !== to && from.matches('.seminal-projects') && to.matches('.seminal-projects') ? snapshotPhoneMarket(from) : null;
 if (phoneTransition && animate) stage.classList.add('mobile-transitioning');
 const mapMorph = spaceOpportunities.beginTransition(from, to, { duration, motion: animate && hasFrom });
 if (!useProjectSequence) seminalProjects.settle(to);
 const arc = animate && !useProjectSequence && !phoneProjectStep ? arcs.begin(to, { direction, curve: phoneTransition ? 22 : 12 }) : null;
 to.classList.add('active'); to.inert = false; to.setAttribute('aria-hidden', 'false');
 if (phone.matches) to.scrollTop = 0;
 from.inert = true; from.style.pointerEvents = 'none';
 to.style.zIndex = '3'; from.style.zIndex = '2';
 timelines[to.dataset.compositionId].progress(1).pause();
 gsap.set(to.querySelector('.scene-inner'), { clearProps: 'transform,opacity' });
 if (isCollection(to)) { art?.setActive(moving()); focus.value = 1; art?.setFocus(1); $('#art-field').style.opacity = '1'; }
 const projectSequence = useProjectSequence ? seminalProjects.beginTransition(from, to) : null;
 await new Promise(resolve => {
  transition = gsap.timeline({ onComplete: resolve });
  if (mapMorph) transition.add(mapMorph.timeline.paused(false), 0);
  if (projectSequence) transition.add(projectSequence.timeline.paused(false), 0);
  else if (phoneProjectStep) {
   // One viewport push keeps the market photographs moving up and out, while
   // each settled portrait market shows a complete page of project cards.
   const distance = stage.clientHeight;
   gsap.set([from, to], { opacity: 1 });
   transition.fromTo(to, { y: direction * distance }, { y: 0, duration, ease: 'power3.inOut' }, 0);
   transition.to(from, { y: -direction * distance, duration, ease: 'power3.inOut' }, 0);
   settleSceneReveal(to);
  } else {
  addSceneReveal(transition, to, { instant: !duration, direction, compact: phoneTransition });
  if (arc) {
   gsap.set(to, { opacity: 1 });
   const arcClock = { progress: 0 };
   transition.to(arcClock, { progress: 1, duration, ease: SCENE_MOTION.ease, onUpdate: () => arc.draw(arcClock.progress) }, 0);
  } else transition.to(to, { opacity: 1, duration: duration * .82, ease: 'power2.inOut' }, 0);
  // Keep the editorial canvas stable. Individual masks share the arc's rhythm.
  gsap.set(to.querySelector('.scene-inner'), { clearProps: 'transform,opacity' });
  if (hasFrom && from !== to) {
   if (!arc) transition.to(from, { opacity: 0, duration: duration * .9, ease: 'power2.inOut' }, 0);
   if (!phoneTransition) transition.to(from.querySelector('.scene-inner'), { opacity: 0, y: -direction * 16, duration: duration ? .32 : 0, ease: 'power2.in' }, 0);
  }
  }
  if (isCollection(from) || isCollection(to)) {
   transition.to(focus, { value: isCollection(to) ? 0 : 1, duration, ease: 'power3.inOut', onUpdate: () => art?.setFocus(focus.value) }, 0);
  }
  if (!duration) transition.progress(1);
 });
 arc?.dispose(); mapMorph?.finish(); projectSequence?.finish();
 phoneSnapshot?.remove();
 if (phoneTransition) gsap.set([from, to], { clearProps: 'transform' });
 stage.classList.remove('mobile-transitioning');
 for (const scene of scenes) {
  const active = scene === to;
  scene.classList.toggle('active', active); scene.inert = !active; scene.setAttribute('aria-hidden', String(!active));
  if (!active) {
   gsap.set(scene, { clearProps: 'opacity,zIndex,pointerEvents' });
   gsap.set(scene.querySelector('.scene-inner'), { clearProps: 'transform,opacity' });
   settleSceneReveal(scene);
  }
 }
 gsap.set(to, { clearProps: 'opacity,zIndex,pointerEvents' }); to.inert = false;
 state.transitioning = false; startAmbient(to);
 if (!seek) { rememberScene(to); scheduleAuto(); }
 if (pendingOverviewOpen) {
  const pending = pendingOverviewOpen; pendingOverviewOpen = null; queue = null;
  pending.resolve(await setOverviewOpen(true));
  return;
 }
 if (queue !== null) { const target = queue; queue = null; if (target !== state.index) go(target); }
}
function pauseForOverlay() { stopAmbient(scenes[state.index]); clearTimeout(autoTimer); }
function setOverviewOpen(wanted) {
 if (wanted === menuWanted && (menuBusy || $('#overview').hidden === !wanted)) return menuPromise;
 menuWanted = wanted; menuBusy = true; const generation = ++menuGeneration;
 if (nav) { nav.hidden = true; nav.inert = true; }
 if (wanted) { pauseForOverlay(); sheet.inert = true; }
 const menuMotion = wanted ? museumMenu.open() : museumMenu.close();
 menuSheetTween?.kill();
 const sheetMotion = new Promise(resolve => {
  menuSheetTween = gsap.to(sheet, { yPercent: phone.matches ? 0 : wanted ? -100 : 0, duration: phone.matches || reduced.matches ? 0 : 1.2, ease: 'power3.inOut', onComplete: () => resolve(true), onInterrupt: () => resolve(false) });
 });
 menuPromise = Promise.all([menuMotion, sheetMotion]).then(() => {
  if (generation !== menuGeneration) return false;
  menuBusy = false;
  if (!wanted) { sheet.inert = false; refreshMotion(); stage.focus({ preventScroll: true }); }
  return true;
 });
 return menuPromise;
}
function closeOverview() {
 pendingOverviewOpen?.resolve(false); pendingOverviewOpen = null;
 return setOverviewOpen(false);
}
function openOverview() {
 if (state.transitioning) {
  if (!pendingOverviewOpen) {
   let resolve;
   const promise = new Promise(done => { resolve = done; });
   pendingOverviewOpen = { promise, resolve };
  }
  // Honor Menu even during a wipe or optional-media preparation. The current
  // scene settles first, then its menu opens; extra Next presses are discarded.
  queue = null;
  transition?.progress(1);
  return pendingOverviewOpen.promise;
 }
 return setOverviewOpen(true);
}
function toggleOverview() { return menuWanted || pendingOverviewOpen ? closeOverview() : openOverview(); }
function openArt(item) {
 $('#art-image').src = item.preview_src || item.src; $('#art-image').alt = item.alt;
 $('#art-caption').textContent = [item.artist, item.title, item.year, `Catalogue p. ${item.page}`].filter(Boolean).join(' / ');
 pauseForOverlay(); $('#art-dialog').showModal();
}
function openOfficePhoto(root, index) {
 const button = root.querySelectorAll('[data-office-photo]')[index], image = button?.querySelector('img');
 if (!image) return;
 $('#art-image').src = image.currentSrc || image.src; $('#art-image').alt = image.alt;
 $('#art-caption').textContent = [button.dataset.photoTitle, button.dataset.photoCredit].filter(Boolean).join(' / ');
 pauseForOverlay(); $('#art-dialog').showModal();
}
function fullscreen() {
 if (document.fullscreenElement) document.exitFullscreen?.();
 else document.documentElement.requestFullscreen?.().catch(() => {});
}
museumMenu = mountMuseumMenu($('#overview'), { scenes, getIndex: () => state.index, onSelect: async index => { await closeOverview(); await go(index); }, onClose: closeOverview });
document.addEventListener('click', event => {
 const button = event.target.closest('button'); if (!button) return;
 if (button.hasAttribute('data-next')) stepBy(1);
 if (button.hasAttribute('data-go')) go(button.dataset.go);
 if (button.hasAttribute('data-open-collection') && $('#collection-dialog')) { pauseForOverlay(); $('#collection-dialog').showModal(); }
 if (button.classList.contains('close-dialog')) button.closest('dialog')?.close();
});
for (const dialog of document.querySelectorAll('dialog')) dialog.addEventListener('close', refreshMotion);
for (const selector of ['#next', '#nav-next']) if ($(selector)) $(selector).onclick = () => stepBy(1);
for (const selector of ['#prev', '#nav-prev']) if ($(selector)) $(selector).onclick = () => stepBy(-1);
for (const selector of ['#overview-button', '#nav-menu']) if ($(selector)) $(selector).onclick = openOverview;
if ($('#autoplay-button')) $('#autoplay-button').onclick = () => { state.autoplay = !state.autoplay; updateChrome(); scheduleAuto(); };
if ($('#motion-button')) $('#motion-button').onclick = () => { state.motion = !state.motion; refreshMotion(); };
if ($('#fullscreen-button')) $('#fullscreen-button').onclick = fullscreen;
addEventListener('keydown', event => {
 if (event.metaKey || event.ctrlKey || event.altKey || document.querySelector('dialog[open]')) return;
 if (!$('#overview').hidden || menuBusy) {
  if (event.key === 'Escape') { event.preventDefault(); closeOverview(); }
  else if (event.key.toLowerCase() === 'g') { event.preventDefault(); if (!event.repeat) toggleOverview(); }
  return;
 }
 if (/^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName) || event.target.isContentEditable) return;
 if (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === 'PageDown' || (event.code === 'Space' && !event.target.closest('button,a'))) { event.preventDefault(); stepBy(1); }
 if (event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'PageUp') { event.preventDefault(); stepBy(-1); }
 if (event.key === 'Home') { event.preventDefault(); go(0); }
 if (event.key === 'End') { event.preventDefault(); go(scenes.length - 1); }
 if (event.key.toLowerCase() === 'f') { event.preventDefault(); if (!event.repeat) fullscreen(); }
 if (event.key.toLowerCase() === 'g') { event.preventDefault(); if (!event.repeat) toggleOverview(); }
 if (event.key.toLowerCase() === 'm' && !event.repeat) { state.motion = !state.motion; refreshMotion(); }
});
let touch;
const swipeControl = 'canvas,button,a,input,select,textarea,[role="tablist"],[data-wavy-accordion-init],dialog';
stage.addEventListener('touchstart', event => {
 touch = null;
 if (event.touches.length !== 1 || state.transitioning || isOverlay() || event.target.closest(swipeControl)) return;
 const point = event.touches[0], scene = scenes[state.index];
 // Leave the browser's edge gestures alone and never reuse an old gesture.
 if (phone.matches && (point.clientX < 24 || point.clientX > innerWidth - 24)) return;
 touch = { id: point.identifier, x: point.clientX, y: point.clientY, scene, scrollTop: scene.scrollTop, started: performance.now() };
}, { passive: true });
stage.addEventListener('touchmove', event => {
 if (!touch) return;
 const point = [...event.touches].find(point => point.identifier === touch.id);
 if (!point || event.touches.length !== 1 || Math.abs(point.clientY - touch.y) > 24 || touch.scene.scrollTop !== touch.scrollTop) touch = null;
}, { passive: true });
stage.addEventListener('touchcancel', () => { touch = null; }, { passive: true });
stage.addEventListener('touchend', event => {
 const gesture = touch; touch = null;
 if (!gesture || state.transitioning || isOverlay()) return;
 const point = [...event.changedTouches].find(point => point.identifier === gesture.id);
 if (!point || scenes[state.index] !== gesture.scene || gesture.scene.scrollTop !== gesture.scrollTop || performance.now() - gesture.started > 1200) return;
 const dx = point.clientX - gesture.x, dy = point.clientY - gesture.y;
 if (Math.abs(dx) > (phone.matches ? 72 : 60) && Math.abs(dx) > Math.abs(dy) * 2.5) stepBy(dx < 0 ? 1 : -1);
}, { passive: true });
document.addEventListener('space-opportunity-change', updateChrome);
document.addEventListener('visibilitychange', refreshMotion);
reduced.addEventListener('change', () => { state.motion = !reduced.matches; refreshMotion(); });
phone.addEventListener('change', async () => {
 if (state.transitioning) transition?.progress(1);
 menuSheetTween?.kill();
 gsap.set(sheet, { yPercent: menuWanted && !phone.matches ? -100 : 0 });
 // Cover fields and the office gallery choose their renderer at mount time.
 // Recreate only these small, mode-dependent views when crossing the breakpoint.
 fieldGeneration++;
 projectField?.dispose(); projectField = null; projectFieldPromise = null;
 art?.dispose(); art = null; artPromise = null;
 officeAccordion?.dispose(); officeAccordion = null; officeAccordionPromise = null;
 resize(); refreshMotion();
 await prepareScene(scenes[state.index]).catch(error => console.warn('Resized slide media unavailable.', error));
 if (!state.transitioning) refreshMotion();
});
addEventListener('fullscreenchange', () => { setText('#fullscreen-button', document.fullscreenElement ? 'Exit full screen' : 'Full screen'); resize(); });
let quietTimer;
addEventListener('pointermove', () => {
 document.body.classList.remove('chrome-quiet'); clearTimeout(quietTimer);
 if (document.fullscreenElement) quietTimer = setTimeout(() => document.body.classList.add('chrome-quiet'), 3500);
}, { passive: true });

async function seekTime(time) {
 state.mode = 'seek'; state.autoplay = false; clearTimeout(autoTimer);
 const index = Math.max(0, scenes.findLastIndex(scene => Number(scene.dataset.start) <= time));
 await go(index, { instant: true, seek: true }); stopAmbient(scenes[index]); art?.setMotion(false);
 const local = Math.max(0, time - Number(scenes[index].dataset.start));
 timelines[scenes[index].dataset.compositionId].seek(local).pause();
 if (isCollection(scenes[index])) { art?.seek(local); art?.setFocus(0); }
 if (scenes[index].dataset.compositionId === 'office-art') officeAccordion?.seek(local);
 spaceOpportunities.seek(scenes[index], local);
 if (isProjectCover(scenes[index])) projectField?.seek(local);
 updateChrome();
}
addEventListener('hf-seek', event => { const promise = seekTime(Number(event.detail?.time) || 0); event.detail?.waitUntil?.(promise); });
const ready = (async () => {
 const initialId = pendingExternalScene || initialSceneId(location.hash, savedSceneId(), sceneIds);
 const initial = scenes.findIndex(scene => scene.dataset.compositionId === initialId);
 await go(initial < 0 ? 0 : initial, { instant: phone.matches || reduced.matches });
 initialized = true;
 if (pendingExternalScene && pendingExternalScene !== scenes[state.index].dataset.compositionId) await go(pendingExternalScene);
 return true;
})();
window.rbbDeck = {
 go, next: () => stepBy(1), prev: () => stepBy(-1), seek: seekTime, ready,
 get state() { return JSON.parse(JSON.stringify(state)); },
 get catalogueCount() { return artworks.length; },
 openMenu: openOverview, closeMenu: closeOverview,
 resumeLive() { state.mode = 'live'; refreshMotion(); }
};
