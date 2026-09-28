import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { from, lastValueFrom, Observable, throwError } from 'rxjs';
import type { EntityManager, QueryRunner } from 'typeorm';
import { OPTIONAL_TENANT_KEY } from './tenant-context.decorator';
import { TENANT_DB_CONNECTION } from './tenant-context.guard';
import { withTenantRlsTransaction } from './rls-session-binding';
import type { TenantRlsDataSource } from './rls-session-binding';
import { TENANT_SCOPED_KEY } from './tenant-scoped.metadata';
import type { TenantScopedOptions } from './tenant-scoped.metadata';

export interface TenantRlsRequest {
  tenantId?: string;
  tenantEntityManager: EntityManager;
  tenantQueryRunner: QueryRunner;
}

@Injectable()
export class TenantRlsInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    @Optional()
    @Inject(TENANT_DB_CONNECTION)
    private readonly dataSource?: TenantRlsDataSource
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options = this.reflector.getAllAndOverride<TenantScopedOptions>(
      TENANT_SCOPED_KEY,
      [context.getHandler(), context.getClass()]
    );
    const optionalTenantMetadata = this.reflector.getAllAndOverride<boolean>(
      OPTIONAL_TENANT_KEY,
      [context.getHandler(), context.getClass()]
    );
    const isOptional =
      options?.optional !== undefined
        ? options.optional === true
        : optionalTenantMetadata === true;

    if (!options || options.rls === false) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest() as TenantRlsRequest;
    const tenantId =
      typeof request?.tenantId === 'string' ? request.tenantId : undefined;

    if (!tenantId && isOptional) {
      return next.handle();
    }

    if (!this.dataSource || typeof this.dataSource.transaction !== 'function') {
      return throwError(
        () =>
          new ServiceUnavailableException(
            'Tenant RLS transaction provider is not configured'
          )
      );
    }

    if (!tenantId) {
      return throwError(
        () =>
          new ServiceUnavailableException(
            'Tenant RLS transaction context is not available'
          )
      );
    }

    return from(
      withTenantRlsTransaction(this.dataSource, tenantId, (manager) => {
        const entityManager = manager as EntityManager;
        const queryRunner = entityManager.queryRunner;
        if (!queryRunner) {
          throw new ServiceUnavailableException(
            'Tenant RLS transaction context is not available'
          );
        }
        request.tenantEntityManager = entityManager;
        request.tenantQueryRunner = queryRunner;
        return lastValueFrom(next.handle());
      })
    );
  }
}
