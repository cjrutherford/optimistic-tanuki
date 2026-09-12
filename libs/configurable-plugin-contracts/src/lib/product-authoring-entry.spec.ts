import {
  assertProductAuthoringEntry,
  type ProductAuthoringEntry,
} from './product-authoring-entry';

describe('product authoring entry', () => {
  it('accepts canonical workspace context and an internal return intent', () => {
    const entry: ProductAuthoringEntry = {
      product: 'store',
      capabilityId: 'store.catalog',
      workspaceId: 'workspace-north-star',
      returnIntent: { path: '/workspaces/workspace-north-star' },
    };

    expect(assertProductAuthoringEntry(entry)).toEqual(entry);
  });

  it('rejects missing workspace context', () => {
    expect(() =>
      assertProductAuthoringEntry({
        product: 'blogging',
        capabilityId: 'blogging.posts',
        workspaceId: '',
      })
    ).toThrow('workspaceId is required');
  });
});
