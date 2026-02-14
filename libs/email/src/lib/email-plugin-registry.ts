import { Injectable, Logger } from '@nestjs/common';
import { EmailProvider } from './interfaces';

/**
 * Registry that manages email provider plugins.
 * Supports registering multiple providers and selecting the active one.
 */
@Injectable()
export class EmailPluginRegistry {
  private readonly providers = new Map<string, EmailProvider>();
  private activeProviderName: string | null = null;
  private readonly logger = new Logger(EmailPluginRegistry.name);

  /**
   * Register a new email provider plugin.
   * The first registered provider becomes the active one by default.
   */
  register(provider: EmailProvider): void {
    this.logger.log(`Registering email provider: ${provider.name}`);
    this.providers.set(provider.name, provider);
    if (!this.activeProviderName) {
      this.activeProviderName = provider.name;
      this.logger.log(`Active email provider set to: ${provider.name}`);
    }
  }

  /**
   * Set the active email provider by name.
   */
  setActiveProvider(name: string): void {
    if (!this.providers.has(name)) {
      throw new Error(`Email provider "${name}" is not registered`);
    }
    this.activeProviderName = name;
    this.logger.log(`Active email provider changed to: ${name}`);
  }

  /**
   * Get the currently active email provider.
   */
  getActiveProvider(): EmailProvider | null {
    if (!this.activeProviderName) return null;
    return this.providers.get(this.activeProviderName) ?? null;
  }

  /**
   * Get a specific provider by name.
   */
  getProvider(name: string): EmailProvider | null {
    return this.providers.get(name) ?? null;
  }

  /**
   * Get all registered provider names.
   */
  getRegisteredProviders(): string[] {
    return Array.from(this.providers.keys());
  }
}
