/**
 * Accept only a path on this learning app.
 *
 * Query strings and fragments are part of the local route and must survive a
 * sign-in round trip. External, protocol-relative, backslash-containing, and
 * control-character targets are rejected to avoid open redirects.
 */
export function normalizeLearningReturnTo(
  requested: string | null | undefined
): string {
  if (
    !requested ||
    requested.trim() !== requested ||
    [...requested].some(
      (character) =>
        character.charCodeAt(0) < 0x20 || character.charCodeAt(0) === 0x7f
    ) ||
    !requested.startsWith('/') ||
    requested.startsWith('//') ||
    requested.includes('\\')
  ) {
    return '/courses';
  }
  return requested;
}

export function addOfferingToLearningReturnTo(
  requested: string,
  offeringId: string | undefined
): string {
  const normalized = normalizeLearningReturnTo(requested);
  if (!offeringId) return normalized;
  const hashIndex = normalized.indexOf('#');
  const fragment = hashIndex >= 0 ? normalized.slice(hashIndex) : '';
  const withoutFragment =
    hashIndex >= 0 ? normalized.slice(0, hashIndex) : normalized;
  const queryIndex = withoutFragment.indexOf('?');
  const path =
    queryIndex >= 0 ? withoutFragment.slice(0, queryIndex) : withoutFragment;
  const query = queryIndex >= 0 ? withoutFragment.slice(queryIndex + 1) : '';
  const params = new URLSearchParams(query);
  params.set('offeringId', offeringId);
  return `${path}?${params.toString()}${fragment}`;
}
