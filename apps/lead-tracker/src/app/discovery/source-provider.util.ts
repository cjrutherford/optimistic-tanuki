import { createHash } from 'crypto';
import { Lead } from '@optimistic-tanuki/models/leads-entities';
import { LeadSource, LeadStatus, LeadTopicDiscoveryIntent } from '@optimistic-tanuki/models/leads-contracts';
import { LeadContactPoint, LeadContactPointSource } from '@optimistic-tanuki/models/leads-contracts';
import { normalizeTopicTerms, truncateText } from './provider-result-analysis.util';

export type RssItem = {
  title: string;
  link: string;
  description: string;
  pubDate?: string;
  expiresAt?: string;
};

export type JustRemoteEmbeddedJob = {
  title: string;
  companyName: string;
  link: string;
  description: string;
  pubDate?: string;
};

export const normalizeTopicKeywords = (topicName: string, keywords: string[]): string[] => {
  return normalizeTopicTerms([...(keywords || []), topicName || '']).slice(0, 8);
};

export const normalizeExcludedTerms = (excludedTerms?: string[] | null): string[] => {
  return normalizeTopicTerms(excludedTerms || []);
};

export const getMatchedKeywords = (text: string, keywords: string[]): string[] => {
  const haystack = text.toLowerCase();
  return keywords.filter((keyword) => haystack.includes(keyword));
};

export const hasExcludedTerms = (text: string, excludedTerms?: string[] | null): boolean => {
  const haystack = text.toLowerCase();
  return normalizeExcludedTerms(excludedTerms).some((term) => haystack.includes(term));
};

export const getTopicDiscoveryIntent = (topic: { discoveryIntent?: LeadTopicDiscoveryIntent | string | null }) => {
  return topic.discoveryIntent || LeadTopicDiscoveryIntent.JOB_OPENINGS;
};

export const stripHtml = (value: string | undefined | null): string => {
  return (value || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
};

export const parseRssItems = (xml: string): RssItem[] => {
  return Array.from(xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)).map((match) => {
    const item = match[0];
    return {
      title: readXmlTag(item, 'title'),
      link: readXmlTag(item, 'link'),
      description: readXmlTag(item, 'description'),
      pubDate: readXmlTag(item, 'pubDate'),
      expiresAt: readXmlTag(item, 'expires_at'),
    };
  });
};

export const isRecentPublication = (
  value: string | undefined,
  maxAgeDays = 120
): boolean => {
  if (!value) {
    return true;
  }

  const publishedAt = new Date(value);
  if (Number.isNaN(publishedAt.getTime())) {
    return true;
  }

  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  return Date.now() - publishedAt.getTime() <= maxAgeMs;
};

export const parseJustRemoteEmbeddedJobs = (
  html: string
): JustRemoteEmbeddedJob[] => {
  const stateMatch = html.match(
    /<script id="__PRELOADED_STATE__"[^>]*>([\s\S]*?)<\/script>/i
  );
  if (!stateMatch?.[1]) {
    return [];
  }

  try {
    const state = JSON.parse(stateMatch[1]);
    const jobs = state?.jobsState?.entity?.jobs;
    if (!Array.isArray(jobs)) {
      return [];
    }

    return jobs
      .map((job) => {
        const title =
          typeof job?.title === 'string' ? job.title.trim() : '';
        const companyName =
          typeof job?.company_name === 'string'
            ? job.company_name.trim()
            : '';
        const href =
          typeof job?.href === 'string' ? job.href.trim() : '';
        if (!title || !href) {
          return null;
        }

        return {
          title,
          companyName: companyName || 'JustRemote opportunity',
          link: toAbsoluteUrl(href, 'https://justremote.co/'),
          description: [
            job?.category,
            job?.remote_type,
            Array.isArray(job?.location_restrictions)
              ? job.location_restrictions.join(', ')
              : job?.job_country,
          ]
            .filter(Boolean)
            .join(' · '),
          pubDate:
            typeof job?.raw_date === 'string' ? job.raw_date : undefined,
        };
      })
      .filter(Boolean) as JustRemoteEmbeddedJob[];
  } catch {
    return [];
  }
};

const readXmlTag = (value: string, tag: string): string => {
  const match = value.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return stripHtml((match?.[1] || '').replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, ''));
};

export const toAbsoluteUrl = (url: string, baseUrl: string): string => {
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return url;
  }
};

export const createLeadEntity = (input: {
  seed: string;
  name: string;
  company?: string;
  source: LeadSource;
  notes: string;
  searchKeywords: string[];
  value?: number;
  email?: string;
  phone?: string;
  originalPostingUrl?: string;
  contacts?: LeadContactPoint[];
}): Lead => {
  return {
    id: createDeterministicId(input.seed),
    name: input.name,
    company: input.company,
    email: input.email,
    phone: input.phone,
    originalPostingUrl: input.originalPostingUrl,
    contacts: input.contacts,
    source: input.source,
    status: LeadStatus.NEW,
    value: input.value || 0,
    notes: truncateText(input.notes, 800),
    nextFollowUp: undefined,
    isAutoDiscovered: true,
    searchKeywords: input.searchKeywords,
    assignedTo: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  } as Lead;
};

export const createDeterministicId = (value: string): string => {
  const hash = createHash('sha1').update(value).digest('hex').slice(0, 32);
  return [hash.slice(0, 8), hash.slice(8, 12), hash.slice(12, 16), hash.slice(16, 20), hash.slice(20, 32)].join('-');
};

export const estimateCompensationValue = (...values: Array<string | number | undefined | null>): number => {
  const numericValues = values
    .flatMap((value) => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        return [value];
      }
      if (typeof value !== 'string') {
        return [];
      }
      return Array.from(value.matchAll(/\d[\d,]*(?:\.\d+)?/g)).map((match) => Number(match[0].replace(/,/g, '')));
    })
    .filter((value) => Number.isFinite(value) && value > 0);

  if (!numericValues.length) {
    return 0;
  }

  return Math.round(Math.max(...numericValues));
};

export const splitCsvInput = (values: string[] | undefined | null): string[] => {
  return Array.from(
    new Set(
      (values || [])
        .flatMap((value) => value.split(','))
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
    )
  );
};

export const extractContactPoints = (
  html: string,
  baseUrl: string,
  source: LeadContactPointSource = 'posting-page'
): LeadContactPoint[] => {
  const contacts: LeadContactPoint[] = [];
  const seen = new Set<string>();
  const addContact = (contact: LeadContactPoint) => {
    const key = `${contact.kind}:${contact.href.toLowerCase()}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    contacts.push(contact);
  };

  for (const match of html.matchAll(/href=["']mailto:([^"'?#]+)[^"']*["']/gi)) {
    const email = match[1].trim().toLowerCase();
    if (!email) {
      continue;
    }
    addContact({
      kind: 'email',
      value: email,
      href: `mailto:${email}`,
      label: email,
      source,
      isPrimary: false,
    });
  }

  for (const match of html.matchAll(/href=["']tel:([^"']+)["']/gi)) {
    const phone = normalizePhoneValue(match[1]);
    if (!phone) {
      continue;
    }
    addContact({
      kind: 'phone',
      value: phone,
      href: `tel:${phone}`,
      label: phone,
      source,
      isPrimary: false,
    });
  }

  for (const match of html.matchAll(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi)) {
    const email = match[0].trim().toLowerCase();
    addContact({
      kind: 'email',
      value: email,
      href: `mailto:${email}`,
      label: email,
      source,
      isPrimary: false,
    });
  }

  for (const match of html.matchAll(/(?:\+?\d[\d\s().-]{7,}\d)/g)) {
    const phone = normalizePhoneValue(match[0]);
    if (!phone) {
      continue;
    }
    addContact({
      kind: 'phone',
      value: phone,
      href: `tel:${phone}`,
      label: phone,
      source,
      isPrimary: false,
    });
  }

  for (const match of html.matchAll(/href=["']([^"']+)["']/gi)) {
    const href = match[1].trim();
    if (!/linkedin\.com|\/contact\b|\/about\b/i.test(href)) {
      continue;
    }
    const absoluteHref = toAbsoluteUrl(href, baseUrl);
    addContact({
      kind: 'link',
      value: absoluteHref,
      href: absoluteHref,
      label: absoluteHref,
      source,
      isPrimary: false,
    });
  }

  return contacts;
};

export const mergeContactPoints = (
  existing: LeadContactPoint[] | undefined,
  incoming: LeadContactPoint[] | undefined
): LeadContactPoint[] | undefined => {
  const merged = [...(existing || []), ...(incoming || [])].reduce<LeadContactPoint[]>(
    (acc, contact) => {
      const index = acc.findIndex(
        (entry) =>
          entry.kind === contact.kind &&
          entry.href.toLowerCase() === contact.href.toLowerCase()
      );

      if (index === -1) {
        acc.push(contact);
        return acc;
      }

      const current = acc[index];
      acc[index] = {
        ...current,
        ...contact,
        isPrimary: current.isPrimary || contact.isPrimary,
      };
      return acc;
    },
    []
  );

  return merged.length ? merged : undefined;
};

export const selectPrimaryContactValue = (
  contacts: LeadContactPoint[] | undefined,
  kind: LeadContactPoint['kind']
): string | undefined => {
  const matches = (contacts || []).filter((contact) => contact.kind === kind);
  if (!matches.length) {
    return undefined;
  }

  return (
    matches.find((contact) => contact.isPrimary)?.value ||
    matches[0].value
  );
};

export const markPrimaryContact = (
  contacts: LeadContactPoint[] | undefined,
  preferredKind: LeadContactPoint['kind'],
  preferredValue: string | undefined
): LeadContactPoint[] | undefined => {
  if (!contacts?.length) {
    return contacts;
  }

  if (!preferredValue) {
    return contacts;
  }

  let primaryAssigned = false;
  return contacts.map((contact) => {
    const isPrimary =
      contact.kind === preferredKind &&
      contact.value.toLowerCase() === preferredValue.toLowerCase() &&
      !primaryAssigned;

    if (isPrimary) {
      primaryAssigned = true;
    }

    return {
      ...contact,
      isPrimary: contact.isPrimary || isPrimary,
    };
  });
};

export type { LeadContactPoint };

const normalizePhoneValue = (value: string): string | null => {
  const trimmed = value.trim();
  const hasPlusPrefix = trimmed.startsWith('+');
  const digits = trimmed.replace(/[^\d]/g, '');
  if (digits.length < 7) {
    return null;
  }
  return hasPlusPrefix ? `+${digits}` : digits;
};
