import { Logger } from '@nestjs/common';
import {
  LocalitySchema,
  type LocalityRow,
  parseLocalityConfig,
  type OfficialsConfig,
} from '@optimistic-tanuki/civic-core';
import type { DataSource } from 'typeorm';
import type { LocalityRegistrySource } from '../registry/locality-registry.source';
import { normalizeOfficialName } from './normalize-name';
import {
  type OfficialCandidateRow,
  OfficialCandidateSchema,
  type OfficialCandidateStatus,
} from './official-candidate.schema';

const STATUSES: readonly OfficialCandidateStatus[] = [
  'pending',
  'accepted',
  'rejected',
];

/** A decision the service refuses; the gateway answers it with 400. */
export class InvalidOfficialCandidateError extends Error {}

export interface OfficialCandidateReply {
  id: string;
  slug: string;
  townName: string;
  name: string;
  role: string;
  sourceAgendaId: string | null;
  firstSeen: string;
  lastSeen: string;
  status: OfficialCandidateStatus;
  decidedBy: string | null;
  decidedAt: string | null;
  /** Whether the town already has an officials config; if not, the first acceptance must supply domains and a callback-number source. */
  townHasOfficials: boolean;
}

export interface AcceptOfficialCandidateInput {
  id: string;
  office: string;
  source: string;
  decidedBy: string;
  domains?: string[];
  callbackNumberSource?: string;
}

function isHttps(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    return new URL(value.trim()).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Operators' review of the names Civic Core read from agendas (D33). Only an
 * accepted name reaches a town's `officials.roster`, and only with a source
 * the operator supplies; the result is checked with the real locality parser
 * before it is saved, so a bad value cannot break the registry load.
 */
export class OfficialCandidatesService {
  private readonly logger = new Logger(OfficialCandidatesService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly registry: Pick<
      LocalityRegistrySource,
      'current' | 'refresh'
    >
  ) {}

  private get candidates() {
    return this.dataSource.getRepository<OfficialCandidateRow>(
      OfficialCandidateSchema
    );
  }

  /** Candidates by status (pending by default), optionally for one town. */
  async list(
    filter: { slug?: string; status?: string } = {}
  ): Promise<OfficialCandidateReply[]> {
    const status = (filter.status || 'pending') as OfficialCandidateStatus;
    if (!STATUSES.includes(status))
      throw new InvalidOfficialCandidateError(
        `status must be one of ${STATUSES.join(', ')}.`
      );
    const rows = await this.candidates.find({
      where: { status, ...(filter.slug ? { slug: filter.slug } : {}) },
      order: { slug: 'ASC', role: 'ASC', name: 'ASC' },
    });
    const places = this.registry.current().all();
    return rows.map((row) => {
      const place = places.find((p) => p.slug === row.slug);
      return {
        id: row.id,
        slug: row.slug,
        townName: place?.name ?? row.slug,
        name: row.name,
        role: row.role,
        sourceAgendaId: row.sourceAgendaId ?? null,
        firstSeen: new Date(row.firstSeen).toISOString(),
        lastSeen: new Date(row.lastSeen).toISOString(),
        status: row.status,
        decidedBy: row.decidedBy ?? null,
        decidedAt: row.decidedAt ? new Date(row.decidedAt).toISOString() : null,
        townHasOfficials: !!place?.officials,
      };
    });
  }

  /**
   * Adds the candidate to the town's roster and marks it accepted. Null for
   * an unknown id; throws InvalidOfficialCandidateError for a bad value.
   */
  async accept(
    input: AcceptOfficialCandidateInput
  ): Promise<OfficialCandidateReply | null> {
    const candidate = await this.candidates.findOneBy({ id: input.id });
    if (!candidate) return null;
    if (candidate.status !== 'pending')
      throw new InvalidOfficialCandidateError(
        `This candidate was already ${candidate.status}.`
      );
    const office = input.office?.trim() ?? '';
    if (!office)
      throw new InvalidOfficialCandidateError('The office is required.');
    if (!isHttps(input.source))
      throw new InvalidOfficialCandidateError(
        'The source must be an https URL.'
      );
    const callback = input.callbackNumberSource?.trim();
    if (callback && !isHttps(callback))
      throw new InvalidOfficialCandidateError(
        'The callback number source must be an https URL.'
      );

    const row = await this.dataSource
      .getRepository<LocalityRow>(LocalitySchema)
      .findOneBy({ slug: candidate.slug });
    const town = this.registry
      .current()
      .all()
      .find((place) => place.slug === candidate.slug);
    if (!row || !town)
      throw new InvalidOfficialCandidateError(
        `${candidate.slug} is not in the locality registry.`
      );

    const entry = {
      name: candidate.name,
      office,
      source: input.source.trim(),
    };
    let officials: OfficialsConfig;
    if (row.officials) {
      let current: OfficialsConfig;
      try {
        current = JSON.parse(row.officials) as OfficialsConfig;
      } catch {
        throw new InvalidOfficialCandidateError(
          `${candidate.slug} has officials that cannot be read.`
        );
      }
      if (
        (current.roster ?? []).some(
          (existing) =>
            normalizeOfficialName(existing.name) === candidate.normalizedName
        )
      )
        throw new InvalidOfficialCandidateError(
          `${candidate.name} is already on the roster.`
        );
      officials = { ...current, roster: [...(current.roster ?? []), entry] };
    } else {
      const domains = (input.domains ?? [])
        .map((domain) => domain.trim().toLowerCase())
        .filter(Boolean);
      if (!domains.length || !callback)
        throw new InvalidOfficialCandidateError(
          'This town has no officials yet: give at least one government email domain and the callback number source.'
        );
      officials = { domains, roster: [entry], callbackNumberSource: callback };
    }

    try {
      parseLocalityConfig({ ...town, officials });
    } catch (error) {
      throw new InvalidOfficialCandidateError(
        error instanceof Error ? error.message : String(error)
      );
    }

    await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository<LocalityRow>(LocalitySchema)
        .update(
          { slug: candidate.slug },
          { officials: JSON.stringify(officials) }
        );
      await manager
        .getRepository<OfficialCandidateRow>(OfficialCandidateSchema)
        .update(
          { id: candidate.id },
          {
            status: 'accepted',
            decidedBy: input.decidedBy,
            decidedAt: new Date(),
          }
        );
    });
    this.logger.log(`${candidate.slug}: ${candidate.name} added to the roster`);
    try {
      await this.registry.refresh({ sync: false });
    } catch (error) {
      this.logger.warn(
        `registry reload after accepting ${candidate.name} failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
    return (await this.list({ slug: candidate.slug, status: 'accepted' })).find(
      (reply) => reply.id === candidate.id
    ) as OfficialCandidateReply;
  }

  /** Marks the candidate rejected, for good. Null for an unknown id. */
  async reject(input: {
    id: string;
    decidedBy: string;
  }): Promise<OfficialCandidateReply | null> {
    const candidate = await this.candidates.findOneBy({ id: input.id });
    if (!candidate) return null;
    if (candidate.status !== 'pending')
      throw new InvalidOfficialCandidateError(
        `This candidate was already ${candidate.status}.`
      );
    await this.candidates.update(
      { id: candidate.id },
      { status: 'rejected', decidedBy: input.decidedBy, decidedAt: new Date() }
    );
    return (await this.list({ slug: candidate.slug, status: 'rejected' })).find(
      (reply) => reply.id === candidate.id
    ) as OfficialCandidateReply;
  }
}
