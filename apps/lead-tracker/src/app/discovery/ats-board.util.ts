import {
  AspirationalAtsProvider,
  AspirationalCompany,
} from '@optimistic-tanuki/leads-contracts';

/**
 * Shared plumbing for the "dream company" ATS sources.
 *
 * Greenhouse and Lever both expose a public, keyless postings endpoint keyed by
 * a board token, and both answer 404 for an unknown token — which is what makes
 * a name→token guess verifiable instead of a silent failure.
 */

export type AtsPosting = {
  id: string;
  title: string;
  url: string;
  location?: string;
  description?: string;
};

export const boardUrl = (
  provider: AspirationalAtsProvider,
  token: string
): string =>
  provider === 'greenhouse'
    ? `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(
        token
      )}/jobs`
    : `https://api.lever.co/v0/postings/${encodeURIComponent(token)}?mode=json`;

/**
 * Turns a company name into the token these boards conventionally use. This is
 * only ever a *candidate* — it must be verified against the live API before it
 * is stored, because plenty of companies do not follow the convention.
 */
export const candidateTokens = (companyName: string): string[] => {
  const cleaned = companyName
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\b(inc|llc|ltd|corp|corporation|co|company|group)\b/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim();

  const collapsed = cleaned.replace(/[\s-]+/g, '');
  const hyphenated = cleaned.replace(/\s+/g, '-');
  const firstWord = cleaned.split(/\s+/)[0] || '';

  return Array.from(
    new Set([collapsed, hyphenated, firstWord].filter(Boolean))
  );
};

export const parseGreenhousePostings = (payload: unknown): AtsPosting[] => {
  const jobs = (payload as { jobs?: unknown[] })?.jobs;
  if (!Array.isArray(jobs)) {
    return [];
  }
  return jobs.map((raw) => {
    const job = raw as {
      id?: number | string;
      title?: string;
      absolute_url?: string;
      location?: { name?: string };
      content?: string;
    };
    return {
      id: String(job.id ?? job.absolute_url ?? job.title ?? ''),
      title: job.title || 'Open role',
      url: job.absolute_url || '',
      location: job.location?.name,
      description: job.content,
    };
  });
};

export const parseLeverPostings = (payload: unknown): AtsPosting[] => {
  if (!Array.isArray(payload)) {
    return [];
  }
  return payload.map((raw) => {
    const job = raw as {
      id?: string;
      text?: string;
      hostedUrl?: string;
      applyUrl?: string;
      descriptionPlain?: string;
      categories?: { location?: string; team?: string; commitment?: string };
    };
    return {
      id: String(job.id ?? job.hostedUrl ?? job.text ?? ''),
      title: job.text || 'Open role',
      url: job.hostedUrl || job.applyUrl || '',
      location: job.categories?.location,
      description: job.descriptionPlain,
    };
  });
};

export const companiesFor = (
  provider: AspirationalAtsProvider,
  companies: AspirationalCompany[] | null | undefined
): AspirationalCompany[] =>
  (companies || []).filter((company) => company.provider === provider);
