import { CivicDatabaseModule } from '../civic-database.module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Global, Module, type DynamicModule } from '@nestjs/common';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import {
  createFoundationDataSource,
  createLocalBlobStore,
  createReplayHttpClient,
  FOUNDATION_SCHEMAS,
  loadLocalityRegistry,
  type BlobStore,
  type HttpClient,
} from '@optimistic-tanuki/civic-core';
import { registerAllAdapters } from '@optimistic-tanuki/civic-adapters';
import type { DataSource, EntitySchema } from 'typeorm';
import { createTestSchema } from '../../../../../libs/civic/core/test/db/helpers/postgres';

/**
 * Shared set-up for the stage equivalence specs. Each one runs the original
 * stage (from civic-core) and the ported one over the same recorded corpus,
 * into separate Postgres schemas, and compares what they wrote.
 *
 * The recorded corpus is per deployment and never in git, so these specs run
 * only when CIVIC_CORPUS_DIR points at one (a directory holding index.jsonl
 * and bodies/, such as the Connecticut recording).
 */

export const CORPUS_DIRECTORY = process.env['CIVIC_CORPUS_DIR'] ?? null;
export const AS_OF = '2026-09-17';
export const TOWN = 'groton-ct';
export const CONTEXT_RANGE = { start: '2026-08-18', end: '2026-09-18' };

/** `it` when a corpus is configured, `it.skip` otherwise. */
export const itWithCorpus = CORPUS_DIRECTORY ? it : it.skip;

const LOCALITIES = join(
  __dirname,
  '../../../../../libs/civic/core/test/fixtures/localities'
);

export function replayClient(): HttpClient {
  if (!CORPUS_DIRECTORY) throw new Error('CIVIC_CORPUS_DIR is not set');
  return createReplayHttpClient(CORPUS_DIRECTORY, {
    asOf: () => new Date(`${AS_OF}T23:59:59Z`),
  });
}

export function groton() {
  // Both implementations resolve adapters by name from the same registry.
  registerAllAdapters();
  const registry = loadLocalityRegistry(LOCALITIES);
  const locality = {
    ...registry.get(TOWN),
    sources: registry.sourcesForRun(TOWN),
  };
  return { registry, locality: locality as never, timezone: locality.timezone };
}

/** A scratch directory (for blobs) and its blob store, removed by cleanup(). */
export function scratchBlobs(prefix: string): {
  blobStore: BlobStore;
  cleanup: () => void;
} {
  const work = mkdtempSync(join(tmpdir(), `${prefix}-`));
  return {
    blobStore: createLocalBlobStore(join(work, 'blobs')),
    cleanup: () => rmSync(work, { recursive: true, force: true }),
  };
}

/** A foundation data source on a fresh, empty test schema. */
export async function freshFoundation(): Promise<DataSource> {
  const { url } = await createTestSchema();
  return createFoundationDataSource(url);
}

/**
 * Stands in for CivicDatabaseModule in a Nest testing module: the tokens the
 * stages inject, resolving to a data source the test owns.
 */
export function databaseFor(dataSource: DataSource): DynamicModule {
  return CivicDatabaseModule.forDataSource(dataSource);
}
