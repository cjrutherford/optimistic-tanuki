import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type {
  ApplyOfficialRequest,
  OfficialApplicationResult,
  OfficialStanding,
} from '@optimistic-tanuki/civic-community';
import type { DataSource } from 'typeorm';
import { ContributorEntity, OfficialEventEntity } from './entities';
import { IntakeService } from './intake.service';
import { LOCALITIES, type Localities } from './localities';

/**
 * Official verification, in two steps (community corroboration plan):
 *
 * 1. Automatic: a verified address on one of the town's listed domains,
 *    whose account name matches an entry on the town's published roster,
 *    makes a submitting official. Their material is labeled as coming from
 *    an official, and does not count as community corroboration.
 * 2. Manual, once per person: an operator calls the number the town itself
 *    publishes — never one the applicant supplies — and records the call.
 *    Only then does their material count as the official record.
 *
 * Every step is an append-only event saying what was checked, so a label on
 * a published item can say exactly that and nothing more.
 */

/** Names compared as a person would: case, punctuation, and spacing aside. */
export function sameName(a: string, b: string): boolean {
  const normal = (value: string) =>
    value
      .normalize('NFKD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
  return normal(a) !== '' && normal(a) === normal(b);
}

@Injectable()
export class OfficialsService {
  private readonly logger = new Logger(OfficialsService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @Inject(LOCALITIES) private readonly localities: Localities,
    private readonly intake: IntakeService
  ) {}

  async apply(
    request: ApplyOfficialRequest
  ): Promise<OfficialApplicationResult> {
    const contributor = await this.intake.contributor(request.actor);
    const locality = this.localities.find(request.localitySlug);
    const refuse = async (
      reasons: string[],
      detail: Record<string, unknown> = {}
    ): Promise<OfficialApplicationResult> => {
      await this.db.getRepository(OfficialEventEntity).insert({
        contributorId: contributor.id,
        kind: 'refused',
        localitySlug: request.localitySlug,
        detail: { reasons, ...detail },
        by: 'automatic check',
      });
      return {
        granted: false,
        standing: contributor.officialStanding as OfficialStanding,
        reasons,
        office: null,
      };
    };

    if (!locality?.edition)
      return refuse(['Choose one of the towns Daylight covers.']);
    if (!locality.officials)
      return refuse([
        `${locality.name} has no published roster on file yet, so officials cannot be verified automatically there.`,
      ]);
    if (!request.emailVerified)
      return refuse(['Verify your email address first.']);
    const domain = request.email.split('@').pop()?.toLowerCase() ?? '';
    if (!locality.officials.domains.includes(domain)) {
      return refuse(
        [
          `Your address is not on a domain ${
            locality.name
          } issues (${locality.officials.domains.join(
            ', '
          )}). Register with your official address.`,
        ],
        { domain }
      );
    }
    const entry = locality.officials.roster.find((candidate) =>
      sameName(candidate.name, request.name)
    );
    if (!entry) {
      return refuse(
        [
          `The name on your account, ${request.name}, is not on ${locality.name}'s published roster. Your account name must match it exactly.`,
        ],
        { domain }
      );
    }

    // A callback already confirmed for this town stands; the automatic check never lowers it.
    const standing: OfficialStanding =
      contributor.officialStanding === 'official-record' &&
      contributor.officialLocality === locality.slug
        ? 'official-record'
        : 'submitting-official';
    await this.db.transaction(async (manager) => {
      await manager.update(ContributorEntity, contributor.id, {
        officialStanding: standing,
        officialLocality: locality.slug,
        officialOffice: entry.office,
      });
      await manager.insert(OfficialEventEntity, {
        contributorId: contributor.id,
        kind: 'domain-verified',
        localitySlug: locality.slug,
        detail: { domain, roster: entry, email: request.email },
        by: 'automatic check',
      });
    });
    this.logger.log(
      `contributor ${contributor.id} verified as ${entry.office}, ${locality.name}`
    );
    return {
      granted: true,
      standing,
      office: entry.office,
      reasons:
        standing === 'official-record'
          ? [
              `Verified as ${entry.office}. Your callback is already on record, so your submissions count as ${locality.name}'s official record.`,
            ]
          : [
              `Verified as ${entry.office}: your address is on ${domain} and your name is on the roster published at ${entry.source}. Your submissions are labeled as coming from an official; they count as the official record once we have called you back at the number ${locality.name} publishes.`,
            ],
    };
  }

  /** The operator's callback, recorded with the number's published source and what was said. */
  async confirmCallback(input: {
    userId: string;
    localitySlug: string;
    operator: string;
    note: string;
  }): Promise<{ standing: OfficialStanding }> {
    const contributor = await this.db
      .getRepository(ContributorEntity)
      .findOneBy({ userId: input.userId });
    if (!contributor)
      throw new Error('that account has never contributed or applied');
    if (
      contributor.officialLocality !== input.localitySlug ||
      contributor.officialStanding === 'none'
    ) {
      throw new Error(
        'that account has not passed the automatic check for this town; the callback comes second'
      );
    }
    const locality = this.localities.get(input.localitySlug);
    if (!input.note.trim())
      throw new Error('record what was confirmed on the call');
    await this.db.transaction(async (manager) => {
      await manager.update(ContributorEntity, contributor.id, {
        officialStanding: 'official-record',
      });
      await manager.insert(OfficialEventEntity, {
        contributorId: contributor.id,
        kind: 'callback-confirmed',
        localitySlug: input.localitySlug,
        detail: {
          numberPublishedAt: locality.officials?.callbackNumberSource ?? null,
          note: input.note.trim(),
        },
        by: input.operator,
      });
    });
    return { standing: 'official-record' };
  }
}
