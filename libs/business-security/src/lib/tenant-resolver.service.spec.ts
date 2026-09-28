import { TenantResolverService } from './tenant-resolver.service';
import { MemoryTenantCache } from './tenant-cache';
import { TenantRoutingRule } from './tenant-resolution.types';

describe('TenantResolverService', () => {
  let service: TenantResolverService;
  let cache: MemoryTenantCache;

  const mockRules: TenantRoutingRule[] = [
    {
      tenantId: 'wirepro-electrical',
      name: 'WirePro Electrical Services',
      hostPatterns: [
        'wirepro-electrical.hopefulaspirationsindustries.com',
        'wirepro.hopefulaspirationsindustries.com',
      ],
      cnameDomains: ['portal.wireproelectric.com', 'book.wirepro-electric.com'],
      active: true,
    },
    {
      tenantId: 'apex-detailing',
      name: 'Apex Mobile Detailing',
      hostPatterns: [
        'apex-detailing.hopefulaspirationsindustries.com',
        '*.apex.local',
      ],
      cnameDomains: ['portal.apexdetailing-sav.com'],
      active: true,
    },
    {
      tenantId: 'inactive-tenant',
      name: 'Inactive Tenant',
      hostPatterns: ['inactive.example.com'],
      cnameDomains: [],
      active: false,
    },
  ];

  beforeEach(() => {
    cache = new MemoryTenantCache();
    service = new TenantResolverService(mockRules, cache, {
      allowHeaderFallback: true,
    });
  });

  describe('Host header resolution', () => {
    it('matches exact host pattern', async () => {
      const result = await service.resolve({
        host: 'wirepro.hopefulaspirationsindustries.com',
      });
      expect(result).not.toBeNull();
      expect(result?.tenantId).toBe('wirepro-electrical');
      expect(result?.matchedBy).toBe('host');
      expect(result?.matchedValue).toBe(
        'wirepro.hopefulaspirationsindustries.com'
      );
    });

    it('matches wildcard host pattern', async () => {
      const result = await service.resolve({
        host: 'sub.apex.local',
      });
      expect(result).not.toBeNull();
      expect(result?.tenantId).toBe('apex-detailing');
      expect(result?.matchedBy).toBe('host');
    });

    it('handles host with port correctly', async () => {
      const result = await service.resolve({
        host: 'wirepro.hopefulaspirationsindustries.com:4204',
      });
      expect(result).not.toBeNull();
      expect(result?.tenantId).toBe('wirepro-electrical');
    });
  });

  describe('Custom CNAME domain resolution', () => {
    it('matches custom CNAME domain', async () => {
      const result = await service.resolve({
        host: 'portal.wireproelectric.com',
      });
      expect(result).not.toBeNull();
      expect(result?.tenantId).toBe('wirepro-electrical');
      expect(result?.matchedBy).toBe('cname');
      expect(result?.matchedValue).toBe('portal.wireproelectric.com');
    });

    it('matches second configured CNAME domain', async () => {
      const result = await service.resolve({
        host: 'book.wirepro-electric.com',
      });
      expect(result).not.toBeNull();
      expect(result?.tenantId).toBe('wirepro-electrical');
      expect(result?.matchedBy).toBe('cname');
    });
  });

  describe('X-Tenant-ID header fallback', () => {
    it('prefers a recognized host over an explicit X-Tenant-ID', async () => {
      const result = await service.resolve({
        host: 'wirepro.hopefulaspirationsindustries.com',
        xTenantId: 'apex-detailing',
      });
      expect(result).not.toBeNull();
      expect(result?.tenantId).toBe('wirepro-electrical');
      expect(result?.matchedBy).toBe('host');
      expect(result?.matchedValue).toBe(
        'wirepro.hopefulaspirationsindustries.com'
      );
    });

    it('uses X-Tenant-ID only when the host is not recognized', async () => {
      const result = await service.resolve({
        host: 'unknown.example.com',
        xTenantId: 'apex-detailing',
      });
      expect(result).not.toBeNull();
      expect(result?.tenantId).toBe('apex-detailing');
      expect(result?.matchedBy).toBe('header');
      expect(result?.matchedValue).toBe('apex-detailing');
    });

    it('returns null if explicit X-Tenant-ID is unrecognized', async () => {
      const result = await service.resolve({
        xTenantId: 'nonexistent-tenant',
      });
      expect(result).toBeNull();
    });

    it('does not trust X-Tenant-ID by default', async () => {
      const defaultResolver = new TenantResolverService(mockRules, cache);
      const result = await defaultResolver.resolve({
        host: 'unknown.example.com',
        xTenantId: 'apex-detailing',
      });

      expect(result).toBeNull();
    });

    it('allows X-Tenant-ID only when explicitly configured', async () => {
      const configuredResolver = new TenantResolverService(mockRules, cache, {
        allowHeaderFallback: true,
      });
      const result = await configuredResolver.resolve({
        host: 'unknown.example.com',
        xTenantId: 'apex-detailing',
      });

      expect(result?.tenantId).toBe('apex-detailing');
      expect(result?.matchedBy).toBe('header');
    });

    it('keeps a recognized CNAME host ahead of a conflicting header', async () => {
      const configuredResolver = new TenantResolverService(mockRules, cache, {
        allowHeaderFallback: true,
      });
      const result = await configuredResolver.resolve({
        host: 'portal.wireproelectric.com',
        xTenantId: 'apex-detailing',
      });

      expect(result?.tenantId).toBe('wirepro-electrical');
      expect(result?.matchedBy).toBe('cname');
    });

    it('normalizes host case, ports, and trailing dots', async () => {
      const result = await service.resolve({
        host: 'WIREPRO.HOPEFULASPIRATIONSINDUSTRIES.COM.:4204',
      });
      expect(result).not.toBeNull();
      expect(result?.tenantId).toBe('wirepro-electrical');
      expect(result?.matchedValue).toBe(
        'wirepro.hopefulaspirationsindustries.com'
      );
    });
  });

  describe('Overlapping rule priority', () => {
    it('prefers an exact CNAME match over an exact host match', async () => {
      const resolver = new TenantResolverService([
        {
          tenantId: 'host-tenant',
          name: 'Host Tenant',
          hostPatterns: ['priority.example.com'],
          cnameDomains: [],
        },
        {
          tenantId: 'cname-tenant',
          name: 'Cname Tenant',
          hostPatterns: [],
          cnameDomains: ['priority.example.com'],
        },
      ]);

      const result = await resolver.resolve({ host: 'priority.example.com' });

      expect(result?.tenantId).toBe('cname-tenant');
      expect(result?.matchedBy).toBe('cname');
    });

    it('prefers an exact host match over a wildcard CNAME match', async () => {
      const resolver = new TenantResolverService([
        {
          tenantId: 'wildcard-cname-tenant',
          name: 'Wildcard CNAME Tenant',
          hostPatterns: [],
          cnameDomains: ['*.priority.example.com'],
        },
        {
          tenantId: 'exact-host-tenant',
          name: 'Exact Host Tenant',
          hostPatterns: ['priority.example.com'],
          cnameDomains: [],
        },
      ]);

      const result = await resolver.resolve({ host: 'priority.example.com' });

      expect(result?.tenantId).toBe('exact-host-tenant');
      expect(result?.matchedBy).toBe('host');
    });

    it('prefers a wildcard CNAME match over a wildcard host match', async () => {
      const resolver = new TenantResolverService([
        {
          tenantId: 'wildcard-host-tenant',
          name: 'Wildcard Host Tenant',
          hostPatterns: ['*.priority.example.com'],
          cnameDomains: [],
        },
        {
          tenantId: 'wildcard-cname-tenant',
          name: 'Wildcard CNAME Tenant',
          hostPatterns: [],
          cnameDomains: ['*.priority.example.com'],
        },
      ]);

      const result = await resolver.resolve({
        host: 'sub.priority.example.com',
      });

      expect(result?.tenantId).toBe('wildcard-cname-tenant');
      expect(result?.matchedBy).toBe('cname');
    });

    it('uses tenant id as a stable tie-break for equal match priority', async () => {
      const rules: TenantRoutingRule[] = [
        {
          tenantId: 'z-tenant',
          name: 'Z Tenant',
          hostPatterns: ['priority.example.com'],
          cnameDomains: [],
        },
        {
          tenantId: 'a-tenant',
          name: 'A Tenant',
          hostPatterns: ['priority.example.com'],
          cnameDomains: [],
        },
      ];
      const resolver = new TenantResolverService(rules);
      const reversedResolver = new TenantResolverService([...rules].reverse());

      const result = await resolver.resolve({ host: 'priority.example.com' });
      const reversedResult = await reversedResolver.resolve({
        host: 'priority.example.com',
      });

      expect(result?.tenantId).toBe('a-tenant');
      expect(reversedResult?.tenantId).toBe('a-tenant');
    });
  });

  describe('Caching', () => {
    it('caches resolved tenant contexts to eliminate subsequent lookup work', async () => {
      const spy = jest.spyOn(cache, 'set');
      const result1 = await service.resolve({
        host: 'portal.wireproelectric.com',
      });
      expect(result1?.tenantId).toBe('wirepro-electrical');
      expect(spy).toHaveBeenCalled();

      // Second call hits cache
      const cacheGetSpy = jest.spyOn(cache, 'get');
      const result2 = await service.resolve({
        host: 'portal.wireproelectric.com',
      });
      expect(result2?.tenantId).toBe('wirepro-electrical');
      expect(cacheGetSpy).toHaveBeenCalledWith(
        'host:portal.wireproelectric.com'
      );
    });

    it('does not reuse a cached context for another tenant configuration', async () => {
      const sharedCache = new MemoryTenantCache();
      const firstResolver = new TenantResolverService(
        [
          {
            tenantId: 'first-tenant',
            name: 'First Tenant',
            hostPatterns: ['shared.example.com'],
            cnameDomains: [],
          },
        ],
        sharedCache
      );
      const secondResolver = new TenantResolverService(
        [
          {
            tenantId: 'second-tenant',
            name: 'Second Tenant',
            hostPatterns: ['shared.example.com'],
            cnameDomains: [],
          },
        ],
        sharedCache
      );

      const firstResult = await firstResolver.resolve({
        host: 'shared.example.com',
      });
      const secondResult = await secondResolver.resolve({
        host: 'shared.example.com',
      });

      expect(firstResult?.tenantId).toBe('first-tenant');
      expect(secondResult?.tenantId).toBe('second-tenant');
    });

    it('invalidates the normalized host cache key', async () => {
      const cache = new MemoryTenantCache();
      const resolver = new TenantResolverService(mockRules, cache);
      const setSpy = jest.spyOn(cache, 'set');

      await resolver.resolve({
        host: 'WIREPRO.HOPEFULASPIRATIONSINDUSTRIES.COM.:4204',
      });
      await resolver.invalidate(
        'WIREPRO.HOPEFULASPIRATIONSINDUSTRIES.COM.:4204'
      );
      await resolver.resolve({
        host: 'wirepro.hopefulaspirationsindustries.com',
      });

      expect(setSpy).toHaveBeenCalledTimes(2);
    });

    it('keeps the stable tenant-id tie-break with a shared cache', async () => {
      const sharedCache = new MemoryTenantCache();
      const firstResolver = new TenantResolverService(
        [
          {
            tenantId: 'first-tenant',
            name: 'First Tenant',
            hostPatterns: ['shared.example.com'],
            cnameDomains: [],
          },
          {
            tenantId: 'second-tenant',
            name: 'Second Tenant',
            hostPatterns: ['shared.example.com'],
            cnameDomains: [],
          },
        ],
        sharedCache
      );
      const secondResolver = new TenantResolverService(
        [
          {
            tenantId: 'second-tenant',
            name: 'Second Tenant',
            hostPatterns: ['shared.example.com'],
            cnameDomains: [],
          },
          {
            tenantId: 'first-tenant',
            name: 'First Tenant',
            hostPatterns: ['shared.example.com'],
            cnameDomains: [],
          },
        ],
        sharedCache
      );

      await firstResolver.resolve({ host: 'shared.example.com' });
      const result = await secondResolver.resolve({
        host: 'shared.example.com',
      });

      expect(result?.tenantId).toBe('first-tenant');
    });
  });

  describe('Invalid or unrecognized requests', () => {
    it('treats an explicitly empty rules array as deny-all', async () => {
      const resolver = new TenantResolverService([]);
      const result = await resolver.resolve({
        host: 'wirepro.hopefulaspirationsindustries.com',
        xTenantId: 'wirepro-electrical',
      });

      expect(result).toBeNull();
      expect(resolver.getAllRules()).toEqual([]);
    });

    it('returns null for inactive tenants', async () => {
      const result = await service.resolve({ host: 'inactive.example.com' });
      expect(result).toBeNull();
    });

    it('returns null for unknown domain', async () => {
      const result = await service.resolve({ host: 'unknown.somedomain.com' });
      expect(result).toBeNull();
    });

    it('returns null when no host or tenant id is provided', async () => {
      const result = await service.resolve({});
      expect(result).toBeNull();
    });
  });
});
