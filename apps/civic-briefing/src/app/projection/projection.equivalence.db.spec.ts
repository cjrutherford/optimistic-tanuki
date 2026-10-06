import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { DataSource } from 'typeorm';
import {
  extractAgenda as originalExtract,
  gather as originalGather,
  parseAll as originalParse,
  projectItems as originalProject,
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
import { ProjectionModule } from './projection.module';
import { ProjectionService } from './projection.service';

/**
 * Projection decides what an edition may cite and which story each piece of
 * evidence belongs to, so the comparison covers both: the edition rows and
 * the canonical stories and their links.
 */

async function projectionOf(
  ds: DataSource
): Promise<Record<'editionItems' | 'stories' | 'links', unknown[]>> {
  return {
    editionItems: await ds.query(
      'select "localitySlug", "civicItemId", decision, reason, "ruleVersion" from edition_items order by "civicItemId"'
    ),
    stories: await ds.query(
      'select "scopeSlug", "storyKey", strategy, title, status from canonical_stories order by "storyKey"'
    ),
    links: await ds.query(
      'select "canonicalStoryId", "civicItemId", "agendaItemId", "evidenceDate", "matchReason", "matchScore" from canonical_story_items order by "canonicalStoryId", "civicItemId", "agendaItemId"'
    ),
  };
}

describe('projection equivalence', () => {
  itWithCorpus(
    'includes the same items and builds the same stories as the implementation it replaces',
    async () => {
      const { locality, registry, timezone } = groton();
      const { blobStore, cleanup } = scratchBlobs('projection-equivalence');
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
          await originalExtract(
            ds,
            locality,
            undefined,
            CONTEXT_RANGE,
            timezone,
            1
          );
        };
        await seed(originalDs);
        await seed(portedDs);

        const before = await originalProject(originalDs, TOWN, registry, 0, {
          contextRange: CONTEXT_RANGE,
        });

        const moduleRef = await Test.createTestingModule({
          imports: [
            ConfigModule.forRoot({ ignoreEnvFile: true, isGlobal: true }),
            databaseFor(portedDs),
            ProjectionModule,
          ],
        }).compile();
        const app = await moduleRef.init();
        const after = await app.get(ProjectionService).project({
          targetSlug: TOWN,
          registry,
          contextRange: CONTEXT_RANGE,
        });
        await app.close();

        expect(before.included.length).toBeGreaterThan(0);
        expect(after.included.length).toBe(before.included.length);
        expect(
          after.diagnostics
            .map((d) => `${d.civicItemId}:${d.decision}:${d.evidence.reason}`)
            .sort()
        ).toStrictEqual(
          before.diagnostics
            .map((d) => `${d.civicItemId}:${d.decision}:${d.evidence.reason}`)
            .sort()
        );
        const [portedRows, originalRows] = [
          await projectionOf(portedDs),
          await projectionOf(originalDs),
        ];
        expect(portedRows.editionItems).toStrictEqual(
          originalRows.editionItems
        );
        expect(portedRows.stories).toStrictEqual(originalRows.stories);
        expect(portedRows.links).toStrictEqual(originalRows.links);
      } finally {
        await originalDs.destroy();
        await portedDs.destroy();
        cleanup();
      }
    }
  );
});
