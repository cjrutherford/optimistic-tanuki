import type { SourceConfig } from './types.js';

/**
 * A publisher whose crawler policy forbids automated body retrieval. The set
 * is built from snippet-only sources in locality configuration, so a result
 * from any feed (for example, a general news search) that links to one of
 * these publishers is handled with the same restriction.
 */
export interface RestrictedPublisher {
  domain: string;
  names: readonly string[];
}

let configured: readonly RestrictedPublisher[] = [];

export function normalizePublisherName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/gu, '')
    .replace(/[^a-z0-9]+/gu, ' ')
    .replace(/^the /u, '')
    .trim();
}

export function registrableHost(value: string): string | null {
  try {
    const host = new URL(value).hostname
      .toLowerCase()
      .replace(/^www\./u, '')
      .replace(/\.$/u, '');
    return host || null;
  } catch {
    return null;
  }
}

/** Derive restricted publishers from snippet-only sources. The policy URL identifies the publisher's domain. */
export function restrictedPublishersFromSources(
  sources: readonly Pick<
    SourceConfig,
    'name' | 'accessMode' | 'restrictionPolicyUrl' | 'config'
  >[]
): RestrictedPublisher[] {
  const byDomain = new Map<string, Set<string>>();
  for (const source of sources) {
    if (source.accessMode !== 'snippet-only' || !source.restrictionPolicyUrl)
      continue;
    const domain = registrableHost(source.restrictionPolicyUrl);
    if (!domain) continue;
    const names = byDomain.get(domain) ?? new Set<string>();
    names.add(source.name);
    const extra = source.config?.['publisherNames'];
    if (Array.isArray(extra))
      for (const name of extra) if (typeof name === 'string') names.add(name);
    byDomain.set(domain, names);
  }
  return [...byDomain].map(([domain, names]) => ({
    domain,
    names: [...names],
  }));
}

export function setRestrictedPublishers(
  publishers: readonly RestrictedPublisher[]
): void {
  configured = publishers.map((publisher) => ({
    domain: publisher.domain.toLowerCase().replace(/^www\./u, ''),
    names: [...publisher.names],
  }));
}

export function restrictedPublishers(): readonly RestrictedPublisher[] {
  return configured;
}

export function restrictedPublisherDomains(): string[] {
  return configured.map((publisher) => publisher.domain);
}

/** Resolve the configured restricted publisher for a URL host or a publisher name. */
export function findRestrictedPublisher(
  publisher?: string | null,
  url?: string | null
): RestrictedPublisher | null {
  const host = url ? registrableHost(url) : null;
  if (host) {
    const byHost = configured.find(
      (entry) => host === entry.domain || host.endsWith(`.${entry.domain}`)
    );
    if (byHost) return byHost;
  }
  const name = normalizePublisherName(publisher ?? '');
  if (!name) return null;
  return (
    configured.find((entry) =>
      entry.names.some((candidate) => {
        const normalized = normalizePublisherName(candidate);
        return normalized.length >= 4 && name.includes(normalized);
      })
    ) ?? null
  );
}
