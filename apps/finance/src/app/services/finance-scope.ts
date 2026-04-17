import { FindManyOptions, FindOneOptions, FindOptionsWhere } from 'typeorm';

export type FinanceScope = {
  userId?: string;
  profileId?: string;
  tenantId?: string;
  appScope?: string;
};

type Where<T> = FindOptionsWhere<T> | FindOptionsWhere<T>[];

export const extractFinanceScope = (
  payload?: Record<string, unknown> | null
): FinanceScope | undefined => {
  if (!payload) {
    return undefined;
  }

  const scope: FinanceScope = {
    userId: typeof payload.userId === 'string' ? payload.userId : undefined,
    profileId:
      typeof payload.profileId === 'string' ? payload.profileId : undefined,
    tenantId:
      typeof payload.tenantId === 'string' ? payload.tenantId : undefined,
    appScope:
      typeof payload.appScope === 'string' ? payload.appScope : undefined,
  };

  return Object.values(scope).some(Boolean) ? scope : undefined;
};

const scopeWhere = <T>(scope?: FinanceScope): FindOptionsWhere<T> => {
  const where: Record<string, string> = {};

  if (scope?.userId) {
    where.userId = scope.userId;
  }
  if (scope?.profileId) {
    where.profileId = scope.profileId;
  }
  if (scope?.tenantId) {
    where.tenantId = scope.tenantId;
  }
  if (scope?.appScope) {
    where.appScope = scope.appScope;
  }

  return where as FindOptionsWhere<T>;
};

export const withScopeWhere = <T>(
  base: FindOptionsWhere<T>,
  scope?: FinanceScope
): FindOptionsWhere<T> => ({
  ...scopeWhere<T>(scope),
  ...base,
});

export const mergeScopedWhere = <T>(
  where: Where<T> | undefined,
  scope?: FinanceScope
): Where<T> | undefined => {
  if (!scope) {
    return where;
  }

  if (Array.isArray(where)) {
    return where.map((entry) => withScopeWhere(entry, scope));
  }

  return withScopeWhere((where ?? {}) as FindOptionsWhere<T>, scope);
};

export const withScopedFindOneOptions = <T>(
  id: string,
  scope?: FinanceScope,
  options?: FindOneOptions<T>
): FindOneOptions<T> => ({
  ...options,
  where: mergeScopedWhere(
    { id } as unknown as FindOptionsWhere<T>,
    scope
  ) as FindOptionsWhere<T>,
});

export const withScopedFindManyOptions = <T>(
  scope?: FinanceScope,
  options?: FindManyOptions<T>
): FindManyOptions<T> => ({
  ...options,
  where: mergeScopedWhere(options?.where as Where<T> | undefined, scope),
});
