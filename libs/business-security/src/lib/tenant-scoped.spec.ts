import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TENANT_SCOPED_KEY, TenantScoped } from './tenant-scoped.decorator';
import { OptionalTenant } from './tenant-context.decorator';
import { BusinessSecurityModule } from './business-security.module';
import { TenantContextGuard } from './tenant-context.guard';
import { TenantRlsInterceptor } from './tenant-rls.interceptor';
import { TenantResolverService } from './tenant-resolver.service';

function requestContext(request: Record<string, unknown>): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

const trustedProxyConfig = {
  enabled: true,
  trustedProxyAddresses: ['127.0.0.1'],
};

describe('@TenantScoped() Decorator', () => {
  @TenantScoped()
  class TestController {
    @TenantScoped({ optional: true })
    testMethod() {
      return { ok: true };
    }
  }

  it('attaches metadata to class and method', () => {
    const classMeta = Reflect.getMetadata(TENANT_SCOPED_KEY, TestController);
    expect(classMeta).toEqual({});

    const methodMeta = Reflect.getMetadata(
      TENANT_SCOPED_KEY,
      TestController.prototype.testMethod
    );
    expect(methodMeta).toEqual({ optional: true });
  });

  it('registers the tenant context guard and RLS interceptor', () => {
    const guards = Reflect.getMetadata(
      '__guards__',
      TestController.prototype.testMethod
    ) as unknown[];
    const interceptors = Reflect.getMetadata(
      '__interceptors__',
      TestController.prototype.testMethod
    ) as unknown[];

    expect(guards).toContain(TenantContextGuard);
    expect(interceptors).toContain(TenantRlsInterceptor);
  });

  it('lets an explicit required method override a class optional marker', async () => {
    @OptionalTenant()
    class ClassOptionalController {
      @TenantScoped({ optional: false })
      requiredMethod() {}
    }

    const context = {
      getHandler: () => ClassOptionalController.prototype.requiredMethod,
      getClass: () => ClassOptionalController,
      switchToHttp: () => ({
        getRequest: () => ({ headers: { host: 'unregistered.example.com' } }),
      }),
    } as unknown as ExecutionContext;

    await expect(
      new TenantContextGuard(
        new TenantResolverService(),
        new Reflector()
      ).canActivate(context)
    ).rejects.toThrow(NotFoundException);
  });

  it('allows a method optional marker to override a required class', async () => {
    @TenantScoped()
    class RequiredClassController {
      @TenantScoped({ optional: true })
      optionalMethod() {}
    }

    const context = {
      getHandler: () => RequiredClassController.prototype.optionalMethod,
      getClass: () => RequiredClassController,
      switchToHttp: () => ({
        getRequest: () => ({ headers: { host: 'unregistered.example.com' } }),
      }),
    } as unknown as ExecutionContext;

    await expect(
      new TenantContextGuard(
        new TenantResolverService(),
        new Reflector()
      ).canActivate(context)
    ).resolves.toBe(true);
  });

  it('keeps both class and method optional markers optional', async () => {
    @OptionalTenant()
    class BothOptionalController {
      @TenantScoped({ optional: true })
      optionalMethod() {}
    }

    const context = {
      getHandler: () => BothOptionalController.prototype.optionalMethod,
      getClass: () => BothOptionalController,
      switchToHttp: () => ({
        getRequest: () => ({ headers: { host: 'unregistered.example.com' } }),
      }),
    } as unknown as ExecutionContext;

    await expect(
      new TenantContextGuard(
        new TenantResolverService(),
        new Reflector()
      ).canActivate(context)
    ).resolves.toBe(true);
  });

  it('allows an unresolved tenant when the decorator marks the route optional', async () => {
    @TenantScoped({ optional: true })
    class OptionalTenantController {}

    const request = {
      headers: {
        host: 'unregistered.example.com',
      },
    };
    const context = {
      getHandler: () => OptionalTenantController.prototype,
      getClass: () => OptionalTenantController,
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
    const guard = new TenantContextGuard(
      new TenantResolverService(),
      new Reflector()
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request).not.toHaveProperty('tenantId');
  });

  it('rejects an unresolved tenant when the decorator is not optional', async () => {
    @TenantScoped()
    class RequiredTenantController {}

    const context = {
      getHandler: () => RequiredTenantController.prototype,
      getClass: () => RequiredTenantController,
      switchToHttp: () => ({
        getRequest: () => ({ headers: {} }),
      }),
    } as unknown as ExecutionContext;
    const guard = new TenantContextGuard(
      new TenantResolverService(),
      new Reflector()
    );

    await expect(guard.canActivate(context)).rejects.toThrow(NotFoundException);
  });

  it('rejects an unrecognized host with X-Tenant-ID by default', async () => {
    const resolver = new TenantResolverService([
      {
        tenantId: 'recognized-tenant',
        name: 'Recognized Tenant',
        hostPatterns: ['recognized.example.com'],
        cnameDomains: [],
      },
    ]);
    const guard = new TenantContextGuard(resolver, new Reflector());
    const request = {
      headers: {
        host: 'unknown.example.com',
        'x-tenant-id': 'recognized-tenant',
      },
    };

    await expect(guard.canActivate(requestContext(request))).rejects.toThrow(
      NotFoundException
    );
    expect(request).not.toHaveProperty('tenantId');
  });

  it('allows a valid X-Tenant-ID fallback when explicitly configured', async () => {
    const resolver = new TenantResolverService(
      [
        {
          tenantId: 'recognized-tenant',
          name: 'Recognized Tenant',
          hostPatterns: ['recognized.example.com'],
          cnameDomains: [],
        },
      ],
      undefined,
      { allowHeaderFallback: true }
    );
    const guard = new TenantContextGuard(
      resolver,
      new Reflector(),
      trustedProxyConfig
    );
    const request = {
      ip: '127.0.0.1',
      headers: {
        host: 'unknown.example.com',
        'x-tenant-id': 'recognized-tenant',
      },
    };

    await expect(guard.canActivate(requestContext(request))).resolves.toBe(
      true
    );
    expect(request).toHaveProperty('tenantId', 'recognized-tenant');
  });

  it('rejects an enabled header fallback from an untrusted source', async () => {
    const resolver = new TenantResolverService(
      [
        {
          tenantId: 'recognized-tenant',
          name: 'Recognized Tenant',
          hostPatterns: ['recognized.example.com'],
          cnameDomains: [],
        },
      ],
      undefined,
      { allowHeaderFallback: true }
    );
    const guard = new TenantContextGuard(
      resolver,
      new Reflector(),
      trustedProxyConfig
    );
    const request = {
      ip: '198.51.100.20',
      headers: {
        host: 'unknown.example.com',
        'x-tenant-id': 'recognized-tenant',
      },
    };

    await expect(guard.canActivate(requestContext(request))).rejects.toThrow(
      NotFoundException
    );
    expect(request).not.toHaveProperty('tenantId');
  });

  it('rejects an unknown X-Tenant-ID even when fallback is enabled', async () => {
    const resolver = new TenantResolverService(
      [
        {
          tenantId: 'recognized-tenant',
          name: 'Recognized Tenant',
          hostPatterns: ['recognized.example.com'],
          cnameDomains: [],
        },
      ],
      undefined,
      { allowHeaderFallback: true }
    );
    const guard = new TenantContextGuard(resolver, new Reflector());
    const request = {
      headers: {
        host: 'unknown.example.com',
        'x-tenant-id': 'unknown-tenant',
      },
    };

    await expect(guard.canActivate(requestContext(request))).rejects.toThrow(
      NotFoundException
    );
  });

  it('denies header fallback by default even for a trusted source', async () => {
    const resolver = new TenantResolverService([
      {
        tenantId: 'recognized-tenant',
        name: 'Recognized Tenant',
        hostPatterns: ['recognized.example.com'],
        cnameDomains: [],
      },
    ]);
    const guard = new TenantContextGuard(
      resolver,
      new Reflector(),
      trustedProxyConfig
    );
    const request = {
      ip: '127.0.0.1',
      headers: {
        host: 'unknown.example.com',
        'x-tenant-id': 'recognized-tenant',
      },
    };

    await expect(guard.canActivate(requestContext(request))).rejects.toThrow(
      NotFoundException
    );
  });

  it('keeps a recognized host ahead of a conflicting X-Tenant-ID', async () => {
    const resolver = new TenantResolverService(
      [
        {
          tenantId: 'host-tenant',
          name: 'Host Tenant',
          hostPatterns: ['recognized.example.com'],
          cnameDomains: [],
        },
        {
          tenantId: 'header-tenant',
          name: 'Header Tenant',
          hostPatterns: [],
          cnameDomains: [],
        },
      ],
      undefined,
      { allowHeaderFallback: true }
    );
    const guard = new TenantContextGuard(
      resolver,
      new Reflector(),
      trustedProxyConfig
    );
    const request = {
      ip: '127.0.0.1',
      headers: {
        host: 'recognized.example.com',
        'x-tenant-id': 'header-tenant',
      },
    };

    await expect(guard.canActivate(requestContext(request))).resolves.toBe(
      true
    );
    expect(request).toHaveProperty('tenantId', 'host-tenant');
  });

  it('uses the raw Host header instead of a forged forwarded host by default', async () => {
    const resolver = new TenantResolverService([
      {
        tenantId: 'recognized-tenant',
        name: 'Recognized Tenant',
        hostPatterns: ['recognized.example.com'],
        cnameDomains: [],
      },
    ]);
    const request = {
      ip: '198.51.100.20',
      headers: {
        host: 'recognized.example.com',
        'x-forwarded-host': 'attacker.example.com',
      },
    };
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    const guard = new TenantContextGuard(resolver, new Reflector());

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request).toHaveProperty('tenantId', 'recognized-tenant');
  });

  it('uses forwarded host only when the request comes from a configured proxy', async () => {
    const resolver = new TenantResolverService([
      {
        tenantId: 'recognized-tenant',
        name: 'Recognized Tenant',
        hostPatterns: ['recognized.example.com'],
        cnameDomains: [],
      },
    ]);
    const request = {
      ip: '127.0.0.1',
      headers: {
        host: 'proxy.internal',
        'x-forwarded-host': 'recognized.example.com',
      },
    };
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    const Guard = TenantContextGuard as unknown as new (
      ...args: unknown[]
    ) => TenantContextGuard;
    const guard = new Guard(resolver, new Reflector(), {
      enabled: true,
      trustedProxyAddresses: ['127.0.0.1'],
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request).toHaveProperty('tenantId', 'recognized-tenant');
  });

  it('does not trust forwarded host from an untrusted source when enabled', async () => {
    const resolver = new TenantResolverService([
      {
        tenantId: 'recognized-tenant',
        name: 'Recognized Tenant',
        hostPatterns: ['recognized.example.com'],
        cnameDomains: [],
      },
    ]);
    const request = {
      ip: '198.51.100.20',
      headers: {
        host: 'recognized.example.com',
        'x-forwarded-host': 'attacker.example.com',
      },
    };
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    const Guard = TenantContextGuard as unknown as new (
      ...args: unknown[]
    ) => TenantContextGuard;
    const guard = new Guard(resolver, new Reflector(), {
      enabled: true,
      trustedProxyAddresses: ['127.0.0.1'],
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request).toHaveProperty('tenantId', 'recognized-tenant');
  });

  it('does not trust a derived IP when the transport peer is untrusted', async () => {
    const resolver = new TenantResolverService([
      {
        tenantId: 'recognized-tenant',
        name: 'Recognized Tenant',
        hostPatterns: ['recognized.example.com'],
        cnameDomains: [],
      },
    ]);
    const request = {
      ip: '127.0.0.1',
      socket: { remoteAddress: '198.51.100.20' },
      connection: { remoteAddress: '127.0.0.1' },
      headers: {
        host: 'recognized.example.com',
        'x-forwarded-host': 'attacker.example.com',
      },
    };
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    const Guard = TenantContextGuard as unknown as new (
      ...args: unknown[]
    ) => TenantContextGuard;
    const guard = new Guard(resolver, new Reflector(), {
      enabled: true,
      trustedProxyAddresses: ['127.0.0.1'],
    });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request).toHaveProperty('tenantId', 'recognized-tenant');
  });

  it('registers an explicit tenant header fallback configuration provider', () => {
    const dynamicModule = BusinessSecurityModule.forRoot({
      allowHeaderFallback: true,
    });

    expect(dynamicModule.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provide: 'TENANT_HEADER_FALLBACK_CONFIG',
          useValue: { allowHeaderFallback: true },
        }),
      ])
    );
  });

  it('registers an explicit trusted-proxy configuration provider', () => {
    const trustedProxy = {
      enabled: true,
      trustedProxyAddresses: ['127.0.0.1'],
    };
    const dynamicModule = BusinessSecurityModule.forRoot({
      trustedProxy,
    } as any);

    expect(dynamicModule.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provide: 'BUSINESS_SECURITY_TRUSTED_PROXY',
          useValue: trustedProxy,
        }),
      ])
    );
  });
});
