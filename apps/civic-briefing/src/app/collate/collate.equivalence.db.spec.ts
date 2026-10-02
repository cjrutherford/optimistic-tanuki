import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  collate as originalCollate,
  extractAgenda as originalExtract,
  gather as originalGather,
  parseAll as originalParse,
  projectItems as originalProject,
  type Cluster,
} from '@optimistic-tanuki/civic-core';
import {
  CONTEXT_RANGE,
  databaseFor,
  freshFoundation,
  groton,
  itWithCorpus,
  replayClient,
  scratchBlobs,
  TOWN,
} from '../testing/stage-fixture';
import { CollateModule } from './collate.module';
import { CollateService } from './collate.service';

/**
 * Collation only reads, so both implementations run against the same
 * database and their clusters are compared directly.
 */

const shape = (clusters: Cluster[]): string[] =>
  clusters.map(
    (cluster) =>
      `${cluster.kind}|${cluster.topic}|${cluster.items
        .map((item) => item.id)
        .join(',')}`
  );

describe('collate equivalence', () => {
  itWithCorpus(
    'builds the same clusters as the implementation it replaces',
    async () => {
      const { locality, registry, timezone } = groton();
      const { blobStore, cleanup } = scratchBlobs('collate-equivalence');
      const ds = await freshFoundation();
      try {
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
        await originalExtract(
          ds,
          locality,
          undefined,
          CONTEXT_RANGE,
          timezone,
          1
        );
        await originalProject(ds, TOWN, registry, 0, {
          contextRange: CONTEXT_RANGE,
        });

        const ruleVersion = registry.ruleVersion(TOWN);
        const before = await originalCollate(
          ds,
          TOWN,
          CONTEXT_RANGE.start,
          undefined,
          ruleVersion,
          timezone,
          undefined,
          CONTEXT_RANGE.end
        );

        const moduleRef = await Test.createTestingModule({
          imports: [
            ConfigModule.forRoot({ ignoreEnvFile: true, isGlobal: true }),
            databaseFor(ds),
            CollateModule,
          ],
        }).compile();
        const app = await moduleRef.init();
        const after = await app.get(CollateService).collate({
          localitySlug: TOWN,
          ruleVersion,
          since: CONTEXT_RANGE.start,
          contextEnd: CONTEXT_RANGE.end,
          timezone,
        });
        await app.close();

        expect(before.length).toBeGreaterThan(0);
        expect(shape(after)).toStrictEqual(shape(before));
      } finally {
        await ds.destroy();
        cleanup();
      }
    }
  );
});
