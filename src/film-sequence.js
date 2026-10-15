/**
 * Two-slot, silent film playlists for the native deck and its hf-seek bridge.
 *
 * Manifest: { sequences: { experience: [{ id, src, poster, duration, option,
 *   label?, status?, source_slide? }], prefunction: [...], timeline: [...] } }
 * Legacy option entries are supported until explicit sequences are supplied.
 * A location sequence may show several designs. selectOption() jumps to the
 * first matching genuine clip; it does not filter or retag the other clips.
 *
 * Integration: one mount per .film-picture; remove the previous owned video.
 * await prepare()/setContext() before revealing a scene. Only its active player
 * receives setActive(true). Pass the deck's M/overlay gates, await seek(local)
 * from the existing hf-seek handler, and call resumeLive() only in native live
 * playback or the already verified HyperFrames slideshow presenter bridge.
 * Do not also call play()/pause()/currentTime on these owned video elements.
 * This module does not declare false HyperFrames media tracks; seek() replaces
 * its live-only clock with an explicit, paused timeline position.
 *
 * Status: pending = no eligible sources; partial = fewer than expectedCount;
 * ready = enough sources declared, not an editorial approval. mediaStatus
 * retains the source's provisional/review state. A load/seek/play failure sets
 * status=error and freezes the sequence; replay()/choose()/seek() explicitly
 * retry. Original source-rendering controls can remain available on failure.
 */

const LEGACY = { experience: ['table', 'glass'], prefunction: ['shelf', 'plinth'], timeline: ['wall', 'combined'] };
const LABELS = { table: 'Model table', glass: 'Glass floor', shelf: 'Shelves + table', plinth: 'Display plinths', wall: 'Timeline wall', combined: 'Connected spaces' };
const PENDING = new Set(['pending', 'queued', 'generating', 'failed', 'rejected', 'missing']);
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const mod = (n, length) => ((n % length) + length) % length;
let mountId = 0;

/** No source duplication is allowed to inflate the available film count. */
export function resolveFilmSequence(manifest, location) {
  const warnings = [], seenSources = new Set(), seenAssets = new Set();
  const explicit = manifest?.sequences?.[location];
  const source = Array.isArray(explicit) ? explicit : (LEGACY[location] || []).flatMap(option => manifest?.[option] ? [{ ...manifest[option], option }] : []);
  const clips = [];
  for (const [index, item] of source.entries()) {
    if (!item || typeof item.src !== 'string' || !item.src.trim() || PENDING.has(String(item.status || '').toLowerCase())) continue;
    const duration = Number(item.duration), option = typeof item.option === 'string' ? item.option.trim() : '';
    if (!(duration > .1) || !Number.isFinite(duration) || !option) {
      warnings.push(`Clip ${index + 1} needs a finite duration and an explicit design option.`);
      continue;
    }
    let sourceKey;
    try { const url = new URL(item.src, globalThis.document?.baseURI || 'https://local.invalid/'); sourceKey = `${url.origin}${url.pathname}`; }
    catch { warnings.push(`Clip ${index + 1} has an invalid source.`); continue; }
    const assetKey = item.sha256 || item.assetId || null;
    if (seenSources.has(sourceKey) || (assetKey && seenAssets.has(assetKey))) {
      warnings.push(`Duplicate source excluded: ${item.id || item.src}`);
      continue;
    }
    seenSources.add(sourceKey); if (assetKey) seenAssets.add(assetKey);
    clips.push({ ...item, id: String(item.id || `${location}-${option}-${index + 1}`), src: item.src.trim(), duration, option, label: item.label || LABELS[option] || option, status: item.status || 'unreviewed' });
  }
  return { clips, warnings };
}

export function mountFilmSequence(host, {
  location = 'experience', manifest = {}, onStatus, crossfade = .55,
  expectedCount = 3, showIndicator = true, poster = '',
} = {}) {
  if (!(host instanceof Element)) throw new TypeError('mountFilmSequence requires a host element.');
  const id = ++mountId, reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const cssURL = new URL('../styles/film-sequence.css', import.meta.url).href;
  if (![...document.querySelectorAll('link[rel="stylesheet"]')].some(link => link.href === cssURL)) {
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = cssURL; document.head.append(link);
  }
  const root = document.createElement('div'); root.className = 'rbb-film-sequence';
  const fallback = document.createElement('img'); fallback.className = 'rbb-film-sequence__poster'; fallback.alt = '';
  fallback.decoding = 'async'; fallback.hidden = true; root.append(fallback);
  const slots = Array.from({ length: 2 }, (_, index) => {
    const video = document.createElement('video');
    video.id = `rbb-sequence-${id}-${index}`; video.className = 'rbb-film-sequence__video';
    video.muted = video.defaultMuted = true; video.playsInline = true; video.preload = 'none';
    video.setAttribute('aria-hidden', 'true'); video.disablePictureInPicture = true;
    root.append(video);
    return { video, clip: null, key: '', loaded: false, token: 0, loading: null, playPending: false };
  });
  const indicator = document.createElement('div'); indicator.className = 'rbb-film-sequence__indicator';
  indicator.hidden = !showIndicator;
  const counter = document.createElement('span'), label = document.createElement('span'), availability = document.createElement('span');
  counter.className = 'rbb-film-sequence__count'; label.className = 'rbb-film-sequence__label'; availability.className = 'rbb-film-sequence__availability';
  indicator.append(counter, label, availability); root.append(indicator); host.append(root);

  let currentLocation = location, currentManifest = manifest, fallbackPoster = poster;
  let clips = [], warnings = [], starts = [], fade = 0, duration = 0, sequenceTime = 0;
  let active = false, motion = true, overlay = false, mode = 'live', disposed = false;
  let revision = 0, frame = 0, stamp = 0, busy = false, pendingRender = null, currentSample = null;
  let error = null, selectionUnavailable = null, lastStatusKey = '', suppressFadeUntil = -1;
  let showing = new Set();

  const canRun = () => !disposed && !error && active && motion && !overlay && !document.hidden && !reduced.matches && mode === 'live' && clips.length > 0;
  const pauseAll = () => { for (const slot of slots) slot.video.pause(); };
  function cancelFrame() { if (frame) cancelAnimationFrame(frame); frame = 0; stamp = 0; }
  function sample(time = sequenceTime) {
    if (!clips.length || !duration) return null;
    const local = mod(Math.max(0, time), duration);
    let index = starts.length - 1;
    while (index > 0 && local < starts[index]) index--;
    const clipTime = local - starts[index];
    const blending = fade > 0 && clipTime < fade && (index > 0 || time >= duration) && time >= suppressFadeUntil;
    const alpha = blending ? clamp(clipTime / fade, 0, 1) : 1;
    return { index, clip: clips[index], clipTime, previous: blending ? mod(index - 1, clips.length) : -1, alpha };
  }
  function getState() {
    const position = currentSample || sample();
    const clip = position?.clip || null;
    return {
      location: currentLocation, clipIndex: position?.index ?? -1, clipCount: clips.length,
      expectedCount, clip, option: clip?.option || null, label: clip?.label || null,
      currentTime: position?.clipTime || 0, sequenceTime, duration, crossfade: fade,
      status: error ? 'error' : !clips.length ? 'pending' : clips.length < expectedCount ? 'partial' : 'ready',
      mediaStatus: clip?.status || null, active, motion, overlayOpen: overlay, mode,
      playing: canRun() && [...showing].some(slot => !slot.video.paused), loading: busy,
      availableOptions: [...new Set(clips.map(item => item.option))], selectionUnavailable, error,
      warnings: [...warnings], videoCount: 2,
    };
  }
  function notify(force = false) {
    if (disposed) return;
    const state = getState();
    root.dataset.status = state.status; root.dataset.location = currentLocation;
    root.dataset.clipIndex = String(state.clipIndex); root.dataset.option = state.option || '';
    root.dataset.mode = mode;
    counter.textContent = state.clipCount ? `${String(state.clipIndex + 1).padStart(2, '0')} / ${String(state.clipCount).padStart(2, '0')}` : '';
    label.textContent = state.label || 'Film sequence pending';
    availability.textContent = state.status === 'partial' ? `${state.clipCount} of ${expectedCount} films available` : state.status === 'error' ? 'Film unavailable' : '';
    const key = JSON.stringify([state.location, state.clipIndex, state.clipCount, state.option, state.status, state.active, state.motion, state.overlayOpen, state.mode, state.playing, state.selectionUnavailable, state.error]);
    if (force || key !== lastStatusKey) {
      lastStatusKey = key;
      try { onStatus?.(state); } catch (cause) { console.warn('[RBB film sequence] Status callback:', cause); }
    }
  }
  function setPoster(clip) {
    const src = clip?.poster || fallbackPoster;
    if (src) { if (fallback.getAttribute('src') !== src) fallback.src = src; fallback.hidden = false; }
    else { fallback.hidden = true; fallback.removeAttribute('src'); }
  }
  function waitFor(video, events, ready, timeout = 6000) {
    if (ready()) return Promise.resolve(true);
    return new Promise(resolve => {
      let timer;
      const done = ok => { clearTimeout(timer); for (const event of events) video.removeEventListener(event, check); video.removeEventListener('error', failed); resolve(ok); };
      const check = () => { if (ready()) done(true); };
      const failed = () => done(false);
      for (const event of events) video.addEventListener(event, check);
      video.addEventListener('error', failed);
      timer = setTimeout(() => done(false), timeout);
    });
  }
  function keyFor(clip) { return `${clip.id}|${clip.src}|${clip.duration}`; }
  function load(slot, clip) {
    const key = keyFor(clip);
    if (slot.key === key) return slot.loaded ? Promise.resolve(true) : slot.loading || Promise.resolve(false);
    const token = ++slot.token;
    slot.video.pause(); slot.video.style.opacity = '0'; slot.video.style.zIndex = '0';
    slot.clip = clip; slot.key = key; slot.loaded = false; slot.playPending = false;
    slot.video.preload = 'auto'; slot.video.poster = clip.poster || ''; slot.video.src = new URL(clip.src, document.baseURI).href;
    slot.video.load();
    slot.loading = waitFor(slot.video, ['loadeddata', 'canplay'], () => slot.video.readyState >= 2).then(ok => {
      if (disposed || token !== slot.token) return false;
      slot.loaded = ok;
      return ok;
    });
    return slot.loading;
  }
  async function position(slot, time, exact) {
    const target = clamp(time, 0, Math.max(0, Math.min(slot.clip.duration, slot.video.duration || slot.clip.duration) - .001));
    if (!exact && Math.abs(slot.video.currentTime - target) < .24 && !slot.video.ended) return true;
    if (Math.abs(slot.video.currentTime - target) <= 1 / 240 && !slot.video.seeking && slot.video.readyState >= 2) return true;
    try { slot.video.currentTime = target; } catch { return false; }
    return waitFor(slot.video, ['seeked', 'loadeddata', 'canplay'], () => !slot.video.seeking && slot.video.readyState >= 2 && Math.abs(slot.video.currentTime - target) < .08, 4000);
  }
  function play(slot) {
    if (!canRun() || !showing.has(slot) || slot.playPending || !slot.video.paused) return;
    slot.playPending = true;
    const token = slot.token;
    const promise = slot.video.play();
    Promise.resolve(promise).then(() => {
      if (disposed || token !== slot.token || !canRun() || !showing.has(slot)) slot.video.pause();
    }).catch(cause => {
      if (token === slot.token && canRun() && cause?.name !== 'AbortError') { error = `Playback unavailable for ${slot.clip?.label || 'this film'}.`; pauseAll(); notify(); }
    }).finally(() => { if (token === slot.token) slot.playPending = false; });
  }
  async function renderAt(time, exact = false, token = revision) {
    const target = sample(time);
    if (!target) {
      pauseAll(); showing.clear(); currentSample = null; setPoster(null);
      for (const slot of slots) slot.video.style.opacity = '0';
      notify(); return false;
    }
    const fail = () => {
      if (disposed || token !== revision) return false;
      error = `Could not load ${target.clip.label}.`;
      currentSample = target; showing.clear(); pauseAll(); setPoster(target.clip);
      for (const slot of slots) slot.video.style.opacity = '0';
      notify(true); return false;
    };
    const mainKey = keyFor(target.clip), previousClip = target.previous >= 0 ? clips[target.previous] : null;
    let main = slots.find(slot => slot.key === mainKey);
    if (!main) main = previousClip ? slots.find(slot => slot.key !== keyFor(previousClip)) : slots.find(slot => !showing.has(slot)) || slots[0];
    const other = slots.find(slot => slot !== main);
    if (!main.loaded || main.key !== mainKey) setPoster(target.clip);
    const loaded = await load(main, target.clip);
    if (disposed || token !== revision) return false;
    if (!loaded) return fail();
    if (previousClip && !(await load(other, previousClip))) return fail();
    if (disposed || token !== revision) return false;
    if (exact) pauseAll();
    const positions = [position(main, target.clipTime, exact)];
    if (previousClip) positions.push(position(other, previousClip.duration - fade + target.clipTime, exact));
    const positioned = (await Promise.all(positions)).every(Boolean);
    if (disposed || token !== revision) return false;
    if (!positioned) return fail();
    currentSample = target; showing = new Set(previousClip ? [main, other] : [main]);
    main.video.style.zIndex = '2'; main.video.style.opacity = String(target.alpha);
    // Source-over compositing: keep the outgoing frame opaque underneath the
    // incoming alpha, rather than dimming both frames toward the background.
    other.video.style.zIndex = '1'; other.video.style.opacity = previousClip ? '1' : '0';
    fallback.hidden = true; error = null;
    if (previousClip) { if (canRun()) play(other); }
    else {
      other.video.pause();
      // Preload only the adjacent clip. Never mount or preload a whole catalogue.
      if (clips.length > 1 && mode === 'live') load(other, clips[(target.index + 1) % clips.length]);
    }
    if (canRun()) play(main); else pauseAll();
    notify(); return true;
  }
  function tick(now) {
    frame = 0;
    if (!canRun()) { stamp = 0; pauseAll(); return; }
    if (!stamp) stamp = now;
    if (!busy && now - stamp >= 1000 / 30 - .5) {
      sequenceTime += Math.min((now - stamp) / 1000, .12); stamp = now;
      busy = true;
      const token = revision;
      pendingRender = renderAt(sequenceTime, false, token).finally(() => { if (token === revision) busy = false; });
    }
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    cancelFrame();
    if (!canRun()) pauseAll();
    else { for (const slot of showing) play(slot); frame = requestAnimationFrame(tick); }
    notify();
  }
  async function settle(time, { live = false, cut = false } = {}) {
    const token = ++revision;
    cancelFrame(); pauseAll(); busy = true; sequenceTime = Math.max(0, Number(time) || 0);
    // Retry failed sources only after an explicit seek/selection/replay/update.
    // Automatic playback freezes on an error instead of issuing more requests.
    if (error) for (const slot of slots) if (!slot.loaded) { slot.key = ''; slot.loading = null; }
    error = null;
    mode = live ? 'live' : 'seek'; suppressFadeUntil = cut ? sequenceTime + fade : -1;
    const ok = await renderAt(sequenceTime, true, token);
    if (disposed || token !== revision) return false;
    busy = false; sync(); return ok;
  }
  async function prepare() {
    const token = revision; busy = true;
    const ok = await renderAt(sequenceTime, true, token);
    if (disposed || token !== revision) return false;
    busy = false; sync(); return ok;
  }
  async function setManifest(nextManifest) {
    const old = sample(), oldId = old?.clip.id, oldTime = old?.clipTime || 0;
    currentManifest = nextManifest || {};
    const resolved = resolveFilmSequence(currentManifest, currentLocation); clips = resolved.clips; warnings = resolved.warnings;
    fade = clips.length > 1 ? clamp(Number(crossfade) || 0, 0, Math.min(...clips.map(clip => clip.duration)) / 3) : 0;
    starts = []; duration = 0;
    for (const clip of clips) { starts.push(duration); duration += clip.duration - fade; }
    const retainedIndex = clips.findIndex(clip => clip.id === oldId);
    const nextTime = retainedIndex >= 0 ? starts[retainedIndex] + Math.min(oldTime, clips[retainedIndex].duration - fade - .001) : 0;
    currentSample = null; selectionUnavailable = null;
    return settle(nextTime, { live: mode === 'live', cut: true });
  }
  async function choose(index) {
    if (!Number.isInteger(index) || index < 0 || index >= clips.length || disposed) return false;
    selectionUnavailable = null;
    return settle(starts[index], { live: true, cut: true });
  }
  async function selectOption(option) {
    const index = clips.findIndex(clip => clip.option === option);
    if (index < 0) { selectionUnavailable = option; notify(true); return false; }
    return choose(index);
  }
  async function setContext(context = {}) {
    if (context.poster !== undefined) fallbackPoster = context.poster || '';
    if (context.location && context.location !== currentLocation) {
      currentLocation = context.location; sequenceTime = 0; currentSample = null;
      clips = []; starts = []; duration = 0;
      await setManifest(currentManifest);
    }
    if (context.option) return selectOption(context.option);
    return prepare();
  }
  const visibilityChanged = () => sync();
  const reducedChanged = () => sync();
  document.addEventListener('visibilitychange', visibilityChanged);
  reduced.addEventListener('change', reducedChanged);
  for (const slot of slots) slot.video.addEventListener('playing', () => { if (!canRun() || !showing.has(slot)) slot.video.pause(); });
  const ready = setManifest(currentManifest);
  return {
    ready, prepare, setManifest, setContext, choose, selectOption,
    setActive(value) { active = Boolean(value); sync(); },
    setMotion(value) { motion = Boolean(value); sync(); },
    setOverlayOpen(value) { overlay = Boolean(value); sync(); },
    seek(seconds) { return settle(seconds); },
    resumeLive() { mode = 'live'; sync(); },
    replay() { return settle(0, { live: true, cut: true }); },
    get state() { return getState(); },
    dispose() {
      if (disposed) return;
      disposed = true; revision++; cancelFrame(); pauseAll();
      document.removeEventListener('visibilitychange', visibilityChanged); reduced.removeEventListener('change', reducedChanged);
      for (const slot of slots) { slot.token++; slot.video.removeAttribute('src'); slot.video.load(); }
      root.remove(); showing.clear(); pendingRender = null;
    },
  };
}
