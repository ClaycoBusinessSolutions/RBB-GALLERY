// Clayco company statistics: the single source for every number in this prototype.
//
// Source: Bob Clark's email of 28 October 2026 (reference/Bob-Clark-2026-10-28.md).
// Every result is an illustrative estimate derived from revenue assumptions. None is a
// measured or independently verified company total, so keep that label visible.
// tools/verify-stats.mjs re-derives each figure independently and checks it against the email.

export const SOURCE = {
  author: 'Robert G. Clark, Executive Chairman & Founder',
};

// Average annual revenue by period, exactly as listed in the email. These are
// assumptions, not reported revenue for any particular year.
export const PERIODS = [
  { id: 'first-5', label: 'First 5 years', years: 5, annualRevenue: 40e6 },
  { id: 'next-10-a', label: 'Next 10 years', years: 10, annualRevenue: 200e6 },
  { id: 'next-10-b', label: 'Next 10 years', years: 10, annualRevenue: 500e6 },
  { id: 'next-5', label: 'Next 5 years', years: 5, annualRevenue: 1e9 },
  { id: 'next-7', label: 'Next 7 years', years: 7, annualRevenue: 5e9 },
  { id: 'year-2026', label: '2026', years: 1, annualRevenue: 12e9 },
];

// The hypothetical 42-year scenario adds four missing years at an assumed $2B each.
// Which four years are missing is unresolved: never give them calendar dates or a
// position within the accounted timeline.
export const MISSING_YEARS = {
  id: 'missing-4', label: 'Four missing years', years: 4, annualRevenue: 2e9,
  hypothetical: true, placement: 'unresolved',
};

export const ASSUMPTIONS = {
  laborShare: 0.5,              // labor: 50% of revenue...
  laborRate: 70,                // ...at $70 per fully burdened labor hour
  concreteShare: 0.25,          // concrete: 25% of the same revenue base, not an additive share...
  concreteRate: 350,            // ...at $350 per installed cubic yard
  concretePoundsPerYd3: 4000,   // "roughly 4,000 pounds per cubic yard"
  fullTimeHoursPerYear: 2000,
  continuousHoursPerYear: 8760, // 24 hours x 365 days
};

// Units introduced by this prototype. They are creative interpretation, so label them illustrative.
export const ILLUSTRATIVE = {
  careerYears: 40,              // one working career = 40 full-time years = 80,000 hours
  cubicFeetPerYd3: 27,          // a cubic yard is a 3 ft x 3 ft x 3 ft cube
  cubicMetersPerYd3: 0.764554857984,
  poundsPerShortTon: 2000,
};

// Figures as printed in the email. They are kept only to check the calculations below.
export const STATED = {
  accounted: {
    years: 38, revenue: 59.2e9, laborHours: 422_857_143, concreteYd3: 42_285_714, concreteTons: 84.6e6,
    fullTimeYears: 211_429, people: 24_123, peopleYears: 8.76, continuousYears: 48_270,
  },
  scenario: { years: 42, revenue: 67.2e9, laborHours: 480e6, concreteYd3: 48e6, buildings: '1,250+' },
  legacy: 'Over 42 years, Clayco has helped build more than 1,250 buildings, representing an estimated $67 billion in construction activity. Behind those buildings are approximately half a billion hours of human effort and nearly 50 million cubic yards of concrete',
};

// Two building counts with different provenance. Show both until one is confirmed.
export const BUILDINGS = {};

export const laborHours = revenue => revenue * ASSUMPTIONS.laborShare / ASSUMPTIONS.laborRate;
export const concreteYd3 = revenue => revenue * ASSUMPTIONS.concreteShare / ASSUMPTIONS.concreteRate;

function describe(period) {
  const revenue = period.years * period.annualRevenue;
  return { ...period, revenue, laborHours: laborHours(revenue), concreteYd3: concreteYd3(revenue) };
}

function total(rows) {
  const revenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const years = rows.reduce((sum, row) => sum + row.years, 0);
  return { years, revenue, laborHours: laborHours(revenue), concreteYd3: concreteYd3(revenue) };
}

export const PERIOD_ROWS = PERIODS.map(describe);
export const MISSING_ROW = describe(MISSING_YEARS);
export const ACCOUNTED = { id: 'accounted', label: '38 accounted years', ...total(PERIOD_ROWS) };
export const SCENARIO = { id: 'scenario', label: 'Hypothetical 42-year scenario', ...total([...PERIOD_ROWS, MISSING_ROW]) };

// Equivalents for either total. The email itself uses fullTimeYears, continuousYears and
// concreteTons. The others are new to this prototype and must be labeled illustrative.
export function equivalents({ laborHours: hours, concreteYd3: yd3 }) {
  const m3 = yd3 * ILLUSTRATIVE.cubicMetersPerYd3;
  return {
    fullTimeYears: hours / ASSUMPTIONS.fullTimeHoursPerYear,
    continuousYears: hours / ASSUMPTIONS.continuousHoursPerYear,
    careers: hours / (ILLUSTRATIVE.careerYears * ASSUMPTIONS.fullTimeHoursPerYear),
    concreteTons: yd3 * ASSUMPTIONS.concretePoundsPerYd3 / ILLUSTRATIVE.poundsPerShortTon,
    concreteCubicMeters: m3,
    cubeSideFeet: Math.cbrt(yd3 * ILLUSTRATIVE.cubicFeetPerYd3),
    cubeSideMeters: Math.cbrt(m3),
  };
}

const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
export const formatInteger = value => integer.format(Math.round(value));

// 422,857,143 -> "422.9M"; 67.2e9 -> "67.2B"; 480e6 -> "480M".
export function formatCompact(value, digits = 1) {
  const [divisor, suffix] = value >= 1e9 ? [1e9, 'B'] : value >= 1e6 ? [1e6, 'M'] : value >= 1e3 ? [1e3, 'K'] : [1, ''];
  return `${Number((value / divisor).toFixed(digits))}${suffix}`;
}
export const formatMoney = (value, digits = 1) => `$${formatCompact(value, digits)}`;
