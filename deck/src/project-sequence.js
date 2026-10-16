// Next and Previous move a persistent vertical track, including the red intro.
const isMarket = scene => scene?.matches('.seminal-projects');
const isIntro = scene => scene?.dataset.compositionId === 'projects-intro';
export const isProjectSequence = (from, to) =>
  (isMarket(from) && (isMarket(to) || isIntro(to))) || (isIntro(from) && isMarket(to));
