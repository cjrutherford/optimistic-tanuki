export interface BlogCatalogReference {
  type: string;
  id: string;
}

export interface PublishedBlogCapability {
  enabled?: boolean;
  placement?: string;
  resourceRef?: BlogCatalogReference;
}

/** Keeps product record resolution behind the published contract boundary. */
export function resolveBlogCatalogReference(
  reference: BlogCatalogReference
): string | undefined {
  return reference?.type === 'blog-catalog' && reference.id?.trim()
    ? reference.id.trim()
    : undefined;
}

/**
 * Shared policy for every public Blog entry point. A direct route must never
 * infer or list a catalog that the persisted capability did not explicitly
 * publish.
 */
export function resolvePublishedBlogCatalogId(
  capability?: PublishedBlogCapability
): string | undefined {
  if (
    capability?.enabled !== true ||
    !['public-content', 'public-navigation'].includes(
      capability.placement ?? ''
    ) ||
    !capability.resourceRef?.id
  ) {
    return undefined;
  }

  return resolveBlogCatalogReference(capability.resourceRef);
}
