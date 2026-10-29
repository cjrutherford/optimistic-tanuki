export function deletionProfiles(values: readonly string[]): Set<string> {
  if (
    !Array.isArray(values) ||
    values.length > 1000 ||
    values.some(
      (value) =>
        typeof value !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          value
        )
    )
  )
    throw Error('PERMISSION_DELETION_SCOPE_INVALID');
  return new Set(values.map((value) => value.toLowerCase()));
}
export function cacheKeySelected(key: string, profiles: Set<string>): boolean {
  const boundary = key.indexOf(':');
  return boundary > 0 && profiles.has(key.slice(0, boundary).toLowerCase());
}
