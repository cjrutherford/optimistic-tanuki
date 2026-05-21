import { DynamicModule, Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailPluginRegistry } from './email-plugin-registry';
import { EmailProvider } from './interfaces';

export interface EmailModuleOptions {
  /** Email providers to register on startup */
  providers?: EmailProvider[];
  /** Name of the provider to set as active (defaults to first registered) */
  activeProvider?: string;
}

export const EMAIL_MODULE_OPTIONS = 'EMAIL_MODULE_OPTIONS';

@Module({})
export class EmailModule {
  /**
   * Configure the email module with static options.
   *
   * @example
   * EmailModule.forRoot({
   *   providers: [new SmtpEmailProvider({ host: 'localhost', port: 1025 })],
   * })
   */
  static forRoot(options?: EmailModuleOptions): DynamicModule {
    return {
      module: EmailModule,
      global: true,
      providers: [
        {
          provide: EMAIL_MODULE_OPTIONS,
          useValue: options || {},
        },
        EmailPluginRegistry,
        {
          provide: EmailService,
          useFactory: (registry: EmailPluginRegistry) => {
            const opts = options || {};
            if (opts.providers) {
              for (const provider of opts.providers) {
                registry.register(provider);
              }
            }
            if (opts.activeProvider) {
              registry.setActiveProvider(opts.activeProvider);
            }
            return new EmailService(registry);
          },
          inject: [EmailPluginRegistry],
        },
      ],
      exports: [EmailService, EmailPluginRegistry],
    };
  }

  /**
   * Configure the email module with async options.
   * Useful when provider configuration depends on ConfigService.
   *
   * @example
   * EmailModule.forRootAsync({
   *   inject: [ConfigService],
   *   useFactory: (config: ConfigService) => ({
   *     providers: [new SmtpEmailProvider({
   *       host: config.get('SMTP_HOST'),
   *       port: config.get('SMTP_PORT'),
   *     })],
   *   }),
   * })
   */
  static forRootAsync(asyncOptions: {
    inject?: any[];
    useFactory: (...args: any[]) => EmailModuleOptions | Promise<EmailModuleOptions>;
  }): DynamicModule {
    return {
      module: EmailModule,
      global: true,
      providers: [
        {
          provide: EMAIL_MODULE_OPTIONS,
          useFactory: asyncOptions.useFactory,
          inject: asyncOptions.inject || [],
        },
        EmailPluginRegistry,
        {
          provide: EmailService,
          useFactory: async (
            registry: EmailPluginRegistry,
            opts: EmailModuleOptions
          ) => {
            if (opts.providers) {
              for (const provider of opts.providers) {
                registry.register(provider);
              }
            }
            if (opts.activeProvider) {
              registry.setActiveProvider(opts.activeProvider);
            }
            return new EmailService(registry);
          },
          inject: [EmailPluginRegistry, EMAIL_MODULE_OPTIONS],
        },
      ],
      exports: [EmailService, EmailPluginRegistry],
    };
  }
}
