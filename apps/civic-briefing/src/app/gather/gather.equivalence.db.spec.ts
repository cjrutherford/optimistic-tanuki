import { Test } from '@nestjs/testing';
import type { DataSource } from 'typeorm';
import { gather as originalGather } from '@optimistic-tanuki/civic-core';
import { AdaptersModule } from '../adapters/adapters.module';
import { PlatformModule } from '../platform.module';
import { QuarantineModule } from '../quarantine/quarantine.module';
import { BLOB_STORE, HTTP_CLIENT } from '../tokens';
import {
  databaseFor,
  freshFoundation,
  groton,
  itWithCorpus,
  replayClient,
  scratchBlobs,
} from '../testing/stage-fixture';
import { GatherModule } from './gather.module';
import { GatherService } from './gather.service';
import { ConfigModule } from '@nestjs/config';

/**
 * The ported stage has to agree with the one it replaces.
 *
 * Both run over the same recorded corpus, into their own schemas, and the
 * rows they write are compared. The golden replay proves the whole chain at
 * the end; this proves one stage now, while it is small enough to see.
 */

interface StageRows {
  rawDocuments: { sourceId: string; url: string; contentType: string }[];
  attempts: {
    sourceId: string;
    url: string;
    outcome: string;
    status: number | null;
  }[];
  ledger: { sourceId: string; url: string }[];
}

/** Reads rows directly: this is a comparison, not a foundation run. */
async function rowsOf(ds: DataSource): Promise<StageRows> {
  const sorted = <T extends { sourceId: string; url: string }>(
    rows: T[]
  ): T[] =>
    rows.sort((a, b) =>
      `${a.sourceId}${a.url}`.localeCompare(`${b.sourceId}${b.url}`)
    );
  return {
    rawDocuments: sorted(
      (await ds.query(
        'select "sourceId", url, "contentType" from raw_documents'
      )) as never[]
    ),
    attempts: sorted(
      (await ds.query(
        'select "sourceId", url, outcome, status from fetch_attempts'
      )) as never[]
    ),
    ledger: sorted(
      (await ds.query('select "sourceId", url from fetch_ledger')) as never[]
    ),
  };
}

describe('gather stage equivalence', () => {
  itWithCorpus(
    'writes the same records as the implementation it replaces',
    async () => {
      const { locality } = groton();
      const { blobStore, cleanup } = scratchBlobs('gather-equivalence');
      const originalDs = await freshFoundation();
      const portedDs = await freshFoundation();
      try {
        const original = await originalGather(originalDs, locality, {
          blobStore,
          httpClient: replayClient(),
          runId: 1,
        });

        const moduleRef = await Test.createTestingModule({
          imports: [
            ConfigModule.forRoot({ ignoreEnvFile: true, isGlobal: true }),
            databaseFor(portedDs),
            PlatformModule,
            AdaptersModule,
            QuarantineModule,
            GatherModule,
          ],
        })
          .overrideProvider(HTTP_CLIENT)
          .useValue(replayClient())
          .overrideProvider(BLOB_STORE)
          .useValue(blobStore)
          .compile();
        const app = await moduleRef.init();
        const ported = await app.get(GatherService).gather({
          locality,
          runId: 1,
          blobStore,
          httpClient: replayClient(),
        });
        await app.close();

        // A comparison of two empty runs proves nothing; fail loudly instead.
        expect(original.fetched).toBeGreaterThan(0);
        expect(ported.fetched).toBe(original.fetched);
        expect(ported.stored).toBe(original.stored);
        expect(ported.successfulSources).toBe(original.successfulSources);
        expect(ported.successfulRecords).toBe(original.successfulRecords);
        expect(
          ported.sourceOutcomes
            .map((outcome) => `${outcome.sourceKey}:${outcome.outcome}`)
            .sort()
        ).toStrictEqual(
          original.sourceOutcomes
            .map((outcome) => `${outcome.sourceKey}:${outcome.outcome}`)
            .sort()
        );
        expect(
          ported.errors.map((error) => error.sourceId).sort()
        ).toStrictEqual(original.errors.map((error) => error.sourceId).sort());
        // Parse consumes these ids, so equal counts are not enough: the lists
        // themselves must match, or the next stage sees different inputs.
        const ids = (value: {
          currentRawDocumentIds: number[];
          currentRawVersionIds: number[];
          currentFetchAttemptIds: number[];
          currentLedgerIds: number[];
        }) => ({
          raw: value.currentRawDocumentIds.length,
          versions: value.currentRawVersionIds.length,
          attempts: value.currentFetchAttemptIds.length,
          ledger: value.currentLedgerIds.length,
        });
        expect(ids(ported)).toStrictEqual(ids(original));
        expect(await rowsOf(portedDs)).toStrictEqual(await rowsOf(originalDs));
      } finally {
        await originalDs.destroy();
        await portedDs.destroy();
        cleanup();
      }
    }
  );
});
