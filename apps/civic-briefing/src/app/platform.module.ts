import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createLocalBlobStore,
  OutboundPolicy,
} from '@optimistic-tanuki/civic-core';
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
    {
      provide: BLOB_STORE,
      useFactory: (config: ConfigService) =>
        createLocalBlobStore(config.getOrThrow<string>('blobDirectory')),
      inject: [ConfigService],
    },
  ],
  exports: [HTTP_CLIENT, BLOB_STORE],
})
export class PlatformModule {}
