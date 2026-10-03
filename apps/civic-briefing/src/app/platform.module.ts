import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createLocalBlobStore,
  createScanningBlobStore,
  OutboundPolicy,
} from '@optimistic-tanuki/civic-core';
import { VirusScanService } from '@optimistic-tanuki/storage';
import { BLOB_STORE, HTTP_CLIENT } from './tokens';

/**
 * Collaborators every stage needs and no stage should construct: the outbound
 * HTTP policy and the blob store. Global because they are infrastructure, and
 * replaceable because a replay run injects a recorded client instead.
 */
@Global()
@Module({
  providers: [
    { provide: HTTP_CLIENT, useFactory: () => new OutboundPolicy() },
    VirusScanService,
    {
      // Every fetched document is virus-scanned before it is stored (D22).
      // The platform scanner fails closed: without CLAMAV_HOST, or with the
      // daemon down, downloads fail (retryably) rather than pass unscanned.
      provide: BLOB_STORE,
      useFactory: (config: ConfigService, scanner: VirusScanService) =>
        createScanningBlobStore(
          createLocalBlobStore(config.getOrThrow<string>('blobDirectory')),
          {
            scan: async (content, name) => {
              const result = await scanner.scanFile(Buffer.from(content), name);
              return {
                clean: result.isClean,
                threats: result.threats ?? [],
                scanner: result.scanner,
              };
            },
          }
        ),
      inject: [ConfigService, VirusScanService],
    },
  ],
  exports: [HTTP_CLIENT, BLOB_STORE],
})
export class PlatformModule {}
