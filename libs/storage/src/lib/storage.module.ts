import { DynamicModule, Module, Provider, Logger } from '@nestjs/common';
import { LoggerModule } from '@optimistic-tanuki/logger';
import { StorageAdapter } from './storage-adapter.interface';
import { LocalStorageAdapter } from './local-storage';
import { NetworkStorageAdapter } from './network-storage';
import { EnvelopeEncryptionService } from './envelope-encryption.service';
import { TaxDocumentClassifierService } from './tax-document-classifier.service';
import { ZfsStorageService } from './zfs-storage.service';
import {
  resolveS3ServiceOptions,
  S3Service,
  S3ServiceOptions,
} from './s3.service';
import { ConfigService } from '@nestjs/config';

export interface StorageModuleOptions {
  enabledAdapters: ('local' | 'network')[];
  s3Options?: Partial<S3ServiceOptions>;
  localStoragePath?: string;
}

export const STORAGE_ADAPTERS = 'STORAGE_ADAPTERS';

const VAULT_SERVICES: Provider[] = [
  EnvelopeEncryptionService,
  TaxDocumentClassifierService,
  ZfsStorageService,
];

@Module({})
export class StorageModule {
  static register(options: StorageModuleOptions): DynamicModule {
    let adapterProvider: Provider<StorageAdapter>;
    const logger = new Logger('StorageModule');

    logger.log(
      `Registering StorageModule with options: ${JSON.stringify(options)}`
    );

    const firstEnabledAdapter = options.enabledAdapters[0];

    if (!firstEnabledAdapter) {
      logger.error('No storage adapters enabled in configuration.');
      throw new Error('No storage adapters enabled in configuration.');
    }
    const extraProviders: Provider[] = [];

    switch (firstEnabledAdapter) {
      case 'local': {
        if (!options.localStoragePath) {
          logger.error(
            'Local storage adapter requires localStoragePath option.'
          );
          throw new Error(
            'Local storage adapter requires localStoragePath option.'
          );
        }
        const sp = options.localStoragePath || './storage';
        adapterProvider = {
          provide: STORAGE_ADAPTERS,
          useFactory: (
            logger: Logger,
            encryption: EnvelopeEncryptionService,
            classifier: TaxDocumentClassifierService,
            zfs: ZfsStorageService
          ) => new LocalStorageAdapter(logger, sp, encryption, classifier, zfs),
          inject: [
            Logger,
            EnvelopeEncryptionService,
            TaxDocumentClassifierService,
            ZfsStorageService,
          ],
        };
        break;
      }
      case 'network': {
        const s3Options = resolveS3ServiceOptions(process.env, {
          ...(options.s3Options ?? {}),
        });
        extraProviders.push({
          provide: S3Service,
          useFactory: (logger: Logger) => new S3Service(logger, s3Options),
          inject: [Logger],
        });
        adapterProvider = {
          provide: STORAGE_ADAPTERS,
          useFactory: (
            logger: Logger,
            s3Service: S3Service,
            encryption: EnvelopeEncryptionService,
            classifier: TaxDocumentClassifierService
          ) =>
            new NetworkStorageAdapter(
              logger,
              s3Service,
              encryption,
              classifier
            ),
          inject: [
            Logger,
            S3Service,
            EnvelopeEncryptionService,
            TaxDocumentClassifierService,
          ],
        };
        break;
      }
      default:
        logger.error(
          `Unsupported storage strategy in enabledAdapters: ${firstEnabledAdapter}`
        );
        throw new Error(
          `Unsupported storage strategy in enabledAdapters: ${firstEnabledAdapter}`
        );
    }

    return {
      module: StorageModule,
      imports: [LoggerModule],
      providers: [adapterProvider, ...VAULT_SERVICES, ...extraProviders],
      exports: [
        STORAGE_ADAPTERS,
        EnvelopeEncryptionService,
        TaxDocumentClassifierService,
        ZfsStorageService,
        ...extraProviders,
      ],
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
        ...VAULT_SERVICES,
        {
          provide: 'STORAGE_MODULE_OPTIONS',
          useFactory: options.useFactory,
          inject: options.inject || [ConfigService],
        },
        {
          provide: STORAGE_ADAPTERS,
          useFactory: (
            logger: Logger,
            configService: ConfigService,
            encryption: EnvelopeEncryptionService,
            classifier: TaxDocumentClassifierService,
            zfs: ZfsStorageService
          ) => {
            const moduleOptions = configService.get<StorageModuleOptions>(
              'storage-module-options'
            );
            logger.log(
              `Configuring storage adapter with options: ${JSON.stringify(
                moduleOptions
              )}`
            );
            const firstEnabledAdapter = moduleOptions?.enabledAdapters?.[0];

            if (!firstEnabledAdapter) {
              logger.error('No storage adapters enabled in configuration.');
              throw new Error('No storage adapters enabled in configuration.');
            }

            switch (firstEnabledAdapter) {
              case 'local': {
                const localStoragePath =
                  moduleOptions?.localStoragePath || './storage';
                logger.log(
                  `Setting up LocalStorageAdapter with path: ${localStoragePath}`
                );
                return new LocalStorageAdapter(
                  logger,
                  localStoragePath,
                  encryption,
                  classifier,
                  zfs
                );
              }
              case 'network': {
                const s3Options = resolveS3ServiceOptions(process.env, {
                  ...(moduleOptions?.s3Options ?? {}),
                });
                logger.log(
                  `Setting up NetworkStorageAdapter with S3 endpoint: ${s3Options.endpoint}`
                );
                const s3Service = new S3Service(logger, s3Options);
                return new NetworkStorageAdapter(
                  logger,
                  s3Service,
                  encryption,
                  classifier
                );
              }
              default:
                logger.error(
                  `Unsupported storage strategy: ${firstEnabledAdapter}`
                );
                throw new Error(
                  `Unsupported storage strategy: ${firstEnabledAdapter}`
                );
            }
          },
          inject: [
            Logger,
            ConfigService,
            EnvelopeEncryptionService,
            TaxDocumentClassifierService,
            ZfsStorageService,
          ],
        },
      ],
      exports: [
        STORAGE_ADAPTERS,
        EnvelopeEncryptionService,
        TaxDocumentClassifierService,
        ZfsStorageService,
      ],
    };
  }
}
