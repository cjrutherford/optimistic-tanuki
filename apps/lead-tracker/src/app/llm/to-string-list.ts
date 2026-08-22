/**
 * Reads a field that should be a list of strings but might be a single one.
 *
 * `budgetRange` is the case that motivated this: the profile type declares
 * `string[]`, but the wizard asks for it with a single-select and writes the
 * raw string, so at runtime it is whichever the last writer chose. Both the
 * prompt builder and the deterministic source picker called array methods on
 * it and threw — and because the fallback shared the fault, the whole analysis
 * returned a 500 rather than degrading.
 *
 * Kept deliberately small and shared, so the two sides cannot drift into
 * disagreeing about what the field holds.
 */
export const toStringList = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is string => typeof item === 'string' && item.trim() !== ''
    );
  }

  if (typeof value === 'string' && value.trim() !== '') {
    return [value];
  }

  return [];
};
