/** Shared reveal choreography. The same quiet rise and mask accompanies the
 * Osmo arc transition throughout the invitation, projects, art and space studies.
 * A single parent timeline owns every reveal; nothing continues off-slide.
 */
export const SCENE_MOTION = Object.freeze({ duration: 1.45, ease: 'power3.inOut' });

function elements(scene) {
  const heading = scene.querySelector('h1:not(.clark-brandmark),h2:not(.clark-brandmark),.source-invitation-copy');
  const labels = [...scene.querySelectorAll('.eyebrow,.invitation-cover__years')];
  const visuals = [...scene.querySelectorAll('.invitation-cover__architecture,.source-art-pair figure,.hope-gallery__viewport,.project-queue__grid,.space-opportunity__reference,.space-opportunity__model,[data-scene-visual]')].filter(element => element !== heading && !element.matches('.clark-brandmark'));
  const copy = [...scene.querySelectorAll('.source-statement__body > p,.invitation-cover__subtitle,.collaboration-invitation__lead,.collaboration-invitation__questions > p,.hope-gallery__story > p,.space-overview__copy > p,.space-opportunity__copy,.model-copy,.model-note,.statement-tail,.cover-caption,.closing-note,.voices-copy > p:not(.eyebrow),.source-caption,[data-queued-reveal]')]
    .filter((element, index, all) => element !== heading && all.indexOf(element) === index && !element.closest('[hidden]'));
  const controls = [...scene.querySelectorAll('.invitation-cover__begin,.scene-cta,.begin,.hope-gallery__tabs,.space-opportunity__controls')];
  return { heading, labels, visuals, copy, controls };
}

export function settleSceneReveal(scene) {
  const { heading, labels, visuals, copy, controls } = elements(scene);
  const targets = [heading, ...labels, ...visuals, ...copy, ...controls].filter(Boolean);
  if (!targets.length) return;
  globalThis.gsap.set(targets, {
    clearProps: 'opacity,visibility,transform,clipPath'
  });
}

export function addSceneReveal(parent, scene, { instant = false, direction = 1, compact = false } = {}) {
  if (instant) { settleSceneReveal(scene); return; }
  const gsap = globalThis.gsap;
  const { heading, labels, visuals, copy, controls } = elements(scene);
  if (compact) {
    // A phone gets one small editorial rise, not a stack of image masks or
    // individual paragraph timelines. The page wipe owns the main movement.
    const targets = [heading, ...labels.slice(0, 1)].filter(Boolean);
    if (targets.length) parent.fromTo(targets, { opacity: .45, y: 12 * direction }, {
      opacity: 1, y: 0, duration: .78, ease: 'power2.out', stagger: .05
    }, .32);
    parent.call(() => settleSceneReveal(scene), [], 1.18);
    return;
  }
  const timeline = gsap.timeline({ defaults: { ease: 'power3.out', duration: .85 } });
  timeline.addLabel('label', .3).addLabel('image', .32).addLabel('title', .42).addLabel('copy', .56);
  // No per-character scatter or independent springs: one shared direction and beat.
  if (labels.length) timeline.fromTo(labels, { autoAlpha: 0, y: 12 * direction }, { autoAlpha: 1, y: 0, duration: .6 }, 'label');
  if (visuals.length) timeline.fromTo(visuals, { clipPath: 'inset(0% 0% 100% 0%)', y: 28 * direction }, {
    clipPath: 'inset(0% 0% 0% 0%)', y: 0, duration: 1, stagger: .06
  }, 'image');
  if (heading) {
    // Tight editorial line boxes can be smaller than the glyph ink. Reveal the
    // overshoot too, so removing the mask never pops in the bottoms of letters.
    // Use unscaled layout pixels: the whole presentation stage may be scaled.
    const bleed = Math.ceil(parseFloat(getComputedStyle(heading).fontSize) * .25);
    const hidden = `inset(${-bleed}px ${-bleed}px ${heading.offsetHeight + bleed}px ${-bleed}px)`;
    const visible = `inset(${-bleed}px ${-bleed}px ${-bleed}px ${-bleed}px)`;
    timeline.fromTo(heading, { autoAlpha: 0, y: 35 * direction, clipPath: hidden }, {
      autoAlpha: 1, y: 0, clipPath: visible, duration: .95
    }, 'title');
  }
  if (copy.length) timeline.fromTo(copy, { autoAlpha: 0, y: 18 * direction }, { autoAlpha: 1, y: 0, stagger: { amount: .16 }, duration: .72 }, 'copy');
  if (controls.length) timeline.fromTo(controls, { autoAlpha: 0, y: 10 * direction }, { autoAlpha: 1, y: 0, duration: .5 }, .85);
  timeline.call(() => settleSceneReveal(scene));
  parent.add(timeline, 0);
}
