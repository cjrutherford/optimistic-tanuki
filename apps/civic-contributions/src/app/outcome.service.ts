import { createHash } from 'node:crypto';
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  deltaFor,
  matchOutcome,
  outcomeMessages,
  type ContributorHistory,
  type OutcomeReport,
  type PrimaryRecord,
} from '@optimistic-tanuki/civic-community';
import {
  evidenceSignature,
  scoreEvidence,
  termWeights,
  STORY_MATCH_THRESHOLD,
  type EvidenceSignature,
} from '@optimistic-tanuki/civic-core';
import { In, Not, type DataSource } from 'typeorm';
import { COMMUNITY_CONFIG, type CommunityConfig } from '../config';
import { CorpusService } from './corpus.service';
import { CorroborationService } from './corroboration.service';
import {
  ContributionEntity,
  ContributorEntity,
  OutcomeMatchEntity,
  ReputationEventEntity,
} from './entities';
import { REVIEW_MODEL } from './review-model';
import type { ReviewModel } from '@optimistic-tanuki/civic-community';

/**
 * Phase C: what the record said, and what that does to standing.
 *
 * A contribution is a resident's account. The sweep looks for records made
 * after the event it describes — the town's own paperwork, a local
 * publisher's article, or material from an official the operator called back
 * — and asks the model, one pair at a time, whether the record bears the
 * report out. The rules in @civic/community decide what the answers mean, and
 * the verdict is recorded with its reasons.
 *
 * Candidates are found the same way the pipeline finds stories: by the story
 * engine, over the contribution's own words and the record's. That keeps the
 * model's work small and the pairs plausible, and means the matcher's
 * failures are the matcher's, not a second heuristic nobody reviews.
 *
 * Standing follows from the verdicts, per topic and decayed. It is never
 * shown as a number; it enters the corroboration gate as weight, so a
 * contributor who has been right where a record could show it needs less
 * corroboration next time — and one who has been wrong needs more.
 */

/** Records compared per contribution per sweep, most recent first: a bound on model work. */
const CANDIDATES_PER_SWEEP = 3;
/** How closely a record must read like the contribution before the model is asked at all. */
const CANDIDATE_THRESHOLD = STORY_MATCH_THRESHOLD;

@Injectable()
export class OutcomeService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(OutcomeService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @Inject(COMMUNITY_CONFIG) private readonly config: CommunityConfig,
    @Inject(REVIEW_MODEL)
    private readonly model: { name: string; call: ReviewModel },
    private readonly corpus: CorpusService,
    private readonly corroboration: CorroborationService
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(
      () =>
        void this.sweep().catch((error: unknown) =>
          this.logger.error(`outcome sweep failed: ${String(error)}`)
        ),
      this.config.outcomeSweepIntervalMs
    );
    this.timer.unref();
  }

  onApplicationShutdown(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Confirmed, contradicted and still pending, for a contributor's page. */
  async history(contributorId: string): Promise<ContributorHistory> {
    const contributions = await this.db.getRepository(ContributionEntity).find({
      where: { contributorId, state: In(['accepted', 'held']) },
      select: ['id'],
    });
    const ids = contributions.map((row) => row.id);
    if (!ids.length) return { confirmed: 0, contradicted: 0, pending: 0 };
    const matches = await this.db.getRepository(OutcomeMatchEntity).find({
      where: {
        contributionId: In(ids),
        verdict: In(['confirmed', 'contradicted']),
      },
    });
    const settled = new Map<string, string>();
    for (const match of matches) {
      // A contradiction stands whatever else agreed: the record said the report was wrong.
      if (
        match.verdict === 'contradicted' ||
        !settled.has(match.contributionId)
      )
        settled.set(match.contributionId, match.verdict);
    }
    const confirmed = [...settled.values()].filter(
      (verdict) => verdict === 'confirmed'
    ).length;
    const contradicted = [...settled.values()].filter(
      (verdict) => verdict === 'contradicted'
    ).length;
    return { confirmed, contradicted, pending: ids.length - settled.size };
  }

  /** What settled one contribution, for its page; the pending case shows nothing. */
  async outcomesFor(
    contributionIds: readonly string[]
  ): Promise<Map<string, OutcomeMatchEntity[]>> {
    const byContribution = new Map<string, OutcomeMatchEntity[]>();
    if (!contributionIds.length) return byContribution;
    const matches = await this.db.getRepository(OutcomeMatchEntity).find({
      where: {
        contributionId: In([...contributionIds]),
        verdict: In(['confirmed', 'contradicted']),
      },
      order: { id: 'ASC' },
    });
    for (const match of matches)
      byContribution.set(match.contributionId, [
        ...(byContribution.get(match.contributionId) ?? []),
        match,
      ]);
    return byContribution;
  }

  /**
   * One pass over the contributions no record has settled yet. Returns what
   * it compared and what changed, for the operator's log.
   */
  async sweep(): Promise<{
    compared: number;
    confirmed: number;
    contradicted: number;
  }> {
    const open = await this.db.getRepository(ContributionEntity).find({
      where: {
        state: In(['accepted', 'held']),
        subjectKind: Not('contribution'),
      },
      order: { submittedAt: 'ASC' },
    });
    let compared = 0;
    let confirmed = 0;
    let contradicted = 0;
    for (const contribution of open) {
      // An official's own material is the record; it is not checked against itself.
      if (contribution.officialStanding) continue;
      const settled = await this.db
        .getRepository(OutcomeMatchEntity)
        .find({ where: { contributionId: contribution.id } });
      if (
        settled.some(
          (match) =>
            match.verdict === 'confirmed' || match.verdict === 'contradicted'
        )
      )
        continue;
      const seen = new Set(settled.map((match) => match.recordRef));
      for (const record of await this.candidates(contribution, seen)) {
        compared += 1;
        const verdict = await this.compare(contribution, record);
        if (verdict === 'confirmed') confirmed += 1;
        if (verdict === 'contradicted') contradicted += 1;
        if (verdict === 'confirmed' || verdict === 'contradicted') break;
      }
    }
    if (compared)
      this.logger.log(
        `outcome sweep: compared ${compared}, confirmed ${confirmed}, contradicted ${contradicted}`
      );
    return { compared, confirmed, contradicted };
  }

  /**
   * The records worth asking about: made on or after the day the report is
   * of, not already compared, and reading closely enough like it. Officials'
   * material from this town counts as a record of its own.
   */
  private async candidates(
    contribution: ContributionEntity,
    seen: ReadonlySet<string>
  ): Promise<PrimaryRecord[]> {
    const day =
      contribution.occurredOn ??
      contribution.submittedAt.toISOString().slice(0, 10);
    const fromCorpus = await this.corpus.recordsSince(
      contribution.localitySlug,
      day
    );
    const officials = await this.db.getRepository(ContributionEntity).find({
      where: {
        localitySlug: contribution.localitySlug,
        officialStanding: 'official-record',
        state: 'accepted',
      },
      order: { submittedAt: 'DESC' },
      take: 40,
    });
    const fromOfficials: PrimaryRecord[] = officials
      .filter(
        (row) =>
          (row.occurredOn ?? row.submittedAt.toISOString().slice(0, 10)) >= day
      )
      .map((row) => ({
        kind: 'official-channel' as const,
        ref: `contribution:${row.id}`,
        title: row.subjectText,
        excerpt: row.body,
        date: row.occurredOn ?? row.submittedAt.toISOString().slice(0, 10),
        url: null,
        publisher: 'a confirmed official',
      }));
    const pool = [...fromCorpus, ...fromOfficials].filter(
      (record) => !seen.has(record.ref)
    );
    if (!pool.length) return [];
    const report = signatureOf(
      `${contribution.subjectText}\n${contribution.body}`
    );
    const signatures = new Map(
      pool.map((record) => [
        record.ref,
        signatureOf(`${record.title}\n${record.excerpt}`),
      ])
    );
    const weights = termWeights([report, ...signatures.values()]);
    return pool
      .map((record) => ({
        record,
        score: scoreEvidence(report, signatures.get(record.ref)!, weights)
          .score,
      }))
      .filter((entry) => entry.score >= CANDIDATE_THRESHOLD)
      .sort(
        (a, b) =>
          b.score - a.score ||
          (b.record.date ?? '').localeCompare(a.record.date ?? '')
      )
      .slice(0, CANDIDATES_PER_SWEEP)
      .map((entry) => entry.record);
  }

  /** Compares one pair, records the verdict, and moves standing when it settles something. */
  private async compare(
    contribution: ContributionEntity,
    record: PrimaryRecord
  ): Promise<string> {
    const report: OutcomeReport = {
      town: contribution.localitySlug,
      subject: contribution.subjectText,
      occurredOn: contribution.occurredOn,
      body: contribution.body,
    };
    const result = await matchOutcome(report, record, this.model.call);
    const promptSha256 = createHash('sha256')
      .update(JSON.stringify(outcomeMessages(report, record)))
      .digest('hex');
    const match = await this.db.getRepository(OutcomeMatchEntity).save({
      contributionId: contribution.id,
      recordKind: record.kind,
      recordRef: record.ref,
      recordTitle: record.title,
      recordDate: record.date,
      recordUrl: record.url,
      recordPublisher: record.publisher,
      verdict: result.verdict,
      reasons: result.reasons,
      model: this.model.name,
      promptSha256,
      answers: result.answers,
    });
    const delta = deltaFor(result.verdict, record.kind, this.config.standing);
    if (!delta) return result.verdict;
    await this.db.getRepository(ReputationEventEntity).insert({
      contributorId: contribution.contributorId,
      topic: contribution.topic,
      delta,
      kind: result.verdict,
      contributionId: contribution.id,
      outcomeMatchId: match.id,
      reason: result.reasons.join(' '),
    });
    // Standing is weight, so every report this contributor stands behind is re-evaluated.
    await this.reevaluateFor(contribution.contributorId);
    this.logger.log(
      `${contribution.id}: ${result.verdict} by ${record.ref} (${
        delta > 0 ? '+' : ''
      }${delta} on ${contribution.topic})`
    );
    return result.verdict;
  }

  /**
   * Reverses what a contribution earned. A withdrawn, taken-down or retracted
   * contribution should leave nothing behind it, so the events it caused are
   * cancelled by opposite events rather than deleted: the record of what was
   * believed, and when, stays readable.
   */
  async reverse(contributionId: string, cause: string): Promise<number> {
    const events = await this.db
      .getRepository(ReputationEventEntity)
      .find({ where: { contributionId } });
    const standing = events.filter((event) => event.kind !== 'reversed');
    const reversed = events
      .filter((event) => event.kind === 'reversed')
      .reduce((sum, event) => sum + event.delta, 0);
    const outstanding =
      standing.reduce((sum, event) => sum + event.delta, 0) + reversed;
    if (Math.abs(outstanding) < 1e-9) return 0;
    const first = standing[0]!;
    await this.db.getRepository(ReputationEventEntity).insert({
      contributorId: first.contributorId,
      topic: first.topic,
      delta: -outstanding,
      kind: 'reversed',
      contributionId,
      outcomeMatchId: null,
      reason: `Reversed: ${cause}`,
    });
    await this.reevaluateFor(first.contributorId);
    this.logger.log(`${contributionId}: standing reversed (${cause})`);
    return -outstanding;
  }

  /** Every report this contributor's standing bears on, re-evaluated at the gate. */
  private async reevaluateFor(contributorId: string): Promise<void> {
    const theirs = await this.db
      .getRepository(ContributionEntity)
      .find({ where: { contributorId, state: In(['accepted', 'held']) } });
    const reports = new Set<string>();
    for (const row of theirs) {
      if (row.subjectKind === 'contribution' && row.subjectRef)
        reports.add(row.subjectRef);
      else reports.add(row.id);
    }
    for (const reportId of reports)
      await this.corroboration.evaluate(reportId, 'standing changed');
  }
}

/** A contribution or a record as the story engine compares it: an article with a headline and a lead. */
function signatureOf(text: string): EvidenceSignature {
  const [headline = '', ...rest] = text.split('\n');
  return evidenceSignature({
    text: headline,
    explicitIds: [],
    agendaItemId: null,
    content: `${headline}\n${rest.join(' ')}`,
  });
}
