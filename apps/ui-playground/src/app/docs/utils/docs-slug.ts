export function normalizeDocSlug(value: string): string {
  return value
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .replace(/\\/g, '/')
    .toLowerCase();
}

export function categoryTitle(category: string): string {
  return category
    .split(/[-/]/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}
