export type ConfigurableAuthoringProduct =
  | 'store'
  | 'blogging'
  | 'forum'
  | 'social';

export interface ProductAuthoringEntry {
  product: ConfigurableAuthoringProduct;
  capabilityId: string;
  workspaceId: string;
  returnIntent?: { path: string };
}

export function assertProductAuthoringEntry(
  entry: ProductAuthoringEntry
): ProductAuthoringEntry {
  if (!entry.workspaceId.trim()) {
    throw new Error('workspaceId is required');
  }
  return entry;
}
