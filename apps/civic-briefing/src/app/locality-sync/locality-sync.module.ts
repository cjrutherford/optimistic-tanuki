import { Module, type Provider } from '@nestjs/common';
import { ClientProxyFactory, Transport } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  LocalitySchema,
  type LocalityRow,
} from '@optimistic-tanuki/civic-core';
import type { Repository } from 'typeorm';
import { localityDefaultsFromEnv } from './community-to-locality';
import { LocalitySyncService } from './locality-sync.service';
import {
  DEFAULT_LOCALITY_APP_SCOPE,
  SocialLocalityClient,
  socialEndpoint,
} from './social-locality.client';

const providers: Provider[] = [
  {
    provide: SocialLocalityClient,
    useFactory: () =>
      new SocialLocalityClient(
        ClientProxyFactory.create({
          transport: Transport.TCP,
          options: socialEndpoint(),
        }),
        process.env['LOCALITY_SYNC_APP_SCOPE'] || DEFAULT_LOCALITY_APP_SCOPE
      ),
  },
  {
    provide: LocalitySyncService,
    useFactory: (
      client: SocialLocalityClient,
      localities: Repository<LocalityRow>
    ) => new LocalitySyncService(client, localities, localityDefaultsFromEnv()),
    inject: [SocialLocalityClient, getRepositoryToken(LocalitySchema)],
  },
];

/** Not imported by the app yet; the schedule wires the sync in (S5). */
@Module({ providers, exports: [LocalitySyncService] })
export class LocalitySyncModule {}
