import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  promotionOf,
  type PromotionVerdict,
} from '@optimistic-tanuki/civic-community';
import {
  snapshotPath,
  type CommunityCorrection,
  type CommunityQuote,
  type CommunitySnapshot,
} from '@optimistic-tanuki/civic-core';
import { In, Not, type DataSource } from 'typeorm';
import { COMMUNITY_CONFIG, type CommunityConfig } from '../config';
import { CorroborationService } from './corroboration.service';
import {
  ContributionEntity,
  ContributorEntity,
  OutcomeMatchEntity,
  PromotionEventEntity,
} from './entities';
import { LOCALITIES, type Localities } from './localities';

/**
 * Phase D: what the community offers a briefing, written where the pipeline
 * can read it.
 *
 * The service decides eligibility — the rules are in @civic/community — and
 * writes a snapshot per town. The pipeline reads the file and quotes what is
 * in it. Nothing is pushed: a run that is given no snapshot directory
 * produces exactly the briefing it would have produced before, which is what
 * keeps replay honest.
 *
 * Every offer and every withdrawal is recorded in `promotion_events`, so a
 * published edition can be explained afterwards: this is what the service
 * said was quotable, on this day, and this is why it stopped saying so.
 *
 * A retraction is never a quiet deletion. When material that was offered
 * stops being eligible — withdrawn, taken down, or contradicted by a record
 * — the snapshot carries a correction naming the edition that quoted it, and
 * the briefing prints it.
 */

@Injectable()
export class PromotionService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(PromotionService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @Inject(COMMUNITY_CONFIG) private readonly config: CommunityConfig,
    @Inject(LOCALITIES) private readonly localities: Localities,
    private readonly corroboration: CorroborationService
  ) {}

  onModuleInit(): void {
    if (!this.config.promotionDirectory) return;
    this.timer = setInterval(
      () =>
        void this.writeAll().catch((error: unknown) =>
          this.logger.error(`promotion export failed: ${String(error)}`)
        ),
      this.config.promotionIntervalMs
    );
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Every town that has contributions, exported. Returns what each snapshot holds. */
  async writeAll(): Promise<
    { localitySlug: string; quotes: number; corrections: number }[]
  > {
    const towns = await this.db
      .getRepository(ContributionEntity)
      .createQueryBuilder('c')
      .select('DISTINCT c.localitySlug', 'slug')
      .getRawMany<{ slug: string }>();
    const written: {
      localitySlug: string;
      quotes: number;
      corrections: number;
    }[] = [];
    for (const { slug } of towns) {
      const snapshot = await this.snapshot(slug);
      if (this.config.promotionDirectory) this.write(snapshot);
      written.push({
        localitySlug: slug,
        quotes: snapshot.quotes.length,
        corrections: snapshot.corrections.length,
      });
    }
    return written;
  }

  /** One town's snapshot: what may be quoted now, and what is owed a correction. */
  async snapshot(localitySlug: string): Promise<CommunitySnapshot> {
    const contributions = await this.db.getRepository(ContributionEntity).find({
      where: { localitySlug, subjectKind: Not('contribution') },
      order: { submittedAt: 'ASC' },
    });
    const quotes: CommunityQuote[] = [];
    for (const contribution of contributions) {
      const { verdict, confirmedBy } = await this.judge(contribution);
      await this.record(contribution, verdict);
      if (!verdict.promoted || !verdict.path) continue;
      const contributor = await this.db
        .getRepository(ContributorEntity)
        .findOneBy({ id: contribution.contributorId });
      quotes.push({
        id: contribution.id,
        quote: contribution.body,
        attribution: contributor?.handle ?? 'a contributor',
        office:
          contribution.officialStanding && contributor?.officialOffice
            ? contributor.officialOffice
            : null,
        subject: contribution.subjectText,
        occurredOn: contribution.occurredOn,
        submittedAt: contribution.submittedAt.toISOString(),
        path: verdict.path,
        confirmedBy: confirmedBy
          ? {
              title: confirmedBy.recordTitle,
              url: confirmedBy.recordUrl,
              publisher: confirmedBy.recordPublisher,
              date: confirmedBy.recordDate,
            }
          : null,
        url: `/contributors/${contribution.contributorId}`,
      });
    }
    return {
      generatedAt: new Date().toISOString(),
      localitySlug,
      quotes,
      corrections: await this.corrections(localitySlug),
    };
  }

  /** Whether one contribution may be quoted, and the record that bore it out. */
  private async judge(contribution: ContributionEntity): Promise<{
    verdict: PromotionVerdict;
    confirmedBy: OutcomeMatchEntity | null;
  }> {
    const confirmed = await this.db.getRepository(OutcomeMatchEntity).findOne({
      where: { contributionId: contribution.id, verdict: 'confirmed' },
      order: { id: 'ASC' },
    });
    const contradicted = await this.db
      .getRepository(OutcomeMatchEntity)
      .findOneBy({ contributionId: contribution.id, verdict: 'contradicted' });
    // A record that went against a report closes every path, whatever else supports it.
    if (contradicted) {
      return {
        verdict: {
          promoted: false,
          path: null,
          reasons: [
            `A later record says otherwise: ${contradicted.recordTitle}.`,
          ],
        },
        confirmedBy: null,
      };
    }
    const evaluation = await this.corroboration.compute(contribution);
    const verdict = promotionOf({
      state: contribution.state,
      officialStanding: contribution.officialStanding,
      corroborated:
        evaluation.status === 'corroborated' ||
        evaluation.status === 'released',
      confirmedByRecord: Boolean(confirmed),
      artifact: contribution.artifactId ? { authenticated: false } : null,
      disclosedInterest: contribution.disclosedInterest,
    });
    return { verdict, confirmedBy: confirmed ?? null };
  }

  /** Records a change in what the service offers, so an edition can be explained later. */
  private async record(
    contribution: ContributionEntity,
    verdict: PromotionVerdict
  ): Promise<void> {
    const repository = this.db.getRepository(PromotionEventEntity);
    const last = await repository.findOne({
      where: { contributionId: contribution.id },
      order: { id: 'DESC' },
    });
    const offered = verdict.promoted;
    if (last && last.offered === offered) return;
    await repository.insert({
      contributionId: contribution.id,
      localitySlug: contribution.localitySlug,
      offered,
      path: verdict.path,
      reason: verdict.reasons.join(' '),
    });
    if (last?.offered && !offered)
      this.logger.log(
        `${contribution.id}: withdrawn from briefings (${verdict.reasons.join(
          ' '
        )})`
      );
  }

  /**
   * What is owed a correction: material this service offered, that a
   * briefing could have quoted, and that is no longer eligible. The
   * correction names the day and says plainly what happened; a published
   * edition is never edited into agreement with the present.
   */
  private async corrections(
    localitySlug: string
  ): Promise<CommunityCorrection[]> {
    const events = await this.db
      .getRepository(PromotionEventEntity)
      .find({ where: { localitySlug }, order: { id: 'ASC' } });
    const byContribution = new Map<string, PromotionEventEntity[]>();
    for (const event of events)
      byContribution.set(event.contributionId, [
        ...(byContribution.get(event.contributionId) ?? []),
        event,
      ]);
    const corrections: CommunityCorrection[] = [];
    const town = this.localities.find(localitySlug)?.name ?? localitySlug;
    for (const [contributionId, history] of byContribution) {
      const offered = history.find((event) => event.offered);
      const withdrawn = [...history].reverse().find((event) => !event.offered);
      if (!offered || !withdrawn || withdrawn.id < offered.id) continue;
      const contribution = await this.db
        .getRepository(ContributionEntity)
        .findOneBy({ id: contributionId });
      if (!contribution) continue;
      corrections.push({
        id: `${contributionId}:${withdrawn.id}`,
        at: withdrawn.at.toISOString().slice(0, 10),
        affects: (
          contribution.occurredOn ?? offered.at.toISOString().slice(0, 10)
        ).slice(0, 10),
        text: `A resident's account of ${contribution.subjectText} quoted in a ${town} briefing has been withdrawn. ${withdrawn.reason}`,
      });
    }
    return corrections;
  }

  private write(snapshot: CommunitySnapshot): void {
    const path = snapshotPath(
      this.config.promotionDirectory!,
      snapshot.localitySlug
    );
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(snapshot, null, 2)}\n`);
    this.logger.log(
      `${snapshot.localitySlug}: ${snapshot.quotes.length} quotable, ${snapshot.corrections.length} correction(s) -> ${path}`
    );
  }

  /** What a contributor is told about their own material: whether a briefing may quote it. */
  async standingFor(
    contributionIds: readonly string[]
  ): Promise<Map<string, PromotionEventEntity>> {
    const events = contributionIds.length
      ? await this.db.getRepository(PromotionEventEntity).find({
          where: { contributionId: In([...contributionIds]) },
          order: { id: 'ASC' },
        })
      : [];
    const latest = new Map<string, PromotionEventEntity>();
    for (const event of events) latest.set(event.contributionId, event);
    return latest;
  }
}
