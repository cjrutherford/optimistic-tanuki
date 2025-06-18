import { DynamicModule, Module, Provider, Logger } from '@nestjs/common'; // Import Logger
import { LoggerModule } from '@optimistic-tanuki/logger'; // Import LoggerModule
import { StorageAdapter } from './storage-adapter.interface';
import { LocalStorageAdapter } from './local-storage';
import { NetworkStorageAdapter } from './network-storage';
import { defaultS3ServiceOptions, S3Service, S3ServiceOptions } from './s3.service';

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
                 throw new Error('Local storage adapter requires localStoragePath option.');
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
                throw new Error('Network adapter requires S3 options (or other network config)');
            }
            const s3Options = {...defaultS3ServiceOptions, ...options.s3Options};
            // Provide the S3Service
            extraProviders.push({
                provide: S3Service,
                useFactory: (logger: Logger) => new S3Service(logger, s3Options), // Inject options into S3Service
                inject: [Logger],
            });
            // Provide the NetworkStorageAdapter, injecting the S3Service
            adapterProvider = {
                provide: STORAGE_ADAPTERS,
                useFactory: (logger, s3Service) => new NetworkStorageAdapter(logger, s3Service),
                inject: [Logger, S3Service], // Inject Logger and S3Service
            };
            break;
        }
        default:
            throw new Error(`Unsupported storage strategy in enabledAdapters: ${firstEnabledAdapter}`);
    }

    return {
      module: StorageModule,
      imports: [LoggerModule],
      providers: [adapterProvider], // Provide only the selected adapter under the token
      exports: [STORAGE_ADAPTERS], // Export the token
    };
  }
}