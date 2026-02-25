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

    const firstEnabledAdapter = options.enabledAdapters[0];

    if (!firstEnabledAdapter) {
      throw new Error('No storage adapters enabled in configuration.');
    }
    const extraProviders: Provider[] = [];

    switch (firstEnabledAdapter) {
      case 'local': {
        if (!options.localStoragePath) {
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
              'STORAGE_MODULE_OPTIONS'
            );
            const firstEnabledAdapter = moduleOptions?.enabledAdapters?.[0];

            if (!firstEnabledAdapter) {
              throw new Error('No storage adapters enabled in configuration.');
            }

            switch (firstEnabledAdapter) {
              case 'local': {
                const localStoragePath =
                  moduleOptions?.localStoragePath || './storage';
                return new LocalStorageAdapter(logger, localStoragePath);
              }
              case 'network': {
                const s3Options =
                  moduleOptions?.s3Options || defaultS3ServiceOptions;
                const s3Service = new S3Service(logger, s3Options);
                return new NetworkStorageAdapter(logger, s3Service);
              }
              default:
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
