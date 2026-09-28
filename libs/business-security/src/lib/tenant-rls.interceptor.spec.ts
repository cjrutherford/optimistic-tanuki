import { ServiceUnavailableException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, of, throwError } from 'rxjs';
import type { DataSource, EntityManager, QueryRunner } from 'typeorm';
import { OptionalTenant } from './tenant-context.decorator';
import { TENANT_DB_CONNECTION } from './tenant-context.guard';
import { COMPLIANCE_AUDIT_OPTIONS } from './compliance-audit.service';
import { BusinessSecurityModule } from './business-security.module';
import { TenantScoped } from './tenant-scoped.decorator';
import type { TenantRlsRequest } from './tenant-rls.interceptor';
import { TenantRlsInterceptor } from './tenant-rls.interceptor';

function createContext(
  request: Record<string, unknown>,
  handler: unknown = {},
  classRef: unknown = {}
): any {
  return {
    getHandler: () => handler,
    getClass: () => classRef,
    switchToHttp: () => ({ getRequest: () => request }),
  };
}

function createDataSource(events: string[]): DataSource {
  const runner = {
    isTransactionActive: true,
    query: async (_statement: string, parameters?: unknown[]) => {
      events.push(`bind:${parameters?.[0]}`);
      return [];
    },
  } as unknown as QueryRunner;

  return {
    transaction: async <T>(
      callback: (manager: EntityManager) => Promise<T>
    ): Promise<T> => {
      events.push('start');
      try {
        const result = await callback({
          queryRunner: runner,
        } as unknown as EntityManager);
        events.push('commit');
        return result;
      } catch (error) {
        events.push('rollback');
        throw error;
      }
    },
  } as unknown as DataSource;
}

describe('TenantRlsInterceptor', () => {
  it('binds, commits, and preserves response identity for required routes', async () => {
    const events: string[] = [];
    const response = { documentId: 'document-1' };
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({});
    const interceptor = new TenantRlsInterceptor(
      reflector,
      createDataSource(events)
    );

    const result = await firstValueFrom(
      interceptor.intercept(createContext({ tenantId: 'tenant-rls' }), {
        handle: () => of(response),
      })
    );

    expect(result).toBe(response);
    expect(events).toEqual(['start', 'bind:tenant-rls', 'commit']);
  });

  it('exposes the active manager and query runner through the request', async () => {
    const events: string[] = [];
    const runner = {
      isTransactionActive: true,
      query: async (_statement: string, parameters?: unknown[]) => {
        events.push(`bind:${parameters?.[0]}`);
        return [];
      },
    } as unknown as QueryRunner;
    const manager = { queryRunner: runner } as unknown as EntityManager;
    const dataSource = {
      transaction: async <T>(
        callback: (transactionManager: EntityManager) => Promise<T>
      ): Promise<T> => {
        events.push('start');
        try {
          const result = await callback(manager);
          events.push('commit');
          return result;
        } catch (error) {
          events.push('rollback');
          throw error;
        }
      },
    } as unknown as DataSource;
    const request: Record<string, unknown> & Partial<TenantRlsRequest> = {
      tenantId: 'tenant-rls',
    };
    const response = { documentId: 'document-2' };
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({});
    const interceptor = new TenantRlsInterceptor(reflector, dataSource);
    let observedManager: unknown;
    let observedQueryRunner: unknown;

    const result = await firstValueFrom(
      interceptor.intercept(createContext(request), {
        handle: () => {
          observedManager = request['tenantEntityManager'];
          observedQueryRunner = request['tenantQueryRunner'];
          return of(response);
        },
      })
    );

    expect(result).toBe(response);
    expect(observedManager).toBe(manager);
    expect(observedQueryRunner).toBe(runner);
    expect(request['tenantEntityManager']).toBe(manager);
    expect(request['tenantQueryRunner']).toBe(runner);
    expect(events).toEqual(['start', 'bind:tenant-rls', 'commit']);
  });

  it('rolls back and rethrows the original handler error', async () => {
    const events: string[] = [];
    const originalError = new Error('operation failed');
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({});
    const interceptor = new TenantRlsInterceptor(
      reflector,
      createDataSource(events)
    );

    await expect(
      firstValueFrom(
        interceptor.intercept(createContext({ tenantId: 'tenant-rls' }), {
          handle: () => throwError(() => originalError),
        })
      )
    ).rejects.toBe(originalError);
    expect(events).toEqual(['start', 'bind:tenant-rls', 'rollback']);
  });

  it('fails closed when required RLS has no provider', async () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({});
    const next = { handle: jest.fn(() => of({ success: true })) };
    const interceptor = new TenantRlsInterceptor(reflector);

    await expect(
      firstValueFrom(
        interceptor.intercept(createContext({ tenantId: 'tenant-rls' }), next)
      )
    ).rejects.toThrow(ServiceUnavailableException);
    expect(next.handle).not.toHaveBeenCalled();
  });

  it('uses method-level OptionalTenant metadata when TenantScoped omits optional', async () => {
    @TenantScoped()
    class OptionalMethodController {
      @OptionalTenant()
      optionalMethod() {}
    }
    const response = { success: true };
    const next = { handle: jest.fn(() => of(response)) };
    const interceptor = new TenantRlsInterceptor(new Reflector());

    await expect(
      firstValueFrom(
        interceptor.intercept(
          createContext(
            {},
            OptionalMethodController.prototype.optionalMethod,
            OptionalMethodController
          ),
          next
        )
      )
    ).resolves.toBe(response);
    expect(next.handle).toHaveBeenCalledTimes(1);
  });

  it('keeps explicit method optional false authoritative over class optional metadata', async () => {
    @OptionalTenant()
    class RequiredMethodController {
      @TenantScoped({ optional: false })
      requiredMethod() {}
    }
    const next = { handle: jest.fn(() => of({ success: true })) };
    const interceptor = new TenantRlsInterceptor(new Reflector());

    await expect(
      firstValueFrom(
        interceptor.intercept(
          createContext(
            {},
            RequiredMethodController.prototype.requiredMethod,
            RequiredMethodController
          ),
          next
        )
      )
    ).rejects.toThrow(ServiceUnavailableException);
    expect(next.handle).not.toHaveBeenCalled();
  });

  it('preserves an explicit context-only path', async () => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({ rls: false });
    const response = { success: true };
    const next = { handle: jest.fn(() => of(response)) };
    const interceptor = new TenantRlsInterceptor(reflector);

    await expect(
      firstValueFrom(interceptor.intercept(createContext({}), next))
    ).resolves.toBe(response);
    expect(next.handle).toHaveBeenCalledTimes(1);
  });

  it('registers the RLS interceptor and configured providers', () => {
    const provider = {
      provide: TENANT_DB_CONNECTION,
      useValue: createDataSource([]),
    };
    const audit = { maxRecords: 7, maxRecordsPerTenant: 3 };
    const dynamicModule = BusinessSecurityModule.forRoot({
      dbConnectionProvider: provider,
      audit,
    });

    expect(dynamicModule.providers).toContain(TenantRlsInterceptor);
    expect(dynamicModule.providers).toContain(provider);
    expect(dynamicModule.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          provide: COMPLIANCE_AUDIT_OPTIONS,
          useValue: audit,
        }),
      ])
    );
  });
});
