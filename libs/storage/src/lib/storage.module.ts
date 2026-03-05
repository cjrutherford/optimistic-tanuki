import { DynamicModule, Module, Provider, Logger } from '@nestjs/common';
import { LoggerModule } from '@optimistic-tanuki/logger';
import { StorageAdapter } from './storage-adapter.interface';
import { LocalStorageAdapter } from './local-storage';
import { NetworkStorageAdapter } from './network-storage';
import {
  defaultS3ServiceOptions,
  S3Service,
  S3ServiceOptions,
} from './s3.service';
import { ConfigService } from '@nestjs/config';

export interface StorageModuleOptions {
  enabledAdapters: ('local' | 'network')[];
  s3Options?: S3ServiceOptions;
  localStoragePath?: string;
}

export const STORAGE_ADAPTERS = 'STORAGE_ADAPTERS';

@Module({})
export class StorageModule {
  static register(options: StorageModuleOptions): DynamicModule {
    let adapterProvider: Provider<StorageAdapter>;
    const logger = new Logger('StorageModule');

    logger.log(`Registering StorageModule with options: ${JSON.stringify(options)}`);

    const firstEnabledAdapter = options.enabledAdapters[0];

    if (!firstEnabledAdapter) {
      logger.error('No storage adapters enabled in configuration.');
      throw new Error('No storage adapters enabled in configuration.');
    }
    const extraProviders: Provider[] = [];

    switch (firstEnabledAdapter) {
      case 'local': {
        if (!options.localStoragePath) {
          logger.error('Local storage adapter requires localStoragePath option.');
          throw new Error(
            'Local storage adapter requires localStoragePath option.'
          );
        }
        const sp = options.localStoragePath || './storage';
        adapterProvider = {
          provide: STORAGE_ADAPTERS,
          useFactory: (logger) => new LocalStorageAdapter(logger, sp),
          inject: [Logger],
        };
        break;
      }
      case 'network': {
        if (!options.s3Options) {
          logger.error('Network adapter requires S3 options (or other network config).');
          throw new Error(
            'Network adapter requires S3 options (or other network config)'
          );
        }
        const s3Options = { ...defaultS3ServiceOptions, ...options.s3Options };
        extraProviders.push({
          provide: S3Service,
          useFactory: (logger: Logger) => new S3Service(logger, s3Options),
          inject: [Logger],
        });
        adapterProvider = {
          provide: STORAGE_ADAPTERS,
          useFactory: (logger, s3Service) =>
            new NetworkStorageAdapter(logger, s3Service),
          inject: [Logger, S3Service],
        };
        break;
      }
      default:
        logger.error(`Unsupported storage strategy in enabledAdapters: ${firstEnabledAdapter}`);
        throw new Error(
          `Unsupported storage strategy in enabledAdapters: ${firstEnabledAdapter}`
        );
    }

    return {
      module: StorageModule,
      imports: [LoggerModule],
      providers: [adapterProvider, ...extraProviders],
      exports: [STORAGE_ADAPTERS, ...extraProviders],
    };
  }

  static registerAsync(options: {
    useFactory: (configService: ConfigService) => StorageModuleOptions;
    inject?: any[];
  }): DynamicModule {
    return {
      module: StorageModule,
      imports: [LoggerModule],
      providers: [
        {
          provide: 'STORAGE_MODULE_OPTIONS',
          useFactory: options.useFactory,
          inject: options.inject || [ConfigService],
        },
        {
          provide: STORAGE_ADAPTERS,
          useFactory: (logger: Logger, configService: ConfigService) => {
            const moduleOptions = configService.get<StorageModuleOptions>(
              'storage-module-options'
            );
            logger.log(`Configuring storage adapter with options: ${JSON.stringify(moduleOptions)}`);
            const firstEnabledAdapter = moduleOptions?.enabledAdapters?.[0];

            if (!firstEnabledAdapter) {
              logger.error('No storage adapters enabled in configuration.');
              throw new Error('No storage adapters enabled in configuration.');
            }

            switch (firstEnabledAdapter) {
              case 'local': {
                const localStoragePath =
                  moduleOptions?.localStoragePath || './storage';
                logger.log(`Setting up LocalStorageAdapter with path: ${localStoragePath}`);
                return new LocalStorageAdapter(logger, localStoragePath);
              }
              case 'network': {
                const s3Options =
                  moduleOptions?.s3Options || defaultS3ServiceOptions;
                logger.log(`Setting up NetworkStorageAdapter with S3 endpoint: ${s3Options.endpoint}`);
                const s3Service = new S3Service(logger, s3Options);
                return new NetworkStorageAdapter(logger, s3Service);
              }
              default:
                logger.error(`Unsupported storage strategy: ${firstEnabledAdapter}`);
                throw new Error(
                  `Unsupported storage strategy: ${firstEnabledAdapter}`
                );
            }
          },
          inject: [Logger, ConfigService],
        },
      ],
      exports: [STORAGE_ADAPTERS],
    };
  }
}
