import { DynamicModule, Module, Provider, Logger } from '@nestjs/common'; // Import Logger
import { StorageAdapter } from './storage-adapter.interface';
import { LocalStorageAdapter } from './local-storage';
import { NetworkStorageAdapter } from './network-storage';
import { S3Service, S3ServiceOptions } from './s3.service';

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
        case 'local':
            if (!options.localStoragePath) {
                 throw new Error('Local storage adapter requires localStoragePath option.');
            }
            adapterProvider = {
                provide: STORAGE_ADAPTERS,
                useFactory: (logger) => new LocalStorageAdapter(logger, options.localStoragePath!),
                inject: [Logger],
            };
            break;
        case 'network':
            if (!options.s3Options) {
                throw new Error('Network adapter requires S3 options (or other network config)');
            }
            // Provide the S3Service
            extraProviders.push({
                provide: S3Service,
                useFactory: (logger) => new S3Service(logger, options.s3Options!), // Inject options into S3Service
                inject: [Logger],
            });
            // Provide the NetworkStorageAdapter, injecting the S3Service
            adapterProvider = {
                provide: STORAGE_ADAPTERS,
                useFactory: (logger, s3Service) => new NetworkStorageAdapter(logger, s3Service),
                inject: [Logger, S3Service], // Inject Logger and S3Service
            };
            break;
        default:
            throw new Error(`Unsupported storage strategy in enabledAdapters: ${firstEnabledAdapter}`);
    }

    return {
      module: StorageModule,
      providers: [adapterProvider], // Provide only the selected adapter under the token
      exports: [STORAGE_ADAPTERS], // Export the token
    };
  }
}