// "Behind the buildings" in the public RBB deck: one still statistics slide. The deck's
// presentation.js calls this module at a few points (built in by tools/build-deck.mjs --master).
// I opens the method panel, with the formulas, assumptions and source behind the figures.

import { createSummaryScene } from './scenes/summary.js?v=3581e4cf70f3ee9bef84';
import { mountMethod } from './method.js?v=3581e4cf70f3ee9bef84';

export function mountBehindTheBuildings({ onClose }) {
  const section = document.querySelector('[data-composition-id="stats-summary"]');
  if (section) createSummaryScene().mount(section);
  const method = mountMethod(document.querySelector('#bb-method'), { onClose });
  return {
    enter() {},
    leave() {},
    step() { return false; },
    key(event, scene) {
      if (!section || scene !== section || event.repeat) return false;
      const key = event.key.toLowerCase();
      if (key !== 'i' && key !== '?') return false;
      method.open();
      event.preventDefault();
      return true;
    },
    resize() {},
  };
}
