import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  TenantContextGuard,
  TenantResolverService,
} from './tenant-context.guard';
import { MemoryTenantCache } from '@optimistic-tanuki/business-security';

describe('TenantContextGuard (Gateway Tenant Resolution Integration)', () => {
  let guard: TenantContextGuard;
  let resolver: TenantResolverService;
  let reflector: Reflector;

  const createMockContext = (request: Record<string, any>): ExecutionContext =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
      }),
    } as unknown as ExecutionContext);

  beforeEach(() => {
    resolver = new TenantResolverService();
    reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as Reflector;
    guard = new TenantContextGuard(resolver, reflector);
  });

  describe('host and CNAME matching', () => {
    it('binds a recognized Host header', async () => {
      const request: Record<string, any> = {
        headers: {
          host: 'wirepro.hopefulaspirationsindustries.com',
        },
      };

      await expect(guard.canActivate(createMockContext(request))).resolves.toBe(
        true
      );
      expect(request.tenantId).toBe('wirepro-electrical');
      expect(request.tenant.name).toBe('WirePro Electrical Services');
      expect(request.tenantContext.matchedBy).toBe('host');
      expect(request.tenantContext.matchedValue).toBe(
        'wirepro.hopefulaspirationsindustries.com'
      );
    });

    it('binds a recognized Host header containing a port', async () => {
      const request: Record<string, any> = {
        headers: {
          host: 'apex-detailing.hopefulaspirationsindustries.com:3000',
        },
      };

      await expect(guard.canActivate(createMockContext(request))).resolves.toBe(
        true
      );
      expect(request.tenantId).toBe('apex-detailing');
      expect(request.tenantContext.matchedBy).toBe('host');
    });

    it('binds a recognized custom CNAME', async () => {
      const request: Record<string, any> = {
        headers: {
          host: 'portal.wireproelectric.com',
        },
      };

      await expect(guard.canActivate(createMockContext(request))).resolves.toBe(
        true
      );
      expect(request.tenantId).toBe('wirepro-electrical');
      expect(request.tenantContext.matchedBy).toBe('cname');
      expect(request.tenantContext.matchedValue).toBe(
        'portal.wireproelectric.com'
      );
    });
  });

  describe('trusted header fallback', () => {
    const trustedProxyConfig = {
      enabled: true,
      trustedProxyAddresses: ['127.0.0.1'],
    };

    it('ignores X-Tenant-ID when the header fallback is not enabled', async () => {
      const request: Record<string, any> = {
        headers: {
          host: 'unknown.example.com',
          'x-tenant-id': 'apex-detailing',
        },
      };

      await expect(
        guard.canActivate(createMockContext(request))
      ).rejects.toThrow(NotFoundException);
      expect(request.tenantId).toBeUndefined();
    });

    it('uses X-Tenant-ID only through an explicitly trusted proxy', async () => {
      const trustedResolver = new TenantResolverService(undefined, undefined, {
        allowHeaderFallback: true,
      });
      const trustedGuard = new TenantContextGuard(
        trustedResolver,
        reflector,
        trustedProxyConfig
      );
      const request: Record<string, any> = {
        headers: {
          host: 'unknown.example.com',
          'x-tenant-id': 'apex-detailing',
        },
        socket: { remoteAddress: '127.0.0.1' },
      };

      await expect(
        trustedGuard.canActivate(createMockContext(request))
      ).resolves.toBe(true);
      expect(request.tenantId).toBe('apex-detailing');
      expect(request.tenantContext.matchedBy).toBe('header');
    });

    it('does not use a header from an untrusted proxy address', async () => {
      const trustedResolver = new TenantResolverService(undefined, undefined, {
        allowHeaderFallback: true,
      });
      const trustedGuard = new TenantContextGuard(
        trustedResolver,
        reflector,
        trustedProxyConfig
      );
      const request: Record<string, any> = {
        headers: {
          host: 'unknown.example.com',
          'x-tenant-id': 'apex-detailing',
        },
        socket: { remoteAddress: '203.0.113.10' },
      };

      await expect(
        trustedGuard.canActivate(createMockContext(request))
      ).rejects.toThrow(NotFoundException);
    });

    it('prefers a recognized host over a trusted conflicting header', async () => {
      const trustedResolver = new TenantResolverService(undefined, undefined, {
        allowHeaderFallback: true,
      });
      const trustedGuard = new TenantContextGuard(
        trustedResolver,
        reflector,
        trustedProxyConfig
      );
      const request: Record<string, any> = {
        headers: {
          host: 'wirepro.hopefulaspirationsindustries.com',
          'x-tenant-id': 'apex-detailing',
        },
        socket: { remoteAddress: '127.0.0.1' },
      };

      await expect(
        trustedGuard.canActivate(createMockContext(request))
      ).resolves.toBe(true);
      expect(request.tenantId).toBe('wirepro-electrical');
      expect(request.tenantContext.matchedBy).toBe('host');
    });
  });

  describe('invalid or optional tenants', () => {
    it('rejects an unrecognized host', async () => {
      const request: Record<string, any> = {
        headers: {
          host: 'unregistered.thirdpartyclient.com',
        },
      };

      await expect(
        guard.canActivate(createMockContext(request))
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects an unrecognized X-Tenant-ID without trusted fallback', async () => {
      const request: Record<string, any> = {
        headers: {
          'x-tenant-id': 'non-existent-tenant-id',
        },
      };

      await expect(
        guard.canActivate(createMockContext(request))
      ).rejects.toThrow(NotFoundException);
    });

    it('allows optional tenant routes to pass through', async () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
      const request: Record<string, any> = {
        headers: {
          host: 'unregistered.thirdpartyclient.com',
        },
      };

      await expect(guard.canActivate(createMockContext(request))).resolves.toBe(
        true
      );
      expect(request.tenantId).toBeUndefined();
    });
  });

  describe('caching and request context', () => {
    it('caches tenant resolutions without a database query runner', async () => {
      const cache = new MemoryTenantCache();
      const cachedResolver = new TenantResolverService(undefined, cache);
      const cachedGuard = new TenantContextGuard(cachedResolver, reflector);
      const cacheSetSpy = jest.spyOn(cache, 'set');
      const cacheGetSpy = jest.spyOn(cache, 'get');
      const firstRequest: Record<string, any> = {
        headers: { host: 'portal.wireproelectric.com' },
      };
      const secondRequest: Record<string, any> = {
        headers: { host: 'portal.wireproelectric.com' },
      };

      await cachedGuard.canActivate(createMockContext(firstRequest));
      expect(cacheSetSpy).toHaveBeenCalled();
      await cachedGuard.canActivate(createMockContext(secondRequest));
      expect(cacheGetSpy).toHaveBeenCalledWith(
        'host:portal.wireproelectric.com'
      );
      expect(secondRequest.tenantId).toBe('wirepro-electrical');
      expect(secondRequest.tenantQueryRunner).toBeUndefined();
    });
  });
});
