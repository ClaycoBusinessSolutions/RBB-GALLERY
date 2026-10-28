// Slide: the work of generations, in hours and concrete. A still stats slide with no builds and
// no motion: a line naming the people behind the work, then two estimates, each with one of the
// email’s equivalents and the hypothetical 42-year figure. Every number comes from stats.js.

import { ACCOUNTED, SCENARIO, ASSUMPTIONS, equivalents, formatInteger, formatMoney } from '../stats.js?v=3581e4cf70f3ee9bef84';

const e38 = equivalents(ACCOUNTED);

const TEXT = {
  hours: formatInteger(ACCOUNTED.laborHours),
  'hours-years': `${formatInteger(e38.fullTimeYears)} full-time working years`,
  'hours-42': `${formatInteger(SCENARIO.laborHours)} with the four missing years, hypothetical`,
  yd3: formatInteger(ACCOUNTED.concreteYd3),
  'yd3-tons': `About ${Number((e38.concreteTons / 1e6).toFixed(1))} million US tons`,
  'yd3-42': `${formatInteger(SCENARIO.concreteYd3)} with the four missing years, hypothetical`,
  caption: `<b>Illustrative estimates for the 38 accounted years</b>, from ${formatMoney(ACCOUNTED.revenue)} of assumed revenue: labor costs as ${ASSUMPTIONS.laborShare * 100}% at $${ASSUMPTIONS.laborRate} an hour, concrete as ${ASSUMPTIONS.concreteShare * 100}% at $${ASSUMPTIONS.concreteRate} a cubic yard, both from the same revenue. Dashed lines: four missing years at an assumed $2B each.`,
};

export function createSummaryScene() {
  return {
    id: 'summary',
    label: 'The work of generations, in hours and concrete',
    steps: 1,
    mount(section) {
      for (const [name, html] of Object.entries(TEXT)) {
        const element = section.querySelector(`[data-summary-${name}]`);
        if (element) element.innerHTML = html;
      }
    },
  };
}
