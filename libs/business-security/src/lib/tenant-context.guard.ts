import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantResolverService } from './tenant-resolver.service';
import { OPTIONAL_TENANT_KEY } from './tenant-context.decorator';
import { TENANT_SCOPED_KEY } from './tenant-scoped.metadata';
import type { TenantScopedOptions } from './tenant-scoped.metadata';
import {
  isTrustedProxyRequest,
  TRUSTED_PROXY_CONFIG,
  TrustedProxyConfig,
} from './trusted-proxy';

export const TENANT_DB_CONNECTION = 'TENANT_DB_CONNECTION';

@Injectable()
export class TenantContextGuard implements CanActivate {
  private readonly tenantResolver: TenantResolverService;

  constructor(
    @Optional()
    tenantResolver?: TenantResolverService,
    @Optional()
    private readonly reflector?: Reflector,
    @Optional()
    @Inject(TRUSTED_PROXY_CONFIG)
    private readonly trustedProxyConfig?: TrustedProxyConfig
  ) {
    this.tenantResolver = tenantResolver ?? new TenantResolverService();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const tenantScopedOptions =
      this.reflector?.getAllAndOverride<TenantScopedOptions>(
        TENANT_SCOPED_KEY,
        [context.getHandler(), context.getClass()]
      );
    const optionalTenantMetadata = this.reflector?.getAllAndOverride<boolean>(
      OPTIONAL_TENANT_KEY,
      [context.getHandler(), context.getClass()]
    );
    const isOptional =
      tenantScopedOptions?.optional !== undefined
        ? tenantScopedOptions.optional === true
        : optionalTenantMetadata === true;

    const request = context.switchToHttp().getRequest() || {};
    const headers = request.headers || {};

    const xTenantId = this.getHeader(headers, 'x-tenant-id');
    const trustedTenantHeader = isTrustedProxyRequest(
      request,
      this.trustedProxyConfig
    )
      ? xTenantId
      : undefined;

    const host = this.getRequestHost(request, headers);

    const resolved = await this.tenantResolver.resolve({
      host,
      xTenantId: trustedTenantHeader,
    });

    if (!resolved) {
      if (isOptional) {
        return true;
      }
      throw new NotFoundException('Tenant not found');
    }

    // Attach resolved tenant metadata to request object
    request.tenant = resolved.tenant;
    request.tenantId = resolved.tenantId;
    request.tenantContext = resolved;

    return true;
  }

  private getRequestHost(
    request: Record<string, any>,
    headers: Record<string, any>
  ): string | undefined {
    const rawHost = this.getHeader(headers, 'host');
    if (!isTrustedProxyRequest(request, this.trustedProxyConfig)) {
      return rawHost;
    }
    const forwardedHeader =
      this.trustedProxyConfig?.forwardedHostHeader || 'x-forwarded-host';
    return this.getHeader(headers, forwardedHeader) || rawHost;
  }

  private getHeader(
    headers: Record<string, any>,
    headerName: string
  ): string | undefined {
    const matchingKey = Object.keys(headers).find(
      (key) => key.toLowerCase() === headerName.toLowerCase()
    );
    const rawValue = matchingKey ? headers[matchingKey] : undefined;
    const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
    return typeof value === 'string' && value ? value : undefined;
  }
}
