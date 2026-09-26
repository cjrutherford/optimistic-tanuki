import { Logger } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { DataSource, EntityManager, QueryRunner } from 'typeorm';
import {
  TenantContextGuard,
  TENANT_DB_CONNECTION,
} from './tenant-context.guard';
import { TenantResolverService } from './tenant-resolver.service';
import { TenantRlsInterceptor } from './tenant-rls.interceptor';
import { BusinessSecurityModule } from './business-security.module';
import {
  executeTenantRlsBinding,
  sanitizeTenantId,
  withTenantRlsTransaction,
} from './rls-session-binding';
import type { TenantRlsTransactionManager } from './rls-session-binding';

describe('PostgreSQL RLS Session Binding', () => {
  describe('sanitizeTenantId', () => {
    it('allows valid alphanumeric identifiers with hyphens and underscores', () => {
      expect(sanitizeTenantId('apex-detailing')).toBe('apex-detailing');
      expect(sanitizeTenantId('wirepro_123')).toBe('wirepro_123');
    });

    it('throws error for unsafe characters', () => {
      expect(() => sanitizeTenantId('tenant; DROP TABLE users;')).toThrow(
        'Unsafe tenant identifier'
      );
      expect(() => sanitizeTenantId('tenant" OR 1=1')).toThrow(
        'Unsafe tenant identifier'
      );
      expect(() => sanitizeTenantId('')).toThrow('Invalid tenantId provided');
    });
  });

  describe('executeTenantRlsBinding', () => {
    it('binds the tenant with a parameterized transaction-local setting', async () => {
      const query = jest.fn().mockResolvedValue([]);
      const runner = {
        isTransactionActive: true,
        query,
      } as unknown as QueryRunner;

      await executeTenantRlsBinding(runner, 'wirepro-electrical');

      expect(query).toHaveBeenCalledWith(
        "SELECT set_config('app.current_tenant_id', $1, true)",
        ['wirepro-electrical']
      );
    });

    it('rejects when no active transaction runner is available', async () => {
      const query = jest.fn().mockResolvedValue([]);

      await expect(
        executeTenantRlsBinding(null, 'wirepro-electrical')
      ).rejects.toThrow('active transaction runner');
      await expect(
        executeTenantRlsBinding(
          { query } as unknown as QueryRunner,
          'wirepro-electrical'
        )
      ).rejects.toThrow('active transaction runner');
    });

    it('does not log the tenant identifier while binding', async () => {
      const query = jest.fn().mockResolvedValue([]);
      const runner = {
        isTransactionActive: true,
        query,
      } as unknown as QueryRunner;
      const debugSpy = jest
        .spyOn(Logger.prototype, 'debug')
        .mockImplementation();

      await executeTenantRlsBinding(runner, 'tenant-without-logging');

      expect(debugSpy).not.toHaveBeenCalled();
      debugSpy.mockRestore();
    });
  });

  describe('withTenantRlsTransaction', () => {
    function createLifecycleDataSource(events: string[]): {
      dataSource: DataSource;
      runner: QueryRunner;
      transactionCalls: () => number;
    } {
      const runner = {
        isTransactionActive: true,
        query: async (_statement: string, parameters?: unknown[]) => {
          events.push(`bind:${parameters?.[0]}`);
          return [];
        },
      } as unknown as QueryRunner;
      let transactionCalls = 0;
      const dataSource = {
        transaction: async <T>(
          callback: (manager: EntityManager) => Promise<T>
        ): Promise<T> => {
          transactionCalls += 1;
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

      return {
        dataSource,
        runner,
        transactionCalls: () => transactionCalls,
      };
    }

    it('invokes the operation through the data source transaction', async () => {
      const events: string[] = [];
      const harness = createLifecycleDataSource(events);
      let receivedManager: TenantRlsTransactionManager | undefined;

      await withTenantRlsTransaction(
        harness.dataSource,
        'wirepro-electrical',
        async (manager) => {
          receivedManager = manager;
          return 'completed';
        }
      );

      expect(harness.transactionCalls()).toBe(1);
      expect(receivedManager?.queryRunner).toBe(harness.runner);
    });

    it('binds the tenant before invoking the operation', async () => {
      const events: string[] = [];
      const harness = createLifecycleDataSource(events);

      await withTenantRlsTransaction(
        harness.dataSource,
        'wirepro-electrical',
        async () => {
          events.push('operation');
          return 'completed';
        }
      );

      expect(events).toEqual([
        'start',
        'bind:wirepro-electrical',
        'operation',
        'commit',
      ]);
    });

    it('commits when the operation succeeds', async () => {
      const events: string[] = [];
      const harness = createLifecycleDataSource(events);

      const result = await withTenantRlsTransaction(
        harness.dataSource,
        'wirepro-electrical',
        async () => 'committed'
      );

      expect(result).toBe('committed');
      expect(events).toContain('commit');
      expect(events).not.toContain('rollback');
    });

    it('rolls back when the operation fails', async () => {
      const events: string[] = [];
      const harness = createLifecycleDataSource(events);

      await expect(
        withTenantRlsTransaction(
          harness.dataSource,
          'wirepro-electrical',
          async () => {
            events.push('operation');
            throw new Error('operation failed');
          }
        )
      ).rejects.toThrow('operation failed');
      expect(events).toEqual([
        'start',
        'bind:wirepro-electrical',
        'operation',
        'rollback',
      ]);
    });

    it('accepts a TypeORM DataSource-shaped transaction callback', async () => {
      const queryRunner = {
        isTransactionActive: true,
        query: jest.fn().mockResolvedValue([]),
      } as unknown as QueryRunner;
      const dataSource = {
        transaction: async <T>(
          callback: (manager: EntityManager) => Promise<T>
        ): Promise<T> => callback({ queryRunner } as unknown as EntityManager),
      } as unknown as DataSource;

      await expect(
        withTenantRlsTransaction(
          dataSource,
          'wirepro-electrical',
          async (manager) => manager.queryRunner
        )
      ).resolves.toBe(queryRunner);
    });
  });

  it('registers the configured tenant database provider', () => {
    const provider = {
      provide: TENANT_DB_CONNECTION,
      useValue: {},
    };
    const dynamicModule = BusinessSecurityModule.forRoot({
      dbConnectionProvider: provider,
    });

    expect(dynamicModule.providers).toContain(provider);
    expect(dynamicModule.exports).toContain(TENANT_DB_CONNECTION);
  });

  it('does not export the tenant database token for a different provider token', () => {
    const provider = {
      provide: 'OTHER_TENANT_DATABASE',
      useValue: {},
    };
    const dynamicModule = BusinessSecurityModule.forRoot({
      dbConnectionProvider: provider,
    });

    expect(dynamicModule.providers).toContain(provider);
    expect(dynamicModule.exports).not.toContain(TENANT_DB_CONNECTION);
  });

  it('does not export the tenant database token without configuration', () => {
    const dynamicModule = BusinessSecurityModule.forRoot();

    expect(dynamicModule.exports).not.toContain(TENANT_DB_CONNECTION);
  });

  it('resolves the configured data source into the tenant interceptor', async () => {
    const dataSource = {
      transaction: jest.fn(),
    } as unknown as DataSource;
    const provider = {
      provide: TENANT_DB_CONNECTION,
      useValue: dataSource,
    };
    const moduleRef = await Test.createTestingModule({
      imports: [
        BusinessSecurityModule.forRoot({
          dbConnectionProvider: provider,
        }),
      ],
    }).compile();
    const interceptor = moduleRef.get(TenantRlsInterceptor);

    expect(
      (interceptor as unknown as { dataSource: DataSource }).dataSource
    ).toBe(dataSource);
    await moduleRef.close();
  });

  it('preserves request tenant context without accepting a transaction runner', async () => {
    const query = jest.fn().mockResolvedValue([]);
    const runner = { isTransactionActive: true, query };
    const request = {
      headers: {
        host: 'wirepro.hopefulaspirationsindustries.com',
      },
    };
    const context = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;
    const Guard = TenantContextGuard as unknown as new (
      ...args: unknown[]
    ) => TenantContextGuard;
    const guard = new Guard(
      new TenantResolverService(),
      new Reflector(),
      runner
    );

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request).toEqual(
      expect.objectContaining({
        tenantId: 'wirepro-electrical',
        tenant: expect.objectContaining({ tenantId: 'wirepro-electrical' }),
        tenantContext: expect.objectContaining({
          tenantId: 'wirepro-electrical',
          matchedBy: 'host',
        }),
      })
    );
    expect(query).not.toHaveBeenCalled();
  });
});
