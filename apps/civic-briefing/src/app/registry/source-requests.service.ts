import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { DataSource } from 'typeorm';
import { SourcingStore } from '../schedule/sourcing-store';
import type { LocalityRegistrySource } from './locality-registry.source';
import {
  type SourceRequestRow,
  SourceRequestSchema,
} from './source-request.schema';
import { townSources } from './town-sources';

/** The longest note a reader may leave with a request. */
export const MAX_NOTE_LENGTH = 500;

export type SourceStatus = 'has-sources' | 'no-sources' | 'not-sourced-yet';

export interface SourceStatusReply {
  slug: string;
  name: string;
  status: SourceStatus;
  requestCount: number;
}

export interface SourceRequestReply {
  requestCount: number;
  alreadyRequested: boolean;
}

/** A request the service refuses; the gateway answers it with 400. */
export class InvalidSourceRequestError extends Error {}

/**
 * Whether a town has sources, and readers' requests for them (D32). A town
 * with sources is `has-sources`; one discovery has searched and found nothing
 * for is `no-sources`; one discovery has not reached yet is `not-sourced-yet`.
 */
export class SourceRequestsService {
  private readonly logger = new Logger(SourceRequestsService.name);
  private readonly store: SourcingStore;

  constructor(
    private readonly dataSource: DataSource,
    private readonly registry: Pick<LocalityRegistrySource, 'current'>
  ) {
    this.store = new SourcingStore(dataSource);
  }

  private get requests() {
    return this.dataSource.getRepository<SourceRequestRow>(SourceRequestSchema);
  }

  /** The town's status, or null for a slug the registry does not hold. */
  async status(slug: string): Promise<SourceStatusReply | null> {
    const registry = this.registry.current();
    const town = registry.all().find((place) => place.slug === slug);
    if (!town) return null;
    const status: SourceStatus = townSources(registry, town).length
      ? 'has-sources'
      : (await this.store.lastSearched(slug))
      ? 'no-sources'
      : 'not-sourced-yet';
    return {
      slug: town.slug,
      name: town.name,
      status,
      requestCount: await this.requests.countBy({ slug }),
    };
  }

  /** Records a reader's request once; a repeat adds nothing. Null for an unknown slug. */
  async request(
    slug: string,
    userId: string,
    note?: string | null
  ): Promise<SourceRequestReply | null> {
    const trimmed = note?.trim() || null;
    if (trimmed && trimmed.length > MAX_NOTE_LENGTH)
      throw new InvalidSourceRequestError(
        `The note is limited to ${MAX_NOTE_LENGTH} characters.`
      );
    if (
      !this.registry
        .current()
        .all()
        .some((place) => place.slug === slug)
    )
      return null;
    let alreadyRequested = !!(await this.requests.findOneBy({ slug, userId }));
    if (!alreadyRequested)
      try {
        await this.requests.insert({
          id: randomUUID(),
          slug,
          userId,
          note: trimmed,
        });
      } catch (error) {
        // A concurrent request by the same reader won the unique (slug, userId).
        if ((error as { code?: string }).code !== '23505') throw error;
        alreadyRequested = true;
      }
    if (!alreadyRequested)
      this.logger.log(`${slug}: sources requested by a reader`);
    return {
      requestCount: await this.requests.countBy({ slug }),
      alreadyRequested,
    };
  }
}
