export interface BlogCatalogReference {
  type: string;
  id: string;
}

export interface PublishedBlogCapability {
  enabled?: boolean;
  placement?: string;
  resourceRef?: BlogCatalogReference;
}

export function resolveBlogCatalogReference(
  reference: BlogCatalogReference
): string | undefined {
  return reference?.type === 'blog-catalog' && reference.id?.trim()
    ? reference.id.trim()
    : undefined;
}

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
