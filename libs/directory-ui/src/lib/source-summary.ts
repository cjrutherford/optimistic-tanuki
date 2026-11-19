import { LocalDirectoryListing } from './models';

export interface DirectorySourceLicense {
  name: string;
  url: string | null;
}

/** One distinct data credit and the licences that came with it. */
export interface DirectorySourceSummary {
  credit: string;
  licenses: DirectorySourceLicense[];
}

type SourceFields = Pick<
  LocalDirectoryListing,
  'attribution' | 'notices' | 'termsUrls'
>;

const norm = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Collapse the per-listing credits of a page of listings into one entry per
 * distinct credit (case-insensitive). Licence notices are paired with terms
 * URLs by position when both lists are the same length; otherwise the notices
 * are listed unlinked and any URLs are kept as their own links.
 */
export function summarizeSources(
  listings: readonly SourceFields[]
): DirectorySourceSummary[] {
  const byCredit = new Map<string, DirectorySourceSummary>();
  for (const listing of listings) {
    const notices = listing.notices ?? [];
    const urls = listing.termsUrls ?? [];
    const licenses: DirectorySourceLicense[] =
      notices.length > 0 && urls.length === notices.length
        ? notices.map((name, i) => ({ name, url: urls[i] }))
        : [
            ...notices.map((name) => ({ name, url: null })),
            ...urls.map((url) => ({ name: url, url })),
          ];
    for (const raw of listing.attribution ?? []) {
      const credit = raw.trim();
      if (!credit) continue;
      const key = norm(credit);
      let entry = byCredit.get(key);
      if (!entry) {
        entry = { credit, licenses: [] };
        byCredit.set(key, entry);
      }
      for (const lic of licenses) {
        const existing = entry.licenses.find(
          (l) => norm(l.name) === norm(lic.name)
        );
        if (!existing) entry.licenses.push({ ...lic });
        else if (!existing.url && lic.url) existing.url = lic.url;
      }
    }
  }
  return [...byCredit.values()].sort((a, b) =>
    a.credit.localeCompare(b.credit)
  );
}
