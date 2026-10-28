// Method panel: every formula, assumption and source behind the on-screen estimates.
// It is generated from stats.js, so the panel cannot disagree with the graphics.
// Open it with I or ?, the Method button, any [data-open-method] element, or ?panel=method.

import {
  ACCOUNTED, SCENARIO, PERIOD_ROWS, MISSING_ROW, ASSUMPTIONS, ILLUSTRATIVE, BUILDINGS, SOURCE,
  equivalents, formatInteger,
} from './stats.js?v=3581e4cf70f3ee9bef84';

const money = value => value >= 1e9 ? `$${Number((value / 1e9).toFixed(1))}B` : `$${Math.round(value / 1e6)}M`;
const e38 = equivalents(ACCOUNTED);
const e42 = equivalents(SCENARIO);

const EQUIVALENTS = [
  { label: 'Full-time working years', a: formatInteger(e38.fullTimeYears), b: formatInteger(e42.fullTimeYears), formula: 'labor hours ÷ 2,000 hours per year', basis: 'Email method' },
  { label: 'Years of round-the-clock work', a: formatInteger(e38.continuousYears), b: formatInteger(e42.continuousYears), formula: 'labor hours ÷ 8,760 hours (24 × 365)', basis: 'Email method; the email rounds 48,271 to 48,270' },
  { label: '40-year working careers', a: formatInteger(e38.careers), b: formatInteger(e42.careers), formula: 'labor hours ÷ 80,000 (40 years × 2,000 hours)', basis: 'Illustrative unit; an equivalent of hours, not a headcount' },
  { label: 'Concrete weight, US tons', a: formatInteger(e38.concreteTons), b: formatInteger(e42.concreteTons), formula: 'cubic yards × 4,000 lb ÷ 2,000 lb per ton', basis: 'Email method (“about 84.6 million tons”)' },
  { label: 'One solid cube of all the concrete', a: `${formatInteger(e38.cubeSideFeet)} ft per side`, b: `${formatInteger(e42.cubeSideFeet)} ft per side`, formula: '∛(cubic yards × 27 ft³)', basis: `Illustrative geometry; ${formatInteger(e38.cubeSideMeters)} m and ${formatInteger(e42.cubeSideMeters)} m` },
];

function markup() {
  const periods = PERIOD_ROWS.map(row => `<tr><th scope="row">${row.label}</th><td>${row.years}</td><td>${money(row.annualRevenue)}</td><td>${money(row.revenue)}</td><td>${formatInteger(row.laborHours)}</td><td>${formatInteger(row.concreteYd3)}</td></tr>`).join('');
  return `
  <div class="panel-bar"><button type="button" data-close>Close <kbd>Esc</kbd></button></div>
  <article class="method">
    <header class="method__head">
      <p class="eyebrow">Method, sources and assumptions</p>
      <h2 id="method-title">Illustrative estimates, not measured totals.</h2>
      <p class="method__lead">Bob Clark derived these figures from assumed average revenue by period. Labor and concrete are each a share of the same revenue base. They are not additive parts of a whole, and neither is a measured or independently verified company total.</p>
    </header>

    <section class="method__section" id="method-totals">
      <h3>Two bases, kept separate</h3>
      <table class="method__table method__table--compare">
        <thead><tr><th scope="col"></th><th scope="col">38 accounted years</th><th scope="col" class="is-hypothetical">Hypothetical 42-year scenario</th></tr></thead>
        <tbody>
          <tr><th scope="row">Years covered</th><td>${ACCOUNTED.years}: the listed revenue periods</td><td class="is-hypothetical">${SCENARIO.years}: adds ${MISSING_ROW.years} missing years at an assumed ${money(MISSING_ROW.annualRevenue)} each</td></tr>
          <tr><th scope="row">Revenue basis</th><td>${money(ACCOUNTED.revenue)}</td><td class="is-hypothetical">${money(SCENARIO.revenue)}</td></tr>
          <tr><th scope="row">Estimated human effort (labor hours)</th><td>${formatInteger(ACCOUNTED.laborHours)} hours</td><td class="is-hypothetical">${formatInteger(SCENARIO.laborHours)} hours</td></tr>
          <tr><th scope="row">Estimated concrete</th><td>${formatInteger(ACCOUNTED.concreteYd3)} yd³</td><td class="is-hypothetical">${formatInteger(SCENARIO.concreteYd3)} yd³</td></tr>
        </tbody>
      </table>
    </section>

    <section class="method__section method__formulas" id="method-formulas">
      <h3>Formulas</h3>
      <p><span>Labor hours</span> = revenue × ${ASSUMPTIONS.laborShare * 100}% ÷ $${ASSUMPTIONS.laborRate} per fully burdened labor hour</p>
      <p><span>Concrete</span> = revenue × ${ASSUMPTIONS.concreteShare * 100}% ÷ $${ASSUMPTIONS.concreteRate} per installed cubic yard</p>
      <p class="method__note">Both percentages are applied to the same total revenue; they aren’t separate, additive shares. Clayco’s revenue includes different types of construction, materials, subcontracting and potentially development-related activity, so these are illustrative estimates rather than measured quantities.</p>
    </section>

    <section class="method__section" id="method-periods">
      <h3>Assumed average revenue by period</h3>
      <table class="method__table">
        <thead><tr><th scope="col">Period, as listed</th><th scope="col">Years</th><th scope="col">Avg. annual revenue</th><th scope="col">Total</th><th scope="col">Labor hours</th><th scope="col">Concrete yd³</th></tr></thead>
        <tbody>${periods}
          <tr class="method__total"><th scope="row">38 accounted years</th><td>${ACCOUNTED.years}</td><td></td><td>${money(ACCOUNTED.revenue)}</td><td>${formatInteger(ACCOUNTED.laborHours)}</td><td>${formatInteger(ACCOUNTED.concreteYd3)}</td></tr>
          <tr class="is-hypothetical"><th scope="row">${MISSING_ROW.label}, hypothetical</th><td>${MISSING_ROW.years}</td><td>${money(MISSING_ROW.annualRevenue)} assumed</td><td>${money(MISSING_ROW.revenue)}</td><td>${formatInteger(MISSING_ROW.laborHours)}</td><td>${formatInteger(MISSING_ROW.concreteYd3)}</td></tr>
          <tr class="method__total is-hypothetical"><th scope="row">Hypothetical 42-year scenario</th><td>${SCENARIO.years}</td><td></td><td>${money(SCENARIO.revenue)}</td><td>${formatInteger(SCENARIO.laborHours)}</td><td>${formatInteger(SCENARIO.concreteYd3)}</td></tr>
        </tbody>
      </table>
      <p class="method__note">The periods are listed in sequence without calendar dates, except 2026. Which four years are missing is unresolved, so they are shown apart from the sequence, never placed within it. The last two periods listed, the seven-year period and 2026, hold ($35B + $12B) ÷ $59.2B = 79.4% of the 38-year estimate (“nearly four-fifths”). Layer shares on screen are rounded to 0.1% and total 99.9%.</p>
    </section>

    <section class="method__section" id="method-equivalents">
      <h3>Equivalents used on screen</h3>
      <table class="method__table">
        <thead><tr><th scope="col">Equivalent</th><th scope="col">38 accounted years</th><th scope="col" class="is-hypothetical">42-year scenario</th><th scope="col">Formula</th></tr></thead>
        <tbody>${EQUIVALENTS.map(row => `<tr><th scope="row">${row.label}<small>${row.basis}</small></th><td>${row.a}</td><td class="is-hypothetical">${row.b}</td><td>${row.formula}</td></tr>`).join('')}</tbody>
      </table>
      <p class="method__note">A cubic yard is a cube 3 ft on each side: ${ILLUSTRATIVE.cubicFeetPerYd3} ft³, or ${ILLUSTRATIVE.cubicMetersPerYd3.toFixed(3)} m³.</p>
    </section>

    <section class="method__section method__columns" id="method-sources">
      <div>
        <h3>Source</h3>
        <p>Estimates by ${SOURCE.author}, October 2026.</p>
        <p class="method__note">Every figure is re-derived from these assumptions and checked independently.</p>
      </div>
    </section>
  </article>`;
}

export function mountMethod(dialog, { onClose, onReview } = {}) {
  dialog.innerHTML = markup();
  dialog.setAttribute('aria-labelledby', 'method-title');
  dialog.querySelector('[data-close]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => onClose?.());
  return {
    open(anchor) {
      if (!dialog.open) dialog.showModal();
      const target = anchor && dialog.querySelector(`#method-${anchor}`);
      if (target) target.scrollIntoView({ block: 'start' }); else dialog.scrollTop = 0;
      dialog.querySelector('[data-close]').focus({ preventScroll: true });
    },
    close: () => dialog.close(),
  };
}
