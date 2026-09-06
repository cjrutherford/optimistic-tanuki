/**
 * Reading a company out of a funding headline.
 *
 * The provider used to store the whole headline as the lead's company, so the
 * leads list showed rows called "Acme raises $50M Series B to expand platform"
 * in a column headed Company. A headline is not a company name, and pretending
 * otherwise makes every downstream use of the field wrong — the greeting on a
 * generated message most of all.
 *
 * Funding coverage is formulaic enough that the subject can usually be taken
 * from the front of the sentence. When it cannot, this returns null and the
 * caller records no company at all, which is the honest outcome: a missing
 * field invites a correction, a wrong one does not.
 */

/** The verbs funding coverage uses, in the order a headline puts them. */
const FUNDING_VERBS =
  /\b(raises|raised|raising|lands|landed|secures|secured|closes|closed|nets|netted|banks|banked|announces|announced|picks up|picked up|scores|scored|snags|snagged|bags|bagged|pulls in|pulled in|attracts|attracted|receives|received)\b/i;

/** Publications that sign their headlines, so the byline can be trimmed. */
const PUBLISHER_SUFFIX =
  /\s*[|–—-]\s*(Crunchbase|TechCrunch|Reuters|Bloomberg|Business Wire|PR Newswire|VentureBeat|Sifted|Axios|Forbes|The Verge|Fortune)\s*$/i;

/** Leading noise some feeds prepend: "Exclusive: ", "Breaking — ". */
const LEADING_LABEL =
  /^\s*(exclusive|breaking|update|report|scoop)\s*[:–—-]\s*/i;

export const stripPublisherSuffix = (headline: string): string =>
  (headline || '').replace(PUBLISHER_SUFFIX, '').trim();

/**
 * The company a funding headline is about, or null when the shape is not
 * recognisable enough to be sure.
 */
export const extractCompanyFromHeadline = (headline: string): string | null => {
  const cleaned = stripPublisherSuffix(headline).replace(LEADING_LABEL, '');
  if (!cleaned) {
    return null;
  }

  const verbMatch = cleaned.match(FUNDING_VERBS);
  if (!verbMatch || verbMatch.index === undefined || verbMatch.index === 0) {
    return null;
  }

  // "Acme, a logistics startup, raises $50M" — the aside describes the
  // company, it is not part of its name.
  let subject = cleaned.slice(0, verbMatch.index).split(',')[0].trim();

  // A headline that opens with the amount puts the company after it, which
  // this shape cannot read: "$50M for Acme" would yield "$50M".
  if (/^[$€£]/.test(subject)) {
    return null;
  }

  subject = subject.replace(/\s+/g, ' ').trim();

  // Guard both ends: a single stray token is more likely a fragment than a
  // name, and a long run is the headline itself rather than its subject.
  const wordCount = subject.split(' ').length;
  if (!subject || wordCount > 6 || subject.length < 2) {
    return null;
  }

  return subject;
};

/**
 * The funding amount a headline or snippet states, as it was written.
 *
 * Kept as the source's own text rather than parsed into a number: it is a fact
 * about the company's balance sheet, not about the size of any work the user
 * might do, and the moment it becomes a number something renders it as money.
 */
export const extractFundingAmount = (text: string): string | null => {
  const match = (text || '').match(
    /[$€£]\s?\d+(?:[.,]\d+)?\s*(?:k|m|bn|b|million|billion|thousand)?/i
  );
  return match ? match[0].replace(/\s+/g, '').trim() : null;
};
