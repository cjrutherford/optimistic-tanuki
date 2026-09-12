import { GUARDS_METADATA } from '@nestjs/common/constants';
import { of } from 'rxjs';
import { ProductCommands } from '@optimistic-tanuki/constants';
import { CatalogCommands } from '@optimistic-tanuki/constants';
import { AuthGuard } from '../../auth/auth.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { WorkspaceContextGuard } from '../../guards/workspace-context.guard';
import { PERMISSIONS_KEY } from '../../decorators/permissions.decorator';
import { StoreController } from './store.controller';

describe('Gateway StoreController metadata', () => {
  it('protects appointment cancellation with an explicit permission', () => {
    const handler = StoreController.prototype
      .cancelAppointment as unknown as Function;
    const guards = Reflect.getMetadata(GUARDS_METADATA, handler) ?? [];
    const requirement = Reflect.getMetadata(PERMISSIONS_KEY, handler);

    expect(guards).toEqual(
      expect.arrayContaining([AuthGuard, PermissionsGuard])
    );
    expect(requirement).toEqual({
      permissions: ['store.appointment.cancel'],
    });
  });

  it('sends public product list requests with a catalog scope', async () => {
    const storeService = {
      send: jest.fn(() => of([])),
    } as any;
    const controller = new StoreController(storeService);

    await controller.findAllProducts('catalog-1');

    expect(storeService.send).toHaveBeenCalledWith(
      { cmd: 'findAllProducts' },
      { catalogId: 'catalog-1', public: true }
    );
    expect(ProductCommands.FIND_ALL_PRODUCTS).toEqual({
      cmd: 'findAllProducts',
    });
  });

  it('passes an optional public catalog filter to the Store service', async () => {
    const storeService = { send: jest.fn(() => of([])) } as any;
    const controller = new StoreController(storeService);

    await controller.findAllProducts('catalog-1');

    expect(storeService.send).toHaveBeenCalledWith(
      ProductCommands.FIND_ALL_PRODUCTS,
      { catalogId: 'catalog-1', public: true }
    );
  });

  it('rejects an unscoped public product list', async () => {
    const controller = new StoreController({
      send: jest.fn(() => of([])),
    } as any);

    await expect(controller.findAllProducts()).rejects.toThrow(
      'A catalog is required for public product reads'
    );
  });

  it('sends owner product lists with the resolved workspace owner', async () => {
    const storeService = { send: jest.fn(() => of([])) } as any;
    const controller = new StoreController(storeService);
    const request = {
      workspaceContext: {
        workspace: {
          ownerProfileId: 'owner-profile',
          workspaceId: 'workspace-id',
          appScope: 'business-site',
        },
      },
    };

    await (controller as any).findOwnerProducts('forged-owner', request);

    expect(storeService.send).toHaveBeenCalledWith(
      ProductCommands.FIND_OWNER_PRODUCTS,
      expect.objectContaining({
        ownerId: 'owner-profile',
        workspaceId: 'workspace-id',
        appScope: 'business-site',
      })
    );
  });

  it('sends catalog list requests with resolved workspace identity', async () => {
    const storeService = { send: jest.fn(() => of([])) } as any;
    const controller = new StoreController(storeService);
    const request = {
      workspaceContext: {
        workspace: {
          ownerProfileId: 'owner-profile',
          workspaceId: 'workspace-id',
          appScope: 'business-site',
        },
      },
    };

    await (controller as any).findMyCatalogs(request);

    expect(storeService.send).toHaveBeenCalledWith(
      CatalogCommands.FIND_STORE_CATALOGS,
      {
        ownerId: 'owner-profile',
        workspaceId: 'workspace-id',
        appScope: 'business-site',
      }
    );
  });

  it('creates catalogs with resolved workspace identity', async () => {
    const storeService = {
      send: jest.fn(() => of({ id: 'catalog-id' })),
    } as any;
    const controller = new StoreController(storeService);
    const request = {
      workspaceContext: {
        workspace: {
          ownerProfileId: 'owner-profile',
          workspaceId: 'workspace-id',
          appScope: 'business-site',
        },
      },
    };

    await (controller as any).createCatalog({ name: 'Summer' }, request);

    expect(storeService.send).toHaveBeenCalledWith(
      CatalogCommands.CREATE_STORE_CATALOG,
      expect.objectContaining({
        createCatalogDto: { name: 'Summer' },
        scope: expect.objectContaining({ workspaceId: 'workspace-id' }),
      })
    );
  });

  it('rejects a product catalog that is outside the resolved workspace', async () => {
    const storeService = { send: jest.fn(() => of([])) } as any;
    const controller = new StoreController(storeService);
    const request = {
      workspaceContext: {
        workspace: {
          ownerProfileId: 'owner-profile',
          workspaceId: 'workspace-id',
          appScope: 'business-site',
        },
      },
    };

    await expect(
      (controller as any).createProduct(
        { name: 'Guide', catalogId: 'foreign-catalog' },
        request
      )
    ).rejects.toThrow('does not belong to the resolved workspace');

    expect(storeService.send).toHaveBeenCalledWith(
      CatalogCommands.FIND_STORE_CATALOGS,
      expect.objectContaining({ workspaceId: 'workspace-id' })
    );
    expect(storeService.send).not.toHaveBeenCalledWith(
      ProductCommands.CREATE_PRODUCT,
      expect.anything()
    );
  });

  it('requires resolved workspace context when creating a catalog-bound product', () => {
    const handler = StoreController.prototype
      .createProduct as unknown as Function;
    const guards = Reflect.getMetadata(GUARDS_METADATA, handler) ?? [];

    expect(guards).toEqual(
      expect.arrayContaining([
        AuthGuard,
        WorkspaceContextGuard,
        PermissionsGuard,
      ])
    );
  });

  it('sends product mutations with resolved owner and workspace scope', async () => {
    const storeService = {
      send: jest.fn(() => of({ id: 'product-id' })),
    } as any;
    const controller = new StoreController(storeService);
    const request = {
      workspaceContext: {
        workspace: {
          ownerProfileId: 'owner-profile',
          workspaceId: 'workspace-id',
          appScope: 'business-site',
        },
      },
    };

    await (controller as any).createProduct(
      { name: 'Guide', ownerId: 'forged-owner' },
      request
    );
    await (controller as any).updateProduct(
      'product-id',
      { name: 'Updated' },
      request
    );
    await (controller as any).removeProduct('product-id', request);

    expect(storeService.send).toHaveBeenNthCalledWith(
      1,
      ProductCommands.CREATE_PRODUCT,
      expect.objectContaining({
        createProductDto: { name: 'Guide', ownerId: 'forged-owner' },
        scope: expect.objectContaining({
          ownerId: 'owner-profile',
          workspaceId: 'workspace-id',
        }),
      })
    );
    expect(storeService.send).toHaveBeenNthCalledWith(
      2,
      ProductCommands.UPDATE_PRODUCT,
      expect.objectContaining({
        id: 'product-id',
        scope: expect.objectContaining({
          ownerId: 'owner-profile',
          workspaceId: 'workspace-id',
        }),
      })
    );
    expect(storeService.send).toHaveBeenNthCalledWith(
      3,
      ProductCommands.REMOVE_PRODUCT,
      expect.objectContaining({
        id: 'product-id',
        scope: expect.objectContaining({
          ownerId: 'owner-profile',
          workspaceId: 'workspace-id',
        }),
      })
    );
  });
});
