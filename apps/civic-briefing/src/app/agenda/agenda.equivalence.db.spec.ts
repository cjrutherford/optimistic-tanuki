import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { DataSource } from 'typeorm';
import {
  extractAgenda as originalExtract,
  gather as originalGather,
  parseAll as originalParse,
} from '@optimistic-tanuki/civic-core';
import { AdaptersModule } from '../adapters/adapters.module';
import { PlatformModule } from '../platform.module';
import { QuarantineModule } from '../quarantine/quarantine.module';
import { BLOB_STORE } from '../tokens';
import {
  CONTEXT_RANGE,
  databaseFor,
  freshFoundation,
  groton,
  itWithCorpus,
  replayClient,
  scratchBlobs,
} from '../testing/stage-fixture';
import { AgendaModule } from './agenda.module';
import { AgendaService } from './agenda.service';

/**
 * Agenda extraction is compared from an identical set of parsed documents:
 * gather and parse run into each of two schemas, and each implementation
 * extracts into its own.
 */

interface AgendaRow {
  itemId: number;
  section: string;
  ordinal: number;
  heading: string;
  meetingDate: string | null;
  topicKey: string;
  procedural: boolean;
}

async function agendaRowsOf(ds: DataSource): Promise<AgendaRow[]> {
  const rows = (await ds.query(
    'select "itemId", section, ordinal, heading, "meetingDate", "topicKey", procedural from agenda_items'
  )) as AgendaRow[];
  return rows.sort(
    (a, b) =>
      a.itemId - b.itemId ||
      a.section.localeCompare(b.section) ||
      a.ordinal - b.ordinal
  );
}

describe('agenda extraction equivalence', () => {
  itWithCorpus(
    'writes the same agenda rows as the implementation it replaces',
    async () => {
      const { locality, registry, timezone } = groton();
      const { blobStore, cleanup } = scratchBlobs('agenda-equivalence');
      const originalDs = await freshFoundation();
      const portedDs = await freshFoundation();
      try {
        const seed = async (ds: DataSource) => {
          const gathered = await originalGather(ds, locality, {
            blobStore,
            httpClient: replayClient(),
            runId: 1,
          });
          await originalParse(ds, locality, {
            blobStore,
            httpClient: replayClient(),
            runId: 1,
            registry,
            successfulSourceOutcomes: gathered.sourceOutcomes,
            currentRawDocumentIds: gathered.currentRawDocumentIds,
          });
        };
        await seed(originalDs);
        await seed(portedDs);
        const meetings = (await originalDs.query(
          "select count(*) as c from civic_items where kind = 'meeting'"
        )) as { c: string }[];
        const meetingCount = Number(meetings[0]?.c ?? 0);
        expect(meetingCount).toBeGreaterThan(0);

        // No fixup: a model would make the comparison non-deterministic, and
        // the rules are what this stage is being judged on.
        const original = await originalExtract(
          originalDs,
          locality,
          undefined,
          CONTEXT_RANGE,
          timezone,
          1
        );

        const moduleRef = await Test.createTestingModule({
          imports: [
            ConfigModule.forRoot({ ignoreEnvFile: true, isGlobal: true }),
            databaseFor(portedDs),
            PlatformModule,
            AdaptersModule,
            QuarantineModule,
            AgendaModule,
          ],
        })
          .overrideProvider(BLOB_STORE)
          .useValue(blobStore)
          .compile();
        const app = await moduleRef.init();
        const ported = await app.get(AgendaService).extract({
          locality,
          contextRange: CONTEXT_RANGE,
          timezone,
          runId: 1,
        });
        await app.close();

        expect(original.items).toBeGreaterThan(0);
        expect(ported.items).toBe(original.items);
        expect(ported.threads).toBe(original.threads);
        expect(ported.fixedByLlm).toBe(original.fixedByLlm);
        expect(ported.fixupFailures).toBe(original.fixupFailures);
        expect(await agendaRowsOf(portedDs)).toStrictEqual(
          await agendaRowsOf(originalDs)
        );
      } finally {
        await originalDs.destroy();
        await portedDs.destroy();
        cleanup();
      }
    }
  );
});
