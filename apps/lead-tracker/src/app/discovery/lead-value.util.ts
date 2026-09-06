/**
 * What a service-buyer lead is worth.
 *
 * Both buyer sources used to invent this figure, and the leads table renders it
 * as dollars. Funding news took the largest number anywhere in the article, so
 * a company raising $50M appeared as a $50,000,000 deal — their money, shown as
 * yours. The local sources computed it from the presence-gap score, which is a
 * relevance weighting and not a currency at all.
 *
 * Neither source can know what a piece of work is worth. The user can, and
 * onboarding already asks: `budgetRange` has been collected since the beginning
 * and read by nothing. Seeding from it makes a buyer pipeline total mean
 * "roughly this much work at my usual rate", which is a claim that survives
 * being looked at.
 */

/**
 * A representative figure for a budget band.
 *
 * The onboarding wizard offers "Under $5k", "$5k-$25k", "$25k-$100k" and
 * "$100k+", but this parses the shape rather than the four literals so that
 * changing the wording does not silently zero every buyer lead.
 *
 * Returns 0 when nothing usable was given — an unknown value stays unknown
 * rather than becoming a confident-looking guess.
 */
export const estimateBuyerLeadValue = (
  budgetRange: string[] | undefined | null
): number => {
  const band = (budgetRange || []).map((value) => value.trim()).find(Boolean);
  if (!band) {
    return 0;
  }

  const amounts = Array.from(
    band.matchAll(/(\d+(?:[.,]\d+)?)\s*([km])?/gi)
  ).map(([, digits, unit]) => {
    const magnitude = Number(digits.replace(/,/g, ''));
    if (!Number.isFinite(magnitude)) {
      return 0;
    }
    const scale = unit?.toLowerCase() === 'm' ? 1_000_000 : 1_000;
    return magnitude * scale;
  });

  const usable = amounts.filter((amount) => amount > 0);
  if (!usable.length) {
    return 0;
  }

  // "$5k-$25k" — the middle of the band is the honest single number.
  if (usable.length >= 2) {
    return Math.round((usable[0] + usable[usable.length - 1]) / 2);
  }

  // "Under $5k" is a ceiling, so half of it represents the band; "$100k+" is a
  // floor with no stated top, so the floor is the most that can be claimed.
  return /under|below|less than|up to/i.test(band)
    ? Math.round(usable[0] / 2)
    : usable[0];
};
