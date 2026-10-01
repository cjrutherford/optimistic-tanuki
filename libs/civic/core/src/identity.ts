import { createHash } from 'node:crypto';
import type { CivicKind } from './types.js';

export type CanonicalIdentityStrategy =
  | 'explicit-id'
  | 'canonical-url'
  | 'entity-date'
  | 'fallback';

export interface CanonicalStoryIdentityInput {
  title: string;
  body?: string;
  canonicalUrl?: string | null;
  caseId?: string | null;
  matterId?: string | null;
  permitId?: string | null;
  /** Common adapter names for the same stable external identifiers. */
  caseNumber?: string | null;
  matterNumber?: string | null;
  permitNumber?: string | null;
  externalId?: string | null;
  entity?: string | null;
  action?: string | null;
  jurisdiction?: string | null;
  jurisdictionSlug?: string | null;
  eventDate?: string | null;
  publishedAt?: string | null;
}

export interface CanonicalStoryKey {
  key: string;
  strategy: CanonicalIdentityStrategy;
}

function normalize(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/gu, '-');
}

function normalizeId(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('en-US')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function normalizeUrl(value: string): string {
  const url = new URL(value);
  url.hostname = url.hostname.toLowerCase();
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/u, '');
  url.hash = '';
  return url.toString();
}

function explicitId(input: CanonicalStoryIdentityInput): string | null {
  const supplied = [
    input.caseId,
    input.caseNumber,
    input.matterId,
    input.matterNumber,
    input.permitId,
    input.permitNumber,
    input.externalId,
  ].find((value) => typeof value === 'string' && value.trim());
  if (supplied) return normalizeId(supplied);
  const text = `${input.title} ${input.body ?? ''}`;
  const match = text.match(
    /\b(?:case|matter|permit)\s*(?:id)?\s*[:#]?\s*([a-z]{1,10}[-\s/]?\d{2,4}(?:[-\s/]\d{1,5})?[a-z]?)\b/iu
  );
  return match?.[1] ? normalizeId(match[1]) : null;
}

function dayOf(value?: string | null): string | null {
  if (!value) return null;
  const match = value.match(/^\d{4}-\d{2}-\d{2}/u);
  return match?.[0] ?? null;
}

function stableAction(value: string): string {
  const normalized = normalize(value);
  if (normalized.endsWith('ied')) return `${normalized.slice(0, -3)}y`;
  if (normalized.endsWith('ed')) {
    const stem = normalized.slice(0, -2);
    return stem.endsWith('v') ? `${stem}e` : stem;
  }
  if (normalized.endsWith('ing')) return normalized.slice(0, -3);
  return normalized.replace(/s$/u, '');
}

/** Deterministic, scope-aware identity; this function never calls an LLM. */
export function canonicalStoryKey(
  scopeSlug: string,
  kind: CivicKind,
  input: CanonicalStoryIdentityInput
): CanonicalStoryKey {
  const scope = normalize(scopeSlug);
  const id = explicitId(input);
  // A stable case/matter/permit identifier is shared by agenda, minutes, and
  // syndicated news records.  It is scoped, but deliberately not kind-bound.
  if (id) return { key: `${scope}|id:${id}`, strategy: 'explicit-id' };
  if (input.canonicalUrl) {
    try {
      return {
        key: `${scope}|${kind}|url:${normalizeUrl(input.canonicalUrl)}`,
        strategy: 'canonical-url',
      };
    } catch {
      /* fall through to a stable non-URL identity */
    }
  }
  const entity = input.entity ? normalize(input.entity) : '';
  const action = input.action ? stableAction(input.action) : '';
  const jurisdiction = normalize(
    input.jurisdictionSlug ?? input.jurisdiction ?? ''
  );
  const day = dayOf(input.eventDate) ?? dayOf(input.publishedAt);
  if (entity && action && jurisdiction && day) {
    return {
      key: `${scope}|${kind}|entity:${entity}|action:${action}|jurisdiction:${jurisdiction}|date:${day}`,
      strategy: 'entity-date',
    };
  }
  const effectiveDay = day ?? 'undated';
  const content = normalize(`${input.title} ${input.body ?? ''}`) || 'empty';
  const fingerprint = createHash('sha256')
    .update(content)
    .digest('hex')
    .slice(0, 24);
  return {
    key: `${scope}|${kind}|title:${
      normalize(input.title) || 'untitled'
    }|date:${effectiveDay}|content:${fingerprint}`,
    strategy: 'fallback',
  };
}
