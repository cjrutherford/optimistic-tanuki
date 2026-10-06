import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  createFoundationDataSource,
  appendCanonicalStoryRevision,
  createPublicationReceipt,
} from '../../src/store.js';
import {
  CivicItemSchema,
  CanonicalStorySchema,
  CanonicalStoryItemSchema,
  CanonicalStoryRevisionSchema,
  StoryRevisionCitationSchema,
  FoundationSourceSchema,
  LlmGenerationSchema,
  PipelineRunSchema,
} from '../../src/schema.js';

import { createTestSchema } from './helpers/postgres.js';
const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);
const SHA_C = 'c'.repeat(64);

describe('immutable canonical story revisions', () => {
  it('rejects a duplicate legacy parent-only link instead of relying on nullable UNIQUE semantics', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'civic-parent-link-'));
    const ds = await createFoundationDataSource((await createTestSchema()).url);
    try {
      await ds.getRepository(FoundationSourceSchema).save({
        id: 'source-a',
        sourceKey: 'source-a',
        ownerSlug: 'town-a',
        coverage: 'mentions',
        adapter: 'test',
        name: 'Source A',
        url: 'https://example.test',
        kind: 'news',
        enabled: true,
      });
      const story = await ds.getRepository(CanonicalStorySchema).save({
        scopeSlug: 'town-a',
        scopeKind: 'town',
        storyKey: 'parent-link',
        strategy: 'fallback',
        title: 'Parent link',
        status: null,
        createdAt: '2026-09-13T00:00:00Z',
        updatedAt: '2026-09-13T00:00:00Z',
      });
      const item = await ds.getRepository(CivicItemSchema).save({
        sourceId: 'source-a',
        localitySlug: 'town-a',
        scopeSlug: 'town-a',
        scopeKind: 'town',
        kind: 'news',
        title: 'Parent item',
        body: 'Parent item body',
        hash: `parent-link-${Date.now()}`,
        createdAt: '2026-09-13T00:00:00Z',
        geographyDecision: 'include',
      });
      const linkRepo = ds.getRepository(CanonicalStoryItemSchema);
      await linkRepo.save({
        canonicalStoryId: story.id!,
        civicItemId: item.id!,
        agendaItemId: null,
        createdAt: '2026-09-13T00:00:00Z',
      });
      await expect(
        (() =>
          linkRepo.save({
            canonicalStoryId: story.id!,
            civicItemId: item.id!,
            agendaItemId: null,
            createdAt: '2026-09-13T00:00:01Z',
          }))()
      ).rejects.toThrow(/unique|constraint/i);
    } finally {
      await ds.destroy();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('accepts only a trusted publisher receipt shape and does not inspect the filesystem', () => {
    const receipt = createPublicationReceipt({
      path: '/not-yet-published/story.md',
      sha256: 'A'.repeat(64),
      token: 'publisher-token',
    });
    expect(receipt).toStrictEqual({
      path: '/not-yet-published/story.md',
      sha256: 'a'.repeat(64),
      token: 'publisher-token',
    });
    expect(() =>
      createPublicationReceipt({
        path: '',
        sha256: 'a'.repeat(64),
        token: 'publisher-token',
      })
    ).toThrow(/receipt|path/i);
    expect(() =>
      createPublicationReceipt({
        path: '/story.md',
        sha256: 'not-a-sha',
        token: 'publisher-token',
      })
    ).toThrow(/receipt|sha/i);
  });

  it('advances only after citations and leaves the prior pointer on a failed artifact', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'civic-story-'));
    const ds = await createFoundationDataSource((await createTestSchema()).url);
    try {
      await ds.getRepository(FoundationSourceSchema).save({
        id: 'source-a',
        sourceKey: 'source-a',
        ownerSlug: 'town-a',
        coverage: 'mentions',
        adapter: 'test',
        name: 'Source A',
        url: 'https://example.test',
        kind: 'news',
        enabled: true,
      });
      const run = await ds.getRepository(PipelineRunSchema).save({
        scopeSlug: 'town-a',
        localitySlug: 'town-a',
        cadence: 'daily',
        startedAt: '2026-09-13T00:00:00Z',
        status: 'running',
        ruleVersion: 'v1',
        counts: '{}',
        coverageGaps: '[]',
        coverageRanges: '{}',
      });
      const item = await ds.getRepository(CivicItemSchema).save({
        sourceId: 'source-a',
        localitySlug: 'town-a',
        scopeSlug: 'town-a',
        kind: 'news',
        title: 'Road',
        body: 'Road update',
        hash: 'item-a',
        createdAt: '2026-09-13T00:00:00Z',
      });
      const story = await ds.getRepository(CanonicalStorySchema).save({
        scopeSlug: 'town-a',
        scopeKind: 'town',
        storyKey: 'roads',
        strategy: 'fallback',
        title: 'Roads',
        status: 'open',
        createdAt: '2026-09-13T00:00:00Z',
        updatedAt: '2026-09-13T00:00:00Z',
        currentRevisionId: null,
      });
      await ds.getRepository(CanonicalStoryItemSchema).save({
        canonicalStoryId: story.id!,
        civicItemId: item.id!,
        createdAt: '2026-09-13T00:00:00Z',
      });
      const generation = await ds.getRepository(LlmGenerationSchema).save({
        runId: run.id!,
        localitySlug: 'town-a',
        operation: 'story',
        model: 'test-model',
        status: 'validated',
        attempt: 1,
        promptSha256: SHA_A,
        inputSha256: SHA_B,
        outputSha256: SHA_C,
        sourceKeys: '["source-a"]',
        output: '{}',
        error: null,
        generatedAt: '2026-09-13T00:00:01Z',
        latencyMs: 4,
      });
      const receipt = {
        path: '/tmp/story.md',
        sha256: 'a'.repeat(64),
        token: 'publication-token',
      };
      const revision = await appendCanonicalStoryRevision(ds, {
        canonicalStoryId: story.id!,
        revision: 1,
        status: 'successful',
        title: 'Roads update',
        titleOrigin: 'evidence',
        narrative: 'The road project continues.',
        storyStatus: 'ongoing',
        generationId: generation.id!,
        inputSha256: SHA_B,
        createdAt: '2026-09-13T00:00:01Z',
        citations: [
          { civicItemId: item.id!, sourceKey: 'source-a', snippetOnly: false },
        ],
        publicationReceipt: receipt,
      });
      expect(revision.titleOrigin).toBe('evidence');
      expect(
        (
          await ds
            .getRepository(CanonicalStoryRevisionSchema)
            .findOneByOrFail({ id: revision.id })
        ).titleOrigin
      ).toBe('evidence');
      await expect(
        (() =>
          appendCanonicalStoryRevision(ds, {
            canonicalStoryId: story.id!,
            revision: 2,
            status: 'successful',
            title: 'Forged origin',
            titleOrigin: 'forged' as 'model',
            narrative: 'The road project continues.',
            storyStatus: 'ongoing',
            generationId: generation.id!,
            inputSha256: SHA_B,
            createdAt: '2026-09-13T00:00:02Z',
            citations: [
              {
                civicItemId: item.id!,
                sourceKey: 'source-a',
                snippetOnly: false,
              },
            ],
            publicationReceipt: receipt,
          }))()
      ).rejects.toThrow(/titleOrigin|model or evidence/i);
      expect(
        (
          await ds
            .getRepository(CanonicalStorySchema)
            .findOneByOrFail({ id: story.id })
        ).currentRevisionId
      ).toBe(revision.id);
      await expect(
        (() =>
          appendCanonicalStoryRevision(ds, {
            canonicalStoryId: story.id!,
            revision: 1,
            status: 'successful',
            title: 'Tampered replay',
            titleOrigin: 'evidence',
            narrative: 'The road project continues.',
            storyStatus: 'ongoing',
            generationId: generation.id!,
            inputSha256: SHA_B,
            createdAt: '2026-09-13T00:00:01Z',
            citations: [
              {
                civicItemId: item.id!,
                sourceKey: 'source-a',
                snippetOnly: false,
              },
            ],
            publicationReceipt: receipt,
          }))()
      ).rejects.toThrow(/immutable|mismatch|different/i);
      await expect(
        (() =>
          appendCanonicalStoryRevision(ds, {
            canonicalStoryId: story.id!,
            revision: 2,
            status: 'successful',
            title: 'Bad',
            narrative: 'Bad',
            storyStatus: 'ongoing',
            generationId: generation.id!,
            inputSha256: SHA_B,
            createdAt: '2026-09-13T00:00:02Z',
            citations: [],
            publicationReceipt: { path: '', sha256: 'bad', token: '' },
          }))()
      ).rejects.toThrow(/receipt|artifact|citation/i);
      expect(await ds.getRepository(CanonicalStoryRevisionSchema).count()).toBe(
        1
      );
      expect(await ds.getRepository(StoryRevisionCitationSchema).count()).toBe(
        1
      );
      expect(
        (
          await ds
            .getRepository(CanonicalStorySchema)
            .findOneByOrFail({ id: story.id })
        ).currentRevisionId
      ).toBe(revision.id);
      await expect(
        (() =>
          ds
            .getRepository(CanonicalStoryRevisionSchema)
            .update({ id: revision.id }, { narrative: 'tampered' }))()
      ).rejects.toThrow(/append-only|immutable/i);
      await expect(
        (() =>
          ds
            .getRepository(CanonicalStoryRevisionSchema)
            .delete({ id: revision.id }))()
      ).rejects.toThrow(/append-only|immutable/i);
      const citation = await ds
        .getRepository(StoryRevisionCitationSchema)
        .findOneByOrFail({ revisionId: revision.id!, civicItemId: item.id! });
      await expect(
        (() =>
          ds
            .getRepository(StoryRevisionCitationSchema)
            .update({ id: citation.id }, { sourceKey: 'tampered' }))()
      ).rejects.toThrow(/append-only|immutable/i);
      await expect(
        (() =>
          ds
            .getRepository(StoryRevisionCitationSchema)
            .delete({ id: citation.id }))()
      ).rejects.toThrow(/append-only|immutable/i);
      await ds
        .getRepository(FoundationSourceSchema)
        .update({ id: 'source-a' }, { accessMode: 'snippet-only' });
      const snippetItem = await ds.getRepository(CivicItemSchema).save({
        sourceId: 'source-a',
        localitySlug: 'town-a',
        scopeSlug: 'town-a',
        kind: 'news',
        title: 'Snippet',
        body: 'Snippet update',
        hash: 'item-snippet',
        createdAt: '2026-09-13T00:00:00Z',
        accessMode: null,
      });
      await ds.getRepository(CanonicalStoryItemSchema).save({
        canonicalStoryId: story.id!,
        civicItemId: snippetItem.id!,
        createdAt: '2026-09-13T00:00:00Z',
      });
      const generationTwo = await ds.getRepository(LlmGenerationSchema).save({
        runId: run.id!,
        localitySlug: 'town-a',
        operation: 'story',
        model: 'test-model',
        status: 'validated',
        attempt: 2,
        promptSha256: SHA_A,
        inputSha256: SHA_C,
        outputSha256: SHA_C,
        sourceKeys: '["source-a"]',
        output: '{}',
        error: null,
        generatedAt: '2026-09-13T00:00:02Z',
        latencyMs: 4,
      });
      const revisionTwo = await appendCanonicalStoryRevision(ds, {
        canonicalStoryId: story.id!,
        revision: 2,
        status: 'successful',
        title: 'Snippet update',
        narrative: 'The snippet update continues.',
        storyStatus: 'ongoing',
        generationId: generationTwo.id!,
        inputSha256: SHA_C,
        createdAt: '2026-09-13T00:00:02Z',
        citations: [{ civicItemId: snippetItem.id! }],
        publicationReceipt: receipt,
      });
      const storedSnippetCitation = await ds
        .getRepository(StoryRevisionCitationSchema)
        .findOneByOrFail({
          revisionId: revisionTwo.id!,
          civicItemId: snippetItem.id!,
        });
      expect({
        sourceKey: storedSnippetCitation.sourceKey,
        snippetOnly: storedSnippetCitation.snippetOnly,
      }).toStrictEqual({ sourceKey: 'source-a', snippetOnly: true });
      await expect(
        (() =>
          appendCanonicalStoryRevision(ds, {
            canonicalStoryId: story.id!,
            revision: 2,
            status: 'successful',
            title: 'Mismatch',
            narrative: 'Mismatch',
            storyStatus: 'ongoing',
            generationId: generationTwo.id!,
            inputSha256: 'd'.repeat(64),
            createdAt: '2026-09-13T00:00:02Z',
            citations: [
              {
                civicItemId: item.id!,
                sourceKey: 'source-a',
                snippetOnly: false,
              },
            ],
            publicationReceipt: receipt,
          }))()
      ).rejects.toThrow(/inputSha256|match|different input/i);
      await expect(
        (() =>
          appendCanonicalStoryRevision(ds, {
            canonicalStoryId: story.id!,
            revision: 2,
            status: 'successful',
            title: 'Wrong binding',
            narrative: 'Wrong binding',
            storyStatus: 'ongoing',
            generationId: generationTwo.id!,
            inputSha256: SHA_C,
            createdAt: '2026-09-13T00:00:02Z',
            citations: [
              {
                civicItemId: item.id!,
                sourceKey: 'forged-source',
                snippetOnly: false,
              },
            ],
            publicationReceipt: receipt,
          }))()
      ).rejects.toThrow(/sourceKey|binding/i);
      const withheld = await ds.getRepository(CivicItemSchema).save({
        sourceId: 'source-a',
        localitySlug: 'town-a',
        scopeSlug: 'town-a',
        geographyDecision: 'withhold',
        kind: 'news',
        title: 'Withheld',
        body: 'Withheld',
        hash: 'item-withheld',
        createdAt: '2026-09-13T00:00:00Z',
      });
      await ds.getRepository(CanonicalStoryItemSchema).save({
        canonicalStoryId: story.id!,
        civicItemId: withheld.id!,
        createdAt: '2026-09-13T00:00:00Z',
      });
      await expect(
        (() =>
          appendCanonicalStoryRevision(ds, {
            canonicalStoryId: story.id!,
            revision: 3,
            status: 'successful',
            title: 'Withheld',
            narrative: 'Withheld',
            storyStatus: 'ongoing',
            generationId: generationTwo.id!,
            inputSha256: 'd'.repeat(64),
            createdAt: '2026-09-13T00:00:02Z',
            citations: [
              {
                civicItemId: withheld.id!,
                sourceKey: 'source-a',
                snippetOnly: false,
              },
            ],
            publicationReceipt: receipt,
          }))()
      ).rejects.toThrow(/eligible|withhold/i);
      await expect(
        (() =>
          appendCanonicalStoryRevision(ds, {
            canonicalStoryId: story.id!,
            revision: 1,
            status: 'successful',
            title: 'Reordered',
            narrative: 'Reordered',
            storyStatus: 'ongoing',
            generationId: generation.id!,
            inputSha256: SHA_C,
            createdAt: '2026-09-13T00:00:03Z',
            citations: [
              {
                civicItemId: item.id!,
                sourceKey: 'source-a',
                snippetOnly: false,
              },
            ],
            publicationReceipt: receipt,
          }))()
      ).rejects.toThrow(/monotonic|different input/i);

      const otherStory = await ds.getRepository(CanonicalStorySchema).save({
        scopeSlug: 'town-a',
        scopeKind: 'town',
        storyKey: 'other',
        strategy: 'fallback',
        title: 'Other',
        status: 'open',
        createdAt: '2026-09-13T00:00:00Z',
        updatedAt: '2026-09-13T00:00:00Z',
      });
      const otherItem = await ds.getRepository(CivicItemSchema).save({
        sourceId: 'source-a',
        localitySlug: 'town-a',
        scopeSlug: 'town-a',
        kind: 'news',
        title: 'Other item',
        body: 'Other update',
        hash: 'item-other',
        createdAt: '2026-09-13T00:00:00Z',
      });
      await ds.getRepository(CanonicalStoryItemSchema).save({
        canonicalStoryId: otherStory.id!,
        civicItemId: otherItem.id!,
        createdAt: '2026-09-13T00:00:00Z',
      });
      await expect(
        (() =>
          appendCanonicalStoryRevision(ds, {
            canonicalStoryId: story.id!,
            revision: 3,
            status: 'successful',
            title: 'Cross story',
            narrative: 'Cross story',
            storyStatus: 'ongoing',
            generationId: generationTwo.id!,
            inputSha256: SHA_C,
            createdAt: '2026-09-13T00:00:04Z',
            citations: [{ civicItemId: otherItem.id! }],
            publicationReceipt: receipt,
          }))()
      ).rejects.toThrow(/linked|canonical story|scope/i);
      const crossTownStory = await ds.getRepository(CanonicalStorySchema).save({
        scopeSlug: 'town-b',
        scopeKind: 'town',
        storyKey: 'town-b-other',
        strategy: 'fallback',
        title: 'Town B',
        status: 'open',
        createdAt: '2026-09-13T00:00:00Z',
        updatedAt: '2026-09-13T00:00:00Z',
      });
      const crossTownItem = await ds.getRepository(CivicItemSchema).save({
        sourceId: 'source-a',
        localitySlug: 'town-b',
        scopeSlug: 'town-b',
        kind: 'news',
        title: 'Town B item',
        body: 'Town B update',
        hash: 'item-town-b',
        createdAt: '2026-09-13T00:00:00Z',
      });
      await ds.getRepository(CanonicalStoryItemSchema).save({
        canonicalStoryId: crossTownStory.id!,
        civicItemId: crossTownItem.id!,
        createdAt: '2026-09-13T00:00:00Z',
      });
      await expect(
        (() =>
          appendCanonicalStoryRevision(ds, {
            canonicalStoryId: story.id!,
            revision: 3,
            status: 'successful',
            title: 'Cross town',
            narrative: 'Cross town',
            storyStatus: 'ongoing',
            generationId: generationTwo.id!,
            inputSha256: SHA_C,
            createdAt: '2026-09-13T00:00:04Z',
            citations: [{ civicItemId: crossTownItem.id! }],
            publicationReceipt: receipt,
          }))()
      ).rejects.toThrow(/linked|canonical story|scope/i);
      const briefGeneration = await ds.getRepository(LlmGenerationSchema).save({
        runId: run.id!,
        localitySlug: 'town-a',
        operation: 'brief',
        model: 'test-model',
        status: 'validated',
        attempt: 3,
        promptSha256: SHA_A,
        inputSha256: 'd'.repeat(64),
        outputSha256: SHA_C,
        sourceKeys: '["source-a"]',
        output: '{}',
        error: null,
        generatedAt: '2026-09-13T00:00:03Z',
        latencyMs: 4,
      });
      await expect(
        (() =>
          appendCanonicalStoryRevision(ds, {
            canonicalStoryId: story.id!,
            revision: 3,
            status: 'successful',
            title: 'Wrong operation',
            narrative: 'Wrong operation',
            storyStatus: 'ongoing',
            generationId: briefGeneration.id!,
            inputSha256: 'd'.repeat(64),
            createdAt: '2026-09-13T00:00:04Z',
            citations: [{ civicItemId: item.id! }],
            publicationReceipt: receipt,
          }))()
      ).rejects.toThrow(/story generation|operation|validated/i);
      const mismatchedGeneration = await ds
        .getRepository(LlmGenerationSchema)
        .save({
          runId: run.id!,
          localitySlug: 'town-b',
          operation: 'story',
          model: 'test-model',
          status: 'validated',
          attempt: 4,
          promptSha256: SHA_A,
          inputSha256: 'e'.repeat(64),
          outputSha256: SHA_C,
          sourceKeys: '["source-a"]',
          output: '{}',
          error: null,
          generatedAt: '2026-09-13T00:00:04Z',
          latencyMs: 4,
        });
      await expect(
        (() =>
          appendCanonicalStoryRevision(ds, {
            canonicalStoryId: story.id!,
            revision: 3,
            status: 'successful',
            title: 'Wrong locality',
            narrative: 'Wrong locality',
            storyStatus: 'ongoing',
            generationId: mismatchedGeneration.id!,
            inputSha256: 'e'.repeat(64),
            createdAt: '2026-09-13T00:00:04Z',
            citations: [{ civicItemId: item.id! }],
            publicationReceipt: receipt,
          }))()
      ).rejects.toThrow(/run\/locality|mismatch|context/i);
      const malformedScopeRun = await ds.getRepository(PipelineRunSchema).save({
        scopeSlug: 'county-a',
        localitySlug: 'town-a',
        cadence: 'daily',
        startedAt: '2026-09-13T00:00:00Z',
        status: 'running',
        ruleVersion: 'v1',
        counts: '{}',
        coverageGaps: '[]',
        coverageRanges: '{}',
      });
      const malformedScopeGeneration = await ds
        .getRepository(LlmGenerationSchema)
        .save({
          runId: malformedScopeRun.id!,
          localitySlug: 'town-a',
          operation: 'story',
          model: 'test-model',
          status: 'validated',
          attempt: 5,
          promptSha256: SHA_A,
          inputSha256: 'f'.repeat(64),
          outputSha256: SHA_C,
          sourceKeys: '["source-a"]',
          output: '{}',
          error: null,
          generatedAt: '2026-09-13T00:00:05Z',
          latencyMs: 4,
        });
      await expect(
        (() =>
          appendCanonicalStoryRevision(ds, {
            canonicalStoryId: story.id!,
            revision: 3,
            status: 'successful',
            title: 'Malformed scope',
            narrative: 'Malformed scope',
            storyStatus: 'ongoing',
            generationId: malformedScopeGeneration.id!,
            inputSha256: 'f'.repeat(64),
            createdAt: '2026-09-13T00:00:05Z',
            citations: [{ civicItemId: item.id! }],
            publicationReceipt: receipt,
          }))()
      ).rejects.toThrow(/scopeSlug|localitySlug|scope.*locality/i);
    } finally {
      await ds.destroy();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('deduplicates repeated civic-item citations and makes the retry idempotent', async () => {
    const directory = mkdtempSync(
      join(tmpdir(), 'civic-story-citation-dedupe-')
    );
    const ds = await createFoundationDataSource((await createTestSchema()).url);
    try {
      await ds.getRepository(FoundationSourceSchema).save({
        id: 'source-a',
        sourceKey: 'source-a',
        ownerSlug: 'town-a',
        coverage: 'mentions',
        adapter: 'test',
        name: 'Source A',
        url: 'https://example.test',
        kind: 'news',
        enabled: true,
        accessMode: 'full',
      });
      const run = await ds.getRepository(PipelineRunSchema).save({
        scopeSlug: 'town-a',
        localitySlug: 'town-a',
        cadence: 'daily',
        startedAt: '2026-09-13T00:00:00Z',
        status: 'running',
        ruleVersion: 'v1',
        counts: '{}',
        coverageGaps: '[]',
        coverageRanges: '{}',
      });
      const item = await ds.getRepository(CivicItemSchema).save({
        sourceId: 'source-a',
        localitySlug: 'town-a',
        scopeSlug: 'town-a',
        kind: 'news',
        title: 'Road',
        body: 'Road update',
        hash: 'item-duplicate',
        createdAt: '2026-09-13T00:00:00Z',
        geographyDecision: 'include',
        accessMode: 'full',
      });
      const story = await ds.getRepository(CanonicalStorySchema).save({
        scopeSlug: 'town-a',
        scopeKind: 'town',
        storyKey: 'roads',
        strategy: 'fallback',
        title: 'Roads',
        status: 'open',
        createdAt: '2026-09-13T00:00:00Z',
        updatedAt: '2026-09-13T00:00:00Z',
        currentRevisionId: null,
      });
      await ds.getRepository(CanonicalStoryItemSchema).save({
        canonicalStoryId: story.id!,
        civicItemId: item.id!,
        createdAt: '2026-09-13T00:00:00Z',
      });
      const generation = await ds.getRepository(LlmGenerationSchema).save({
        runId: run.id!,
        localitySlug: 'town-a',
        operation: 'story',
        model: 'test-model',
        status: 'validated',
        attempt: 1,
        promptSha256: SHA_A,
        inputSha256: SHA_B,
        outputSha256: SHA_C,
        sourceKeys: '["source-a"]',
        output: '{}',
        error: null,
        generatedAt: '2026-09-13T00:00:01Z',
        latencyMs: 4,
      });
      const input = {
        canonicalStoryId: story.id!,
        revision: 1,
        status: 'successful' as const,
        title: 'Roads update',
        narrative: 'The road project continues.',
        storyStatus: 'ongoing',
        generationId: generation.id!,
        inputSha256: SHA_B,
        createdAt: '2026-09-13T00:00:01Z',
        citations: [
          { civicItemId: item.id!, sourceKey: 'source-a', snippetOnly: false },
          { civicItemId: item.id!, sourceKey: 'source-a', snippetOnly: false },
          { civicItemId: item.id!, sourceKey: 'source-a' },
        ],
        publicationReceipt: {
          path: '/tmp/story-duplicate.md',
          sha256: SHA_A,
          token: 'publication-token',
        },
      };
      const first = await appendCanonicalStoryRevision(ds, input);
      const second = await appendCanonicalStoryRevision(ds, input);
      expect(first.id).toBe(second.id);
      expect(await ds.getRepository(CanonicalStoryRevisionSchema).count()).toBe(
        1
      );
      expect(await ds.getRepository(StoryRevisionCitationSchema).count()).toBe(
        1
      );
      expect(
        await ds
          .getRepository(StoryRevisionCitationSchema)
          .findOneByOrFail({ revisionId: first.id!, civicItemId: item.id! })
      ).toStrictEqual({
        id: 1,
        revisionId: first.id,
        civicItemId: item.id,
        agendaItemId: null,
        sourceKey: 'source-a',
        snippetOnly: false,
        createdAt: input.createdAt,
      });
    } finally {
      await ds.destroy();
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('rejects conflicting duplicate citation bindings before any revision rows are committed', async () => {
    const directory = mkdtempSync(
      join(tmpdir(), 'civic-story-citation-conflict-')
    );
    const ds = await createFoundationDataSource((await createTestSchema()).url);
    try {
      await ds.getRepository(FoundationSourceSchema).save({
        id: 'source-a',
        sourceKey: 'source-a',
        ownerSlug: 'town-a',
        coverage: 'mentions',
        adapter: 'test',
        name: 'Source A',
        url: 'https://example.test',
        kind: 'news',
        enabled: true,
        accessMode: 'full',
      });
      const run = await ds.getRepository(PipelineRunSchema).save({
        scopeSlug: 'town-a',
        localitySlug: 'town-a',
        cadence: 'daily',
        startedAt: '2026-09-13T00:00:00Z',
        status: 'running',
        ruleVersion: 'v1',
        counts: '{}',
        coverageGaps: '[]',
        coverageRanges: '{}',
      });
      const item = await ds.getRepository(CivicItemSchema).save({
        sourceId: 'source-a',
        localitySlug: 'town-a',
        scopeSlug: 'town-a',
        kind: 'news',
        title: 'Road',
        body: 'Road update',
        hash: 'item-conflict',
        createdAt: '2026-09-13T00:00:00Z',
        geographyDecision: 'include',
        accessMode: 'full',
      });
      const story = await ds.getRepository(CanonicalStorySchema).save({
        scopeSlug: 'town-a',
        scopeKind: 'town',
        storyKey: 'roads',
        strategy: 'fallback',
        title: 'Roads',
        status: 'open',
        createdAt: '2026-09-13T00:00:00Z',
        updatedAt: '2026-09-13T00:00:00Z',
        currentRevisionId: null,
      });
      await ds.getRepository(CanonicalStoryItemSchema).save({
        canonicalStoryId: story.id!,
        civicItemId: item.id!,
        createdAt: '2026-09-13T00:00:00Z',
      });
      const generation = await ds.getRepository(LlmGenerationSchema).save({
        runId: run.id!,
        localitySlug: 'town-a',
        operation: 'story',
        model: 'test-model',
        status: 'validated',
        attempt: 1,
        promptSha256: SHA_A,
        inputSha256: SHA_B,
        outputSha256: SHA_C,
        sourceKeys: '["source-a"]',
        output: '{}',
        error: null,
        generatedAt: '2026-09-13T00:00:01Z',
        latencyMs: 4,
      });
      await expect(
        (() =>
          appendCanonicalStoryRevision(ds, {
            canonicalStoryId: story.id!,
            revision: 1,
            status: 'successful',
            title: 'Roads update',
            narrative: 'The road project continues.',
            storyStatus: 'ongoing',
            generationId: generation.id!,
            inputSha256: SHA_B,
            createdAt: '2026-09-13T00:00:01Z',
            citations: [
              {
                civicItemId: item.id!,
                sourceKey: 'source-a',
                snippetOnly: false,
              },
              {
                civicItemId: item.id!,
                sourceKey: 'other-source',
                snippetOnly: false,
              },
            ],
            publicationReceipt: {
              path: '/tmp/story-conflict.md',
              sha256: SHA_A,
              token: 'publication-token',
            },
          }))()
      ).rejects.toThrow(/sourceKey|binding|conflict/i);
      expect(await ds.getRepository(CanonicalStoryRevisionSchema).count()).toBe(
        0
      );
      expect(await ds.getRepository(StoryRevisionCitationSchema).count()).toBe(
        0
      );
    } finally {
      await ds.destroy();
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
