import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type {
  CommunitySurface,
  ContributorPageView,
  OfficialItem,
  OutcomeNote,
  PublicContribution,
  RecordKind,
  SurfaceItem,
} from '@optimistic-tanuki/civic-community';
import { In, Not, type DataSource } from 'typeorm';
import { AssetType, StorageStrategy } from '@optimistic-tanuki/models';
import { LocalStorageAdapter } from '@optimistic-tanuki/storage';
import { COMMUNITY_CONFIG, type CommunityConfig } from '../config';
import { CorroborationService } from './corroboration.service';
import {
  ArtifactEntity,
  ContributionEntity,
  ContributorEntity,
  OfficialEventEntity,
} from './entities';
import { OutcomeService } from './outcome.service';
import { LOCALITIES, type Localities } from './localities';

/**
 * The community surface: what the public sees of contributions.
 *
 * Community reports and official material are separate. A community report
 * appears once it is accepted — as a labeled single report — and as
 * corroborated once independent contributions cross the gate; a held report
 * appears only when evidence releases it. Every contribution is quoted as its
 * contributor wrote it and attributed to their handle; nothing here is
 * rewritten into the platform's own words. Official material is labeled with
 * exactly what was checked and when, and never counts as corroboration.
 */

const SURFACE_LIMIT = 100;

@Injectable()
export class SurfaceService {
  private readonly storage: LocalStorageAdapter;

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @Inject(COMMUNITY_CONFIG) config: CommunityConfig,
    @Inject(LOCALITIES) private readonly localities: Localities,
    private readonly corroboration: CorroborationService,
    private readonly outcomes: OutcomeService
  ) {
    this.storage = new LocalStorageAdapter(
      new Logger('LocalStorageAdapter'),
      config.artifactRoot
    );
  }

  async surface(localitySlug: string): Promise<CommunitySurface> {
    const reports = await this.db.getRepository(ContributionEntity).find({
      where: {
        localitySlug,
        subjectKind: Not('contribution'),
        state: In(['accepted', 'held']),
      },
      order: { submittedAt: 'DESC' },
      take: SURFACE_LIMIT,
    });
    const items: SurfaceItem[] = [];
    const official: OfficialItem[] = [];
    for (const report of reports) {
      if (report.officialStanding) {
        if (report.state === 'accepted')
          official.push(await this.officialItem(report));
        continue;
      }
      const item = await this.item(report);
      if (item) items.push(item);
    }
    return { items, official };
  }

  async contributorPage(
    contributorId: string
  ): Promise<ContributorPageView | null> {
    if (!/^[0-9a-f-]{36}$/u.test(contributorId)) return null;
    const contributor = await this.db
      .getRepository(ContributorEntity)
      .findOneBy({ id: contributorId });
    if (!contributor) return null;
    const own = await this.db.getRepository(ContributionEntity).find({
      where: { contributorId, state: In(['accepted', 'held']) },
      order: { submittedAt: 'DESC' },
      take: SURFACE_LIMIT,
    });
    const reports: SurfaceItem[] = [];
    const corroborated: ContributorPageView['corroborated'] = [];
    for (const row of own) {
      if (row.officialStanding) continue;
      if (row.subjectKind !== 'contribution') {
        const item = await this.item(row);
        if (item) reports.push(item);
      } else if (row.subjectRef && row.state === 'accepted') {
        const report = await this.db
          .getRepository(ContributionEntity)
          .findOneBy({ id: row.subjectRef });
        // Listed only where the gate counted it, so this page agrees with the town's.
        const shown = report ? await this.item(report) : null;
        if (
          report &&
          shown?.corroborations.some((support) => support.id === row.id)
        ) {
          corroborated.push({
            report: {
              id: report.id,
              subject: report.subjectText,
              localitySlug: report.localitySlug,
            },
            contribution: await this.publicView(row),
          });
        }
      }
    }
    return {
      history: await this.outcomes.history(contributorId),
      id: contributor.id,
      handle: contributor.handle,
      profileId: contributor.profileId,
      official:
        contributor.officialStanding !== 'none' && contributor.officialLocality
          ? `${contributor.officialOffice ?? 'Official'}, ${
              this.localities.find(contributor.officialLocality)?.name ??
              contributor.officialLocality
            }`
          : null,
      reports,
      corroborated,
    };
  }

  /** An attachment's bytes, only when a contribution that carries it is on the surface. */
  async artifact(
    sha256: string
  ): Promise<{ mediaType: string; base64: string; filename: string } | null> {
    if (!/^[0-9a-f]{64}$/u.test(sha256)) return null;
    const artifact = await this.db
      .getRepository(ArtifactEntity)
      .findOneBy({ sha256 });
    if (!artifact) return null;
    const carriers = await this.db
      .getRepository(ContributionEntity)
      .find({ where: { artifactId: artifact.id, state: 'accepted' } });
    let visible = false;
    for (const carrier of carriers) {
      if (carrier.officialStanding) {
        visible = true;
        break;
      }
      const report =
        carrier.subjectKind === 'contribution' && carrier.subjectRef
          ? await this.db
              .getRepository(ContributionEntity)
              .findOneBy({ id: carrier.subjectRef })
          : carrier;
      if (report && (await this.item(report))) {
        visible = true;
        break;
      }
    }
    if (!visible) return null;
    const extension = artifact.storagePath.split('.').pop() ?? 'bin';
    const content = await this.storage.read({
      id: artifact.id,
      name: `${artifact.sha256}.${extension}`,
      storagePath: artifact.storagePath,
      type: AssetType.DOCUMENT,
      storageStrategy: StorageStrategy.LOCAL_BLOCK_STORAGE,
      profileId: artifact.firstContributorId,
    });
    return {
      mediaType: artifact.mediaType,
      base64: content.slice(content.indexOf(',') + 1),
      filename: `${artifact.sha256.slice(0, 16)}.${extension}`,
    };
  }

  /** A report as the surface shows it, or null when it is not on the surface. */
  private async item(report: ContributionEntity): Promise<SurfaceItem | null> {
    const evaluation = await this.corroboration.compute(report);
    if (
      evaluation.status !== 'single' &&
      evaluation.status !== 'corroborated' &&
      evaluation.status !== 'released'
    )
      return null;
    const counted = new Set(
      evaluation.gate.members
        .filter((verdict) => verdict.counted)
        .map((verdict) => verdict.id)
    );
    const corroborations = evaluation.members
      .filter(({ row }) => row.id !== report.id && counted.has(row.id))
      .map(({ row }) => row);
    return {
      ...(await this.publicView(report)),
      status: evaluation.status === 'single' ? 'single' : 'corroborated',
      releasedByEvidence: evaluation.status === 'released',
      corroborations: await Promise.all(
        corroborations.map((row) => this.publicView(row))
      ),
      outcomes: await this.outcomeNotes(report.id),
    };
  }

  /**
   * What later records said about a report. Shown beside it on the town's
   * page and the contributor's: a report the record bore out says so, and so
   * does one the record went against — a service that only published its
   * successes would be worth less than none.
   */
  private async outcomeNotes(contributionId: string): Promise<OutcomeNote[]> {
    const matches =
      (await this.outcomes.outcomesFor([contributionId])).get(contributionId) ??
      [];
    return matches.map((match) => ({
      verdict: match.verdict as OutcomeNote['verdict'],
      kind: match.recordKind as RecordKind,
      title: match.recordTitle,
      date: match.recordDate,
      url: match.recordUrl,
      publisher: match.recordPublisher,
      reason: match.reasons.join(' '),
    }));
  }

  private async publicView(
    row: ContributionEntity
  ): Promise<PublicContribution> {
    const contributor = await this.db
      .getRepository(ContributorEntity)
      .findOneBy({ id: row.contributorId });
    const artifact = row.artifactId
      ? await this.db
          .getRepository(ArtifactEntity)
          .findOneBy({ id: row.artifactId })
      : null;
    return {
      id: row.id,
      kind: row.kind as PublicContribution['kind'],
      subject: {
        kind: row.subjectKind as PublicContribution['subject']['kind'],
        text: row.subjectText,
      },
      occurredOn: row.occurredOn,
      body: row.body,
      links: row.links,
      disclosedInterest: row.disclosedInterest,
      artifact: artifact
        ? {
            sha256: artifact.sha256,
            mediaType: artifact.mediaType,
            bytes: artifact.bytes,
          }
        : null,
      contributor: {
        id: row.contributorId,
        handle: contributor?.handle ?? 'a contributor',
      },
      submittedAt: row.submittedAt.toISOString(),
    };
  }

  /** What was checked about an official, and when — a description, not a badge. */
  private async officialItem(row: ContributionEntity): Promise<OfficialItem> {
    const events = await this.db.getRepository(OfficialEventEntity).find({
      where: {
        contributorId: row.contributorId,
        localitySlug: row.localitySlug,
      },
      order: { id: 'ASC' },
    });
    const verified = [...events]
      .reverse()
      .find((event) => event.kind === 'domain-verified');
    const callback = [...events]
      .reverse()
      .find((event) => event.kind === 'callback-confirmed');
    const detail = (verified?.detail ?? {}) as {
      domain?: string;
      roster?: { office?: string; source?: string };
    };
    const town =
      this.localities.find(row.localitySlug)?.name ?? row.localitySlug;
    const day = (date: Date) => date.toISOString().slice(0, 10);
    const parts = [
      `${detail.roster?.office ?? 'Official'}, ${town}.`,
      verified
        ? `On ${day(verified.at)} we checked that this account writes from a ${
            detail.domain
          } address and that its name is on the roster published at ${
            detail.roster?.source
          }.`
        : '',
      callback
        ? `On ${day(
            callback.at
          )} we confirmed it by calling the number ${town} publishes.`
        : 'It has not yet been confirmed by a call to the number the town publishes, so it is not the official record.',
    ];
    return {
      ...(await this.publicView(row)),
      label: parts.filter(Boolean).join(' '),
      officialRecord: Boolean(callback),
    };
  }
}
