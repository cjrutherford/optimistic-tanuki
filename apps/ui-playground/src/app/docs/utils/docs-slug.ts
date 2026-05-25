export function normalizeDocSlug(value: string): string {
  return value
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .replace(/\\/g, '/')
    .toLowerCase();
}

export function toCanonicalDocSlug(value: string): string {
  const normalized = normalizeDocSlug(value);

  if (!normalized) {
    return normalized;
  }

  return normalized.startsWith('docs/') ? normalized : `docs/${normalized}`;
}

export function toDocRouteSegments(value: string): string[] {
  const canonical = toCanonicalDocSlug(value);
  const routeSlug = canonical.replace(/^docs\//, '');

  return ['/docs', ...routeSlug.split('/').filter(Boolean)];
}

export function categoryTitle(category: string): string {
  return category
    .split(/[-/]/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}
