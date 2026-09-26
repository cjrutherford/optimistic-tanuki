import type { DataSource, EntityManager, QueryRunner } from 'typeorm';

export const TENANT_RLS_SET_CONFIG_QUERY =
  "SELECT set_config('app.current_tenant_id', $1, true)";

export type TenantRlsQueryRunner = Pick<
  QueryRunner,
  'query' | 'isTransactionActive' | 'isReleased'
>;

export function sanitizeTenantId(tenantId: string): string {
  if (typeof tenantId !== 'string' || !tenantId.trim()) {
    throw new Error('Invalid tenantId provided for RLS session binding');
  }

  const trimmed = tenantId.trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    throw new Error('Unsafe tenant identifier');
  }

  return trimmed;
}

function isActiveTransactionRunner(
  runner: TenantRlsQueryRunner | null | undefined
): runner is TenantRlsQueryRunner {
  return (
    !!runner &&
    typeof runner.query === 'function' &&
    runner.isTransactionActive === true &&
    runner.isReleased !== true
  );
}

export async function executeTenantRlsBinding(
  runner: TenantRlsQueryRunner | null | undefined,
  tenantId: string
): Promise<void> {
  if (!isActiveTransactionRunner(runner)) {
    throw new Error(
      'An active transaction runner is required for RLS session binding'
    );
  }

  const safeTenantId = sanitizeTenantId(tenantId);
  await runner.query(TENANT_RLS_SET_CONFIG_QUERY, [safeTenantId]);
}

export type TenantRlsTransactionManager = Pick<EntityManager, 'queryRunner'>;

export type TenantRlsDataSource = Pick<DataSource, 'transaction'>;

export async function withTenantRlsTransaction<T>(
  dataSource: TenantRlsDataSource,
  tenantId: string,
  operation: (manager: TenantRlsTransactionManager) => Promise<T> | T
): Promise<T> {
  if (!dataSource || typeof dataSource.transaction !== 'function') {
    throw new Error(
      'A transaction-capable data source is required for RLS binding'
    );
  }

  return dataSource.transaction(async (manager) => {
    await executeTenantRlsBinding(manager.queryRunner, tenantId);
    return operation(manager);
  });
}
