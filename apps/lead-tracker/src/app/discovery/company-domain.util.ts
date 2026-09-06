/**
 * Finding the company a funding article is about.
 *
 * The lead's only URL is the article, which belongs to the publication. Every
 * downstream use of it therefore points at a newspaper: contact enrichment
 * scrapes the outlet's contact page and returns the newsroom's address as
 * though it were the company's.
 *
 * A funding article almost always links to the company it covers. The problem
 * is that it links to a great many other things too, so "the first outbound
 * link" would be a coin toss dressed up as a finding. Instead a candidate must
 * corroborate the company name already read from the headline: acme.com for
 * Acme, northwindhealth.io for Northwind Health. When nothing corroborates,
 * this returns null and the lead honestly carries no company site — which is
 * the difference between a gap and a wrong answer.
 */

/** Hosts that are never the subject of a funding story. */
const NON_COMPANY_HOSTS = [
  'facebook.com',
  'twitter.com',
  'x.com',
  'linkedin.com',
  'instagram.com',
  'youtube.com',
  'youtu.be',
  'tiktok.com',
  'reddit.com',
  'medium.com',
  'substack.com',
  'wikipedia.org',
  'google.com',
  'apple.com',
  'amazon.com',
  'crunchbase.com',
  'pitchbook.com',
  'bloomberg.com',
  'reuters.com',
  'techcrunch.com',
  'forbes.com',
  'sec.gov',
  'gravatar.com',
  'gstatic.com',
  'googleapis.com',
  'doubleclick.net',
  'cloudflare.com',
  'wp.com',
];

const stripWww = (hostname: string): string =>
  hostname.toLowerCase().replace(/^www\./, '');

/** Letters and digits only, so "Northwind Health" can meet "northwindhealth". */
const condense = (value: string): string =>
  (value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * The part of a hostname that carries the name. Deliberately naive about
 * multi-part suffixes: for "acme.co.uk" this yields "acme", which is the label
 * being matched against, so the naivety costs nothing here.
 */
const registrableLabel = (hostname: string): string => {
  const parts = stripWww(hostname).split('.');
  return parts.length > 2 && parts[parts.length - 2].length <= 3
    ? parts[parts.length - 3] || ''
    : parts[parts.length - 2] || '';
};

const isExcludedHost = (hostname: string): boolean => {
  const host = stripWww(hostname);
  return NON_COMPANY_HOSTS.some(
    (blocked) => host === blocked || host.endsWith(`.${blocked}`)
  );
};

/**
 * The company's own site, drawn from the article's outbound links and required
 * to corroborate the company name. Returns null rather than a best guess.
 */
export const resolveCompanyWebsite = (input: {
  company: string | null | undefined;
  articleUrl: string;
  links: string[] | undefined;
}): string | null => {
  const wanted = condense(input.company || '');
  // Two characters is not a name to match on; it would hit almost anything.
  if (wanted.length < 3 || !input.links?.length) {
    return null;
  }

  let publisherHost = '';
  try {
    publisherHost = stripWww(new URL(input.articleUrl).hostname);
  } catch {
    return null;
  }

  // The first token alone catches "Northwind Health" living at northwind.com.
  const firstToken = condense((input.company || '').split(/\s+/)[0] || '');
  const candidates: { url: string; rank: number }[] = [];

  for (const link of input.links) {
    let hostname = '';
    try {
      hostname = new URL(link).hostname;
    } catch {
      continue;
    }

    const host = stripWww(hostname);
    if (host === publisherHost || host.endsWith(`.${publisherHost}`)) {
      continue;
    }
    if (isExcludedHost(host)) {
      continue;
    }

    const label = condense(registrableLabel(host));
    if (!label) {
      continue;
    }

    // Ranked by how much of the name the domain actually accounts for, so an
    // exact match beats a domain that merely contains the word.
    let rank = 0;
    if (label === wanted) {
      rank = 4;
    } else if (label.startsWith(wanted) || wanted.startsWith(label)) {
      rank = 3;
    } else if (label.includes(wanted)) {
      rank = 2;
    } else if (firstToken.length >= 4 && label === firstToken) {
      rank = 1;
    }

    if (rank > 0) {
      candidates.push({ url: `https://${host}/`, rank });
    }
  }

  if (!candidates.length) {
    return null;
  }

  candidates.sort((left, right) => right.rank - left.rank);
  return candidates[0].url;
};
