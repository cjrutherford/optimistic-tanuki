import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ValidatedOAuthConfig {
  enabled: boolean;
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
  scopes?: string[];
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  userInfoEndpoint?: string;
}

@Injectable()
export class OAuthConfigValidator implements OnModuleInit {
  private readonly logger = new Logger(OAuthConfigValidator.name);
  private validatedConfigs: Map<string, ValidatedOAuthConfig> = new Map();

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.validateOAuthConfigurations();
  }

  private validateOAuthConfigurations(): void {
    const oauthConfig = this.configService.get('oauth') || {};
    const providers = ['google', 'github', 'microsoft', 'facebook'];

    this.logger.log('Validating OAuth provider configurations...');

    for (const provider of providers) {
      const config = oauthConfig[provider];
      const validatedConfig = this.validateProvider(provider, config);
      this.validatedConfigs.set(provider, validatedConfig);
    }

    const enabledProviders = Array.from(this.validatedConfigs.entries())
      .filter(([_, config]) => config.enabled)
      .map(([name, _]) => name);

    if (enabledProviders.length === 0) {
      this.logger.warn(
        '⚠️  No OAuth providers are configured! OAuth login will not be available.'
      );
      this.logger.warn(
        '    See OAUTH_SETUP.md for configuration instructions.'
      );
    } else {
      this.logger.log(
        `✓ OAuth providers enabled: ${enabledProviders.join(', ')}`
      );
    }
  }

  private validateProvider(
    provider: string,
    config: any
  ): ValidatedOAuthConfig {
    const displayName = this.getProviderDisplayName(provider);

    // If no config exists at all
    if (!config) {
      this.logger.warn(
        `⚠️  ${displayName} OAuth: Not configured (missing configuration)`
      );
      this.logger.warn(
        `    To enable: Set ${provider.toUpperCase()}_CLIENT_ID and other required environment variables`
      );
      return { enabled: false };
    }

    // Check if explicitly disabled
    if (config.enabled === false) {
      this.logger.log(`⊘ ${displayName} OAuth: Explicitly disabled`);
      return { enabled: false };
    }

    // The gateway owns provider credentials and token exchange. Authentication
    // only needs an allowlist for identities received over the internal RPC
    // boundary, so duplicating gateway secrets here would create a second
    // runtime source of truth.
    this.logger.log(`✓ ${displayName} OAuth: Allowed for gateway identities`);

    return {
      enabled: true,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
      scopes: config.scopes,
      authorizationEndpoint: config.authorizationEndpoint,
      tokenEndpoint: config.tokenEndpoint,
      userInfoEndpoint: config.userInfoEndpoint,
    };
  }

  private getProviderDisplayName(provider: string): string {
    const displayNames: Record<string, string> = {
      google: 'Google',
      github: 'GitHub',
      microsoft: 'Microsoft',
      facebook: 'Facebook',
    };
    return displayNames[provider] || provider;
  }

  /**
   * Get the validated configuration for a specific provider
   */
  getProviderConfig(provider: string): ValidatedOAuthConfig | undefined {
    return this.validatedConfigs.get(provider);
  }

  /**
   * Get all enabled providers
   */
  getEnabledProviders(): string[] {
    return Array.from(this.validatedConfigs.entries())
      .filter(([_, config]) => config.enabled)
      .map(([name, _]) => name);
  }

  /**
   * Check if a provider is enabled and properly configured
   */
  isProviderEnabled(provider: string): boolean {
    const config = this.validatedConfigs.get(provider);
    return config?.enabled || false;
  }
}
