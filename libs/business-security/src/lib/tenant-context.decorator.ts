import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { TenantContext, TenantRoutingRule } from './tenant-resolution.types';

export const OPTIONAL_TENANT_KEY = 'OPTIONAL_TENANT';
export const OptionalTenant = () => SetMetadata(OPTIONAL_TENANT_KEY, true);

export const Tenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantRoutingRule | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenant;
  }
);

export const TenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenantId;
  }
);

export const TenantCtx = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContext | undefined => {
    const request = ctx.switchToHttp().getRequest();
    return request.tenantContext;
  }
);
