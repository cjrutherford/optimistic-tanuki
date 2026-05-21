import { Test, TestingModule } from '@nestjs/testing';
import { PermissionsProxyService } from './permissions-proxy.service';
import { ServiceTokens } from '@optimistic-tanuki/constants';
import { of, throwError } from 'rxjs';

import { PermissionsCacheService } from './permissions-cache.service';

describe('PermissionsProxyService', () => {
  let service: PermissionsProxyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsProxyService,
        {
          provide: ServiceTokens.PERMISSIONS_SERVICE,
          useValue: {
            send: jest.fn().mockReturnValue(of({})),
          },
        },
        {
          provide: PermissionsCacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PermissionsProxyService>(PermissionsProxyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});

describe('PermissionsProxyService.checkPermission', () => {
  let service: PermissionsProxyService;
  let permissionsClientMock: any;
  let cacheServiceMock: any;

  beforeEach(async () => {
    permissionsClientMock = {
      send: jest.fn(),
    };
    cacheServiceMock = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsProxyService,
        { provide: ServiceTokens.PERMISSIONS_SERVICE, useValue: permissionsClientMock },
        { provide: PermissionsCacheService, useValue: cacheServiceMock },
      ],
    }).compile();

    service = module.get(PermissionsProxyService);
  });

  it('returns false when app scope is not found', async () => {
    permissionsClientMock.send.mockReturnValue(of(null));
    const result = await service.checkPermission('p1', 'perm.read', 'app');
    expect(result).toBe(false);
    expect(permissionsClientMock.send).toHaveBeenCalledTimes(1);
  });

  it('returns cached value when present (true)', async () => {
    permissionsClientMock.send.mockReturnValue(of({ id: 'app1' }));
    cacheServiceMock.get.mockResolvedValue(true);

    const result = await service.checkPermission('p1', 'perm.read', 'app');

    expect(result).toBe(true);
    expect(permissionsClientMock.send).toHaveBeenCalledTimes(1);
    expect(cacheServiceMock.set).not.toHaveBeenCalled();
  });

  it('returns cached value when present (false)', async () => {
    permissionsClientMock.send.mockReturnValue(of({ id: 'app1' }));
    cacheServiceMock.get.mockResolvedValue(false);

    const result = await service.checkPermission('p1', 'perm.read', 'app');

    expect(result).toBe(false);
    expect(permissionsClientMock.send).toHaveBeenCalledTimes(1);
    expect(cacheServiceMock.set).not.toHaveBeenCalled();
  });

  it('fetches permission from service and caches result when cache miss', async () => {
    permissionsClientMock.send
      .mockReturnValueOnce(of({ id: 'app1' }))
      .mockReturnValueOnce(of(true));
    cacheServiceMock.get.mockResolvedValue(null);

    const result = await service.checkPermission('p1', 'perm.read', 'app');

    expect(result).toBe(true);
    expect(cacheServiceMock.set).toHaveBeenCalledWith('p1', 'perm.read', 'app1', true);
  });

  it('returns false on error', async () => {
    permissionsClientMock.send.mockReturnValue(throwError(() => new Error('boom')));

    const result = await service.checkPermission('p1', 'perm.read', 'app');
    expect(result).toBe(false);
  });
});
