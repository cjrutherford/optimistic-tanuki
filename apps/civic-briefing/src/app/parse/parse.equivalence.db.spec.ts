import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { DataSource } from 'typeorm';
import {
  gather as originalGather,
  parseAll as originalParse,
} from '@optimistic-tanuki/civic-core';
import { AdaptersModule } from '../adapters/adapters.module';
import { PlatformModule } from '../platform.module';
import { QuarantineModule } from '../quarantine/quarantine.module';
import { BLOB_STORE, HTTP_CLIENT } from '../tokens';
import {
  CONTEXT_RANGE,
  databaseFor,
  freshFoundation,
  groton,
  itWithCorpus,
  replayClient,
  scratchBlobs,
} from '../testing/stage-fixture';
import { ParseModule } from './parse.module';
import { ParseService } from './parse.service';

/**
 * Parsing is compared from an identical starting point: the gather runs once
 * into each of two schemas (the replay is deterministic), and each
 * implementation parses its own. Anything that differs afterwards came from
 * the parse stage and nothing else.
 */

interface ItemRow {
  sourceId: string;
  hash: string;
  kind: string;
  title: string;
  scopeSlug: string | null;
  canonicalUrl: string | null;
  accessMode: string | null;
  bodyLength: number;
}

async function itemsOf(ds: DataSource): Promise<ItemRow[]> {
  const rows = (await ds.query(
    'select "sourceId", hash, kind, title, "scopeSlug", "canonicalUrl", "accessMode", length(body) as "bodyLength" from civic_items'
  )) as ItemRow[];
  return rows.sort((a, b) => a.hash.localeCompare(b.hash));
}

describe('parse stage equivalence', () => {
  itWithCorpus(
    'writes the same civic items as the implementation it replaces',
    async () => {
      const { locality, registry } = groton();
      const { blobStore, cleanup } = scratchBlobs('parse-equivalence');
      const originalDs = await freshFoundation();
      const portedDs = await freshFoundation();
      try {
        const gather = async (ds: DataSource) =>
          originalGather(ds, locality, {
            blobStore,
            httpClient: replayClient(),
            runId: 1,
          });
        const gathered = await gather(originalDs);
        await gather(portedDs);
        expect(gathered.currentRawDocumentIds.length).toBeGreaterThan(0);

        const original = await originalParse(originalDs, locality, {
          blobStore,
          httpClient: replayClient(),
          runId: 1,
          registry,
          contextRange: CONTEXT_RANGE,
          successfulSourceOutcomes: gathered.sourceOutcomes,
          currentRawDocumentIds: gathered.currentRawDocumentIds,
        });

        const moduleRef = await Test.createTestingModule({
          imports: [
            ConfigModule.forRoot({ ignoreEnvFile: true, isGlobal: true }),
            databaseFor(portedDs),
            PlatformModule,
            AdaptersModule,
            QuarantineModule,
            ParseModule,
          ],
        })
          .overrideProvider(HTTP_CLIENT)
          .useValue(replayClient())
          .overrideProvider(BLOB_STORE)
          .useValue(blobStore)
          .compile();
        const app = await moduleRef.init();
        const ported = await app.get(ParseService).parse({
          locality,
          registry,
          runId: 1,
          contextRange: CONTEXT_RANGE,
          successfulSourceOutcomes: gathered.sourceOutcomes,
          currentRawDocumentIds: gathered.currentRawDocumentIds,
          blobStore,
          httpClient: replayClient(),
        });
        await app.close();

        expect(original.parsed).toBeGreaterThan(0);
        expect(ported.parsed).toBe(original.parsed);
        expect(ported.inserted).toBe(original.inserted);
        expect(ported.successfulSources).toBe(original.successfulSources);
        expect(ported.successfulRecords).toBe(original.successfulRecords);
        expect(
          ported.errors.map((error) => error.sourceId).sort()
        ).toStrictEqual(original.errors.map((error) => error.sourceId).sort());
        expect(await itemsOf(portedDs)).toStrictEqual(
          await itemsOf(originalDs)
        );
      } finally {
        await originalDs.destroy();
        await portedDs.destroy();
        cleanup();
      }
    }
  );
});
