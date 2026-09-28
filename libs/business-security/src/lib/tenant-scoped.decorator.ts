import {
  applyDecorators,
  SetMetadata,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { TenantContextGuard } from './tenant-context.guard';
import { TenantRlsInterceptor } from './tenant-rls.interceptor';
import { TENANT_SCOPED_KEY } from './tenant-scoped.metadata';
import type { TenantScopedOptions } from './tenant-scoped.metadata';

export { TENANT_SCOPED_KEY } from './tenant-scoped.metadata';
export type { TenantScopedOptions } from './tenant-scoped.metadata';

/**
 * Decorates a controller or route handler to enforce tenant resolution and PostgreSQL RLS session binding.
 */
export function TenantScoped(
  options: TenantScopedOptions = {}
): MethodDecorator & ClassDecorator {
  return applyDecorators(
    SetMetadata(TENANT_SCOPED_KEY, options),
    UseGuards(TenantContextGuard),
    UseInterceptors(TenantRlsInterceptor)
  );
}
