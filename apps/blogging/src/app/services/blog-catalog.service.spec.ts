import { BlogCatalogService } from './blog-catalog.service';

describe('BlogCatalogService', () => {
  const scope = {
    ownerId: 'aaaaaaa1-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    workspaceId: 'bbbbbbb2-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    appScope: 'business-site',
  };

  it('lists only catalogs in the trusted owner workspace scope', async () => {
    const repository = { find: jest.fn().mockResolvedValue([]) } as any;
    const service = new BlogCatalogService(repository);

    await service.findAll(scope);

    expect(repository.find).toHaveBeenCalledWith({
      where: scope,
      order: { name: 'ASC' },
    });
  });

  it('provisions a backing Blog aggregate in the catalog transaction', async () => {
    const catalog = { id: 'catalog-1', name: 'Updates', description: 'News' };
    const catalogRepository = {
      create: jest.fn().mockReturnValue(catalog),
      save: jest.fn().mockResolvedValue(catalog),
    } as any;
    const blogRepository = {
      create: jest.fn((input) => input),
      save: jest.fn(),
    } as any;
    const manager = {
      getRepository: jest.fn((entity) =>
        entity.name === 'BlogCatalog' ? catalogRepository : blogRepository
      ),
    };
    const dataSource = {
      transaction: jest.fn((callback) => callback(manager)),
    };
    const service = new (BlogCatalogService as any)(
      catalogRepository,
      dataSource
    );

    await service.create({ name: 'Updates', description: 'News' }, scope);

    expect(dataSource.transaction).toHaveBeenCalled();
    expect(blogRepository.create).toHaveBeenCalledWith({
      catalogId: 'catalog-1',
      name: 'Updates',
      description: 'News',
      ownerId: scope.ownerId,
      workspaceId: scope.workspaceId,
      appScope: scope.appScope,
    });
    expect(blogRepository.save).toHaveBeenCalled();
  });
});
