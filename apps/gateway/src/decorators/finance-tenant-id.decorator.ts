import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const FinanceTenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const value = request.headers['x-finance-tenant-id'];

    return typeof value === 'string' ? value : null;
  }
);
