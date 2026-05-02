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

    // Validate required fields
    const errors: string[] = [];

    if (!config.clientId || config.clientId.trim() === '') {
      errors.push('clientId is missing');
    } else if (config.clientId.startsWith('${')) {
      errors.push(
        'clientId contains unresolved placeholder (environment variable not set)'
      );
    }

    if (!config.clientSecret || config.clientSecret.trim() === '') {
      errors.push('clientSecret is missing');
    } else if (config.clientSecret.startsWith('${')) {
      errors.push(
        'clientSecret contains unresolved placeholder (environment variable not set)'
      );
    }

    if (!config.redirectUri || config.redirectUri.trim() === '') {
      errors.push('redirectUri is missing');
    } else if (config.redirectUri.startsWith('${')) {
      errors.push(
        'redirectUri contains unresolved placeholder (environment variable not set)'
      );
    }

    if (!config.authorizationEndpoint) {
      errors.push('authorizationEndpoint is missing');
    }

    if (!config.tokenEndpoint) {
      errors.push('tokenEndpoint is missing');
    }

    if (!config.userInfoEndpoint) {
      errors.push('userInfoEndpoint is missing');
    }

    if (!config.scopes || config.scopes.length === 0) {
      errors.push('scopes are missing');
    }

    // If there are validation errors, disable the provider and log warnings
    if (errors.length > 0) {
      this.logger.warn(
        `⚠️  ${displayName} OAuth: Disabled due to configuration errors:`
      );
      errors.forEach((error) => {
        this.logger.warn(`    - ${error}`);
      });
      this.logger.warn(
        `    To enable: Configure the missing values in your environment variables`
      );
      this.logger.warn(
        `    See OAUTH_SETUP.md for detailed setup instructions`
      );

      return {
        enabled: false,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        redirectUri: config.redirectUri,
        scopes: config.scopes,
        authorizationEndpoint: config.authorizationEndpoint,
        tokenEndpoint: config.tokenEndpoint,
        userInfoEndpoint: config.userInfoEndpoint,
      };
    }

    // Provider is properly configured
    this.logger.log(`✓ ${displayName} OAuth: Properly configured`);

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
