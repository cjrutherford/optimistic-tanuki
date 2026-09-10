import { CatalogService } from './catalog.service';

describe('CatalogService', () => {
  const scope = {
    ownerId: 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    workspaceId: 'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    appScope: 'business-site',
  };

  it('lists only catalogs in the trusted owner workspace scope', async () => {
    const repository = { find: jest.fn().mockResolvedValue([]) } as any;
    const service = new CatalogService(repository);

    await service.findAll(scope);

    expect(repository.find).toHaveBeenCalledWith({
      where: scope,
      order: { name: 'ASC' },
    });
  });
});
