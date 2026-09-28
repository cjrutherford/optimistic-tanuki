import { DynamicModule, Module, Provider } from '@nestjs/common';
import {
  DEFAULT_TENANT_HEADER_FALLBACK_CONFIG,
  TENANT_HEADER_FALLBACK_CONFIG,
  TenantResolverService,
} from './tenant-resolver.service';
import {
  TENANT_DB_CONNECTION,
  TenantContextGuard,
} from './tenant-context.guard';
import { TenantRlsInterceptor } from './tenant-rls.interceptor';
import { ITenantCache, MemoryTenantCache } from './tenant-cache';
import { TenantRoutingRule } from './tenant-resolution.types';
import {
  COMPLIANCE_AUDIT_OPTIONS,
  ComplianceAuditService,
} from './compliance-audit.service';
import type { ComplianceAuditServiceOptions } from './compliance-audit.service';
import { ComplianceAuditInterceptor } from './compliance-audit.interceptor';
import { TimeLockedOtpService } from './time-locked-otp.service';
import { TimeLockedOtpGuard } from './time-locked-otp.guard';
import { OTP_CHALLENGE_STORE } from './otp-challenge.store';
import { OTP_SMS_DISPATCHER } from './twilio-otp-sms.dispatcher';
import { AntivirusScanInterceptor } from './antivirus-scan.interceptor';
import {
  DEFAULT_TRUSTED_PROXY_CONFIG,
  TRUSTED_PROXY_CONFIG,
  TrustedProxyConfig,
} from './trusted-proxy';

export interface BusinessSecurityModuleOptions {
  rules?: TenantRoutingRule[];
  cacheProvider?: ITenantCache;
  allowHeaderFallback?: boolean;
  dbConnectionProvider?: Provider;
  audit?: ComplianceAuditServiceOptions;
  trustedProxy?: TrustedProxyConfig;
  otpChallengeStoreProvider?: Provider;
  otpSmsDispatcherProvider?: Provider;
}

const TRUSTED_PROXY_PROVIDER: Provider = {
  provide: TRUSTED_PROXY_CONFIG,
  useValue: DEFAULT_TRUSTED_PROXY_CONFIG,
};

const TENANT_HEADER_FALLBACK_PROVIDER: Provider = {
  provide: TENANT_HEADER_FALLBACK_CONFIG,
  useValue: DEFAULT_TENANT_HEADER_FALLBACK_CONFIG,
};

function isTenantDbConnectionProvider(provider: Provider): boolean {
  return (
    typeof provider === 'object' &&
    provider !== null &&
    'provide' in provider &&
    provider.provide === TENANT_DB_CONNECTION
  );
}

const COMMON_PROVIDERS: Provider[] = [
  ComplianceAuditService,
  ComplianceAuditInterceptor,
  TimeLockedOtpGuard,
  AntivirusScanInterceptor,
  TenantRlsInterceptor,
];

@Module({
  providers: [
    TenantResolverService,
    TenantContextGuard,
    ...COMMON_PROVIDERS,
    TRUSTED_PROXY_PROVIDER,
    TENANT_HEADER_FALLBACK_PROVIDER,
  ],
  exports: [
    TenantResolverService,
    TenantContextGuard,
    ...COMMON_PROVIDERS,
    TRUSTED_PROXY_CONFIG,
    TENANT_HEADER_FALLBACK_CONFIG,
  ],
})
export class BusinessSecurityModule {
  static forRoot(options: BusinessSecurityModuleOptions = {}): DynamicModule {
    const providers: Provider[] = [
      {
        provide: TenantResolverService,
        useFactory: () => {
          return new TenantResolverService(
            options.rules,
            options.cacheProvider ?? new MemoryTenantCache(),
            {
              allowHeaderFallback: options.allowHeaderFallback === true,
            }
          );
        },
      },
      TenantContextGuard,
      ...COMMON_PROVIDERS,
      {
        provide: TRUSTED_PROXY_CONFIG,
        useValue: options.trustedProxy ?? DEFAULT_TRUSTED_PROXY_CONFIG,
      },
      {
        provide: TENANT_HEADER_FALLBACK_CONFIG,
        useValue: {
          allowHeaderFallback: options.allowHeaderFallback === true,
        },
      },
    ];

    const otpChallengeStoreProvider = options.otpChallengeStoreProvider;
    const otpSmsDispatcherProvider = options.otpSmsDispatcherProvider;
    if (
      Boolean(otpChallengeStoreProvider) !== Boolean(otpSmsDispatcherProvider)
    ) {
      throw new Error(
        'Both an OTP challenge store and SMS dispatcher must be configured explicitly.'
      );
    }
    if (otpChallengeStoreProvider && otpSmsDispatcherProvider) {
      providers.push(
        otpChallengeStoreProvider,
        otpSmsDispatcherProvider,
        TimeLockedOtpService
      );
    }

    if (options.dbConnectionProvider) {
      providers.push(options.dbConnectionProvider);
    }
    if (options.audit !== undefined) {
      providers.push({
        provide: COMPLIANCE_AUDIT_OPTIONS,
        useValue: options.audit,
      });
    }

    const tenantDbProviderConfigured =
      options.dbConnectionProvider !== undefined &&
      isTenantDbConnectionProvider(options.dbConnectionProvider);
    const moduleExports = [
      TenantResolverService,
      TenantContextGuard,
      ...COMMON_PROVIDERS,
      TRUSTED_PROXY_CONFIG,
      TENANT_HEADER_FALLBACK_CONFIG,
      ...(otpChallengeStoreProvider && otpSmsDispatcherProvider
        ? [TimeLockedOtpService]
        : []),
      ...(tenantDbProviderConfigured ? [TENANT_DB_CONNECTION] : []),
    ];

    return {
      module: BusinessSecurityModule,
      providers,
      exports: moduleExports,
      global: true,
    };
  }
}

export { TENANT_DB_CONNECTION } from './tenant-context.guard';
