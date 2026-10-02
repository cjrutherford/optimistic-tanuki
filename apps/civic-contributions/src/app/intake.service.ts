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
  describeFinding,
  missingRepresentations,
  review,
  type ContributionView,
  type ReviewModel,
  type ReviewStep,
  type SubmitRequest,
  type SubmitResult,
} from '@optimistic-tanuki/civic-community';
import { IsNull, LessThan, MoreThan, Not, type DataSource } from 'typeorm';
import { COMMUNITY_CONFIG, type CommunityConfig } from '../config';
import { CorpusService } from './corpus.service';
import { CorroborationService } from './corroboration.service';
import {
  ArtifactEntity,
  ContributionEntity,
  ContributorEntity,
  ReviewDecisionEntity,
} from './entities';
import { LOCALITIES, type Localities } from './localities';
import { OutcomeService } from './outcome.service';
import { PromotionService } from './promotion.service';
import { REVIEW_MODEL } from './review-model';
import { ArtifactStore } from './uploads/artifact-store';
import {
  corroborationRefusal,
  type ActorWithRoles,
} from './corroboration-access';

/**
 * Taking a contribution in: the order of the checks is the order in
 * docs/plans (Phase 4 design), and every check that decides anything says
 * why, in words the contributor is shown.
 *
 * Nothing here publishes. An accepted contribution is recorded and can be
 * corroborated in Phase 5; a held one waits for evidence; a rejected one says
 * what to change.
 */

const LIMITS = {
  subject: 200,
  account: { min: 20, max: 5000 },
  artifactNote: { min: 10, max: 2000 },
  links: 5,
  interest: 500,
};

const DATE = /^\d{4}-\d{2}-\d{2}$/u;
const NOT_KEPT =
  '[not kept: the text was refused as copied from a published source]';

type Refusal = { refused: { stage: ReviewStep['stage']; reasons: string[] } };
const refuse = (stage: ReviewStep['stage'], reasons: string[]): Refusal => ({
  refused: { stage, reasons },
});

@Injectable()
export class IntakeService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(IntakeService.name);
  private timers: NodeJS.Timeout[] = [];

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @Inject(COMMUNITY_CONFIG) private readonly config: CommunityConfig,
    @Inject(LOCALITIES) private readonly localities: Localities,
    @Inject(REVIEW_MODEL)
    private readonly model: { name: string; call: ReviewModel },
    private readonly corpus: CorpusService,
    private readonly artifacts: ArtifactStore,
    private readonly corroboration: CorroborationService,
    private readonly outcomes: OutcomeService,
    private readonly promotion: PromotionService
  ) {}

  onModuleInit(): void {
    const every = (ms: number, work: () => Promise<unknown>, name: string) => {
      const timer = setInterval(
        () =>
          void work().catch((error: unknown) =>
            this.logger.error(`${name} failed: ${String(error)}`)
          ),
        ms
      );
      timer.unref();
      this.timers.push(timer);
    };
    every(this.config.rereviewIntervalMs, () => this.rereview(), 're-review');
    every(24 * 60 * 60 * 1000, () => this.purgeOrigins(), 'origin purge');
  }

  onApplicationShutdown(): void {
    for (const timer of this.timers) clearInterval(timer);
  }

  async contributor(actor: SubmitRequest['actor']): Promise<ContributorEntity> {
    const repository = this.db.getRepository(ContributorEntity);
    const existing = await repository.findOneBy({ userId: actor.userId });
    if (existing) {
      if (
        existing.handle !== actor.handle ||
        existing.profileId !== actor.profileId
      ) {
        await repository.update(existing.id, {
          handle: actor.handle,
          profileId: actor.profileId,
        });
        return {
          ...existing,
          handle: actor.handle,
          profileId: actor.profileId,
        };
      }
      return existing;
    }
    return await repository.save(
      repository.create({
        userId: actor.userId,
        profileId: actor.profileId,
        handle: actor.handle,
        suspendedAt: null,
        suspendedReason: null,
        officialStanding: 'none',
        officialLocality: null,
        officialOffice: null,
      })
    );
  }

  async submit(
    request: SubmitRequest & { actor: ActorWithRoles }
  ): Promise<SubmitResult> {
    const contributor = await this.contributor(request.actor);
    if (contributor.suspendedAt) {
      return refuse('suspension', [
        `This account cannot contribute: ${
          contributor.suspendedReason ?? 'it has been suspended'
        }.`,
      ]);
    }

    if (request.idempotencyKey) {
      const earlier = await this.db
        .getRepository(ContributionEntity)
        .findOneBy({
          contributorId: contributor.id,
          idempotencyKey: request.idempotencyKey,
        });
      if (earlier) return { contribution: await this.view(earlier) };
    }

    const invalid = await this.validate(request);
    if (invalid.length) return refuse('validation', invalid);

    if (request.subject.kind === 'contribution') {
      const barred = corroborationRefusal(
        request.actor,
        contributor.officialStanding !== 'none' &&
          contributor.officialLocality === request.localitySlug
      );
      if (barred) return refuse('validation', [barred]);
      const short = await this.belowFloor(contributor, request.emailVerified);
      if (short.length) return refuse('floor', short);
    }

    const missing = missingRepresentations(
      request.kind,
      request.representations,
      request.attachment !== null
    );
    if (missing.length) return refuse('representations', missing);

    const recent = await this.db.getRepository(ContributionEntity).countBy({
      contributorId: contributor.id,
      submittedAt: MoreThan(new Date(Date.now() - 60 * 60 * 1000)),
    });
    if (recent >= this.config.hourlyLimit) {
      return refuse('rate-limit', [
        `You have submitted ${recent} contributions in the last hour, the most allowed. Try again later.`,
      ]);
    }

    const steps: Omit<ReviewDecisionEntity, 'id' | 'contributionId' | 'at'>[] =
      [];
    let artifact: ArtifactEntity | null = null;
    if (request.attachment) {
      const stored = await this.artifacts.accept(
        request.attachment,
        contributor.id
      );
      if ('refused' in stored) return refuse('upload', [stored.refused]);
      artifact = stored.artifact;
      steps.push({
        stage: 'upload',
        outcome: 'accept',
        reasons: [
          `A ${stored.describe} of ${stored.artifact.bytes} bytes, scanned by ${stored.artifact.scanner}: no threat found.`,
        ],
        model: null,
        promptSha256: null,
        answers: null,
      });
    }

    const subjectText = await this.subjectText(request);
    // Standing is earned per subject area, so each contribution carries the
    // desk of what it is about; a corroboration inherits the report's.
    const topic = await this.topicFor(request);
    const bodySha256 = createHash('sha256')
      .update(request.body, 'utf8')
      .digest('hex');
    const official =
      contributor.officialStanding !== 'none' &&
      contributor.officialLocality === request.localitySlug
        ? contributor.officialStanding
        : null;
    const base = {
      contributorId: contributor.id,
      localitySlug: request.localitySlug,
      kind: request.kind,
      subjectKind: request.subject.kind,
      subjectRef: request.subject.kind === 'other' ? null : request.subject.ref,
      idempotencyKey: request.idempotencyKey,
      originNetwork: request.origin?.network ?? null,
      originClient: request.origin?.client ?? null,
      subjectText,
      occurredOn:
        request.occurredOn ?? (await this.target(request))?.occurredOn ?? null,
      bodySha256,
      links: request.links,
      disclosedInterest: request.disclosedInterest?.trim() || null,
      topic,
      representations: { ...request.representations } as Record<
        string,
        boolean
      >,
      artifactId: artifact?.id ?? null,
      officialStanding: official,
    };

    // Copying. Without a corpus to compare against, copying cannot be ruled
    // out, so the contribution holds rather than passing unchecked.
    const finding = this.corpus.available
      ? this.corpus.check(`${subjectText}\n${request.body}`)
      : null;
    if (finding) {
      return await this.record({ ...base, body: NOT_KEPT, state: 'rejected' }, [
        ...steps,
        {
          stage: 'duplication',
          outcome: 'reject',
          reasons: [describeFinding(finding)],
          model: null,
          promptSha256: null,
          answers: {
            source: finding.document,
            copiedWords: finding.copiedWords,
            allowedWords: finding.allowedWords,
          },
        },
      ]);
    }
    steps.push(
      this.corpus.available
        ? {
            stage: 'duplication',
            outcome: 'accept',
            reasons: [
              `Checked against ${this.corpus.indexed} published articles: no copying beyond what may be quoted.`,
            ],
            model: null,
            promptSha256: null,
            answers: null,
          }
        : {
            stage: 'duplication',
            outcome: 'hold',
            reasons: [
              'Copying could not be checked, because no published articles are loaded to compare against, so it waits.',
            ],
            model: null,
            promptSha256: null,
            answers: null,
          }
    );

    const town = this.localities.get(request.localitySlug)!.name;
    const assessment = await review(
      {
        kind: request.kind,
        town,
        subject: subjectText,
        occurredOn: request.occurredOn,
        body: request.body,
        links: request.links,
        disclosedInterest: base.disclosedInterest,
        artifact: artifact
          ? { mediaType: artifact.mediaType, name: request.attachment!.name }
          : null,
      },
      this.model.call
    );
    steps.push({
      stage: 'model',
      outcome: assessment.outcome,
      reasons: assessment.reasons,
      model: this.model.name,
      promptSha256: null,
      answers: assessment.answers,
    });

    const outcomes = steps.map((step) => step.outcome);
    const state = outcomes.includes('reject')
      ? 'rejected'
      : outcomes.includes('hold')
      ? 'held'
      : 'accepted';
    return await this.record({ ...base, body: request.body, state }, steps);
  }

  /** The subject area a contribution is in: the report's, for a corroboration; otherwise the desk of its subject. */
  private async topicFor(request: SubmitRequest): Promise<string> {
    if (request.subject.kind === 'contribution' && request.subject.ref) {
      const report = await this.db
        .getRepository(ContributionEntity)
        .findOneBy({ id: request.subject.ref });
      if (report) return report.topic;
    }
    return await this.corpus.topicFor(request.localitySlug, request.subject);
  }

  async mine(actor: SubmitRequest['actor']): Promise<ContributionView[]> {
    const contributor = await this.db
      .getRepository(ContributorEntity)
      .findOneBy({ userId: actor.userId });
    if (!contributor) return [];
    const rows = await this.db.getRepository(ContributionEntity).find({
      where: { contributorId: contributor.id },
      order: { submittedAt: 'DESC' },
      take: 100,
    });
    return Promise.all(rows.map((row) => this.view(row)));
  }

  async withdraw(
    actor: SubmitRequest['actor'],
    id: string
  ): Promise<ContributionView | null> {
    const contributor = await this.db
      .getRepository(ContributorEntity)
      .findOneBy({ userId: actor.userId });
    if (!contributor) return null;
    const row = await this.db
      .getRepository(ContributionEntity)
      .findOneBy({ id, contributorId: contributor.id });
    if (!row) return null;
    if (row.state === 'withdrawn' || row.state === 'taken-down')
      return await this.view(row);
    await this.db.transaction(async (manager) => {
      await manager.update(ContributionEntity, row.id, { state: 'withdrawn' });
      await manager.insert(ReviewDecisionEntity, {
        contributionId: row.id,
        stage: 'withdrawal',
        outcome: 'withdrawn',
        reasons: ['Withdrawn by its contributor.'],
        model: null,
        promptSha256: null,
        answers: null,
      });
    });
    // It leaves the surface at once, and whatever it supported is weighed again without it.
    await this.outcomes.reverse(row.id, 'the contribution was withdrawn');
    await this.corroboration.evaluate(
      row.subjectKind === 'contribution' && row.subjectRef
        ? row.subjectRef
        : row.id,
      `contribution ${row.id} withdrawn`
    );
    return await this.view({ ...row, state: 'withdrawn' });
  }

  private async validate(request: SubmitRequest): Promise<string[]> {
    const problems: string[] = [];
    const locality = this.localities.find(request.localitySlug);
    if (!locality || !locality.edition)
      problems.push('Choose one of the towns Daylight covers.');
    if (request.kind !== 'account' && request.kind !== 'artifact')
      problems.push(
        'A contribution is an account of what you witnessed or an artifact such as a document or photograph.'
      );
    const body = request.body.trim();
    const limits =
      request.kind === 'artifact' ? LIMITS.artifactNote : LIMITS.account;
    if (body.length < limits.min)
      problems.push(`Describe it in at least ${limits.min} characters.`);
    if (body.length > limits.max)
      problems.push(`Keep it to ${limits.max} characters.`);
    if (
      request.kind === 'artifact' &&
      !request.attachment &&
      !request.links.length
    )
      problems.push(
        'Attach the document, photograph or recording, or link to it.'
      );
    if (request.links.length > LIMITS.links)
      problems.push(`Include at most ${LIMITS.links} links.`);
    for (const link of request.links) {
      let url: URL | null = null;
      try {
        url = new URL(link);
      } catch {
        /* reported below */
      }
      if (
        !url ||
        (url.protocol !== 'https:' && url.protocol !== 'http:') ||
        url.username ||
        url.password
      )
        problems.push(`${link.slice(0, 80)} is not a web address.`);
    }
    if (
      request.occurredOn !== null &&
      (!DATE.test(request.occurredOn) ||
        Number.isNaN(Date.parse(`${request.occurredOn}T00:00:00Z`)))
    )
      problems.push('Give the date it happened as a calendar date.');
    if (
      request.occurredOn &&
      request.occurredOn > new Date().toISOString().slice(0, 10)
    )
      problems.push('The date it happened cannot be in the future.');
    if ((request.disclosedInterest ?? '').length > LIMITS.interest)
      problems.push(`Keep the disclosure to ${LIMITS.interest} characters.`);
    const { kind, ref, text } = request.subject;
    if (kind === 'other') {
      if (!text.trim() || text.trim().length > LIMITS.subject)
        problems.push(
          `Say what it is about in 1 to ${LIMITS.subject} characters.`
        );
    } else if (kind === 'contribution') {
      const target = await this.target(request);
      const author = await this.db
        .getRepository(ContributorEntity)
        .findOneBy({ userId: request.actor.userId });
      if (
        !target ||
        target.localitySlug !== request.localitySlug ||
        target.subjectKind === 'contribution'
      )
        problems.push('That is not a report you can corroborate.');
      else if (target.state !== 'accepted' && target.state !== 'held')
        problems.push('That report is no longer open to corroboration.');
      else if (author && target.contributorId === author.id)
        problems.push('You cannot corroborate your own report.');
    } else if (kind === 'meeting' || kind === 'story') {
      if (
        !ref ||
        !locality ||
        !(await this.corpus.subjectExists(request.localitySlug, kind, ref))
      )
        problems.push(
          `That ${kind} is not one Daylight has published for this town.`
        );
    } else {
      problems.push(
        'Say whether it is about a meeting, a story, or something else.'
      );
    }
    return problems;
  }

  /** For an attachment to a meeting or story, the subject is its published title, not the submitter's wording. */
  private async subjectText(request: SubmitRequest): Promise<string> {
    if (request.subject.kind === 'other') return request.subject.text.trim();
    if (request.subject.kind === 'contribution')
      return (
        (await this.target(request))?.subjectText ?? request.subject.text.trim()
      );
    const option = (await this.corpus.subjects(request.localitySlug)).find(
      (candidate) =>
        candidate.kind === request.subject.kind &&
        candidate.ref === request.subject.ref
    );
    return option?.title ?? request.subject.text.trim();
  }

  private async record(
    contribution: Omit<ContributionEntity, 'id' | 'submittedAt'>,
    steps: Omit<ReviewDecisionEntity, 'id' | 'contributionId' | 'at'>[]
  ): Promise<SubmitResult> {
    const saved = await this.db.transaction(async (manager) => {
      const row = await manager.save(
        manager.create(ContributionEntity, contribution)
      );
      for (const step of steps)
        await manager.insert(ReviewDecisionEntity, {
          ...step,
          contributionId: row.id,
        });
      return row;
    });
    this.logger.log(
      `contribution ${saved.id} in ${saved.localitySlug}: ${saved.state}`
    );
    if (saved.subjectKind === 'contribution') {
      if (saved.state === 'accepted')
        await this.corroboration.recordVerdict(saved);
    } else {
      await this.corroboration.evaluate(saved.id, 'report received');
    }
    return { contribution: await this.view(saved) };
  }

  /** The report a corroboration supports. */
  private async target(
    request: SubmitRequest
  ): Promise<ContributionEntity | null> {
    if (
      request.subject.kind !== 'contribution' ||
      !request.subject.ref ||
      !/^[0-9a-f-]{36}$/u.test(request.subject.ref)
    )
      return null;
    return await this.db
      .getRepository(ContributionEntity)
      .findOneBy({ id: request.subject.ref });
  }

  /**
   * The verification floor: an account may report at once, but may not
   * corroborate until it has a verified address, a minimum age, and one
   * earlier contribution that cleared review.
   */
  private async belowFloor(
    contributor: ContributorEntity,
    emailVerified: boolean
  ): Promise<string[]> {
    const short: string[] = [];
    if (!emailVerified)
      short.push('Verify your email address before corroborating.');
    const days = (Date.now() - contributor.createdAt.getTime()) / 86_400_000;
    if (days < this.config.floor.minAgeDays) {
      const wait = Math.ceil(this.config.floor.minAgeDays - days);
      short.push(
        `New accounts can corroborate after ${
          this.config.floor.minAgeDays
        } days; yours can in ${wait} day${
          wait === 1 ? '' : 's'
        }. You can send your own report now.`
      );
    }
    const cleared = await this.db
      .getRepository(ContributionEntity)
      .countBy({ contributorId: contributor.id, state: 'accepted' });
    if (cleared === 0)
      short.push(
        'Corroborating needs one earlier report of yours that cleared review. Send a report of your own first.'
      );
    return short;
  }

  /**
   * Contributions held only because review could not run are reviewed
   * again, as their reason promises: the copying check if no corpus was
   * loaded, the model if it was unreachable.
   */
  async rereview(): Promise<number> {
    const held = await this.db.getRepository(ContributionEntity).find({
      where: { state: 'held' },
      order: { submittedAt: 'ASC' },
      take: 50,
    });
    let changed = 0;
    for (const row of held) {
      const decisions = await this.db
        .getRepository(ReviewDecisionEntity)
        .find({ where: { contributionId: row.id }, order: { id: 'ASC' } });
      const latest = new Map<string, ReviewDecisionEntity>();
      for (const decision of decisions) latest.set(decision.stage, decision);
      const model = latest.get('model');
      const duplication = latest.get('duplication');
      const modelUnavailable =
        model?.outcome === 'hold' && model.answers === null;
      const copyingUnchecked = duplication?.outcome === 'hold';
      if (!modelUnavailable && !copyingUnchecked) continue;
      const fresh: Omit<ReviewDecisionEntity, 'id' | 'at'>[] = [];
      if (copyingUnchecked && this.corpus.available) {
        const finding = this.corpus.check(`${row.subjectText}\n${row.body}`);
        fresh.push(
          finding
            ? {
                contributionId: row.id,
                stage: 'duplication',
                outcome: 'reject',
                reasons: [describeFinding(finding)],
                model: null,
                promptSha256: null,
                answers: { source: finding.document },
              }
            : {
                contributionId: row.id,
                stage: 'duplication',
                outcome: 'accept',
                reasons: [
                  `Checked again against ${this.corpus.indexed} published articles: no copying beyond what may be quoted.`,
                ],
                model: null,
                promptSha256: null,
                answers: null,
              }
        );
      }
      if (modelUnavailable) {
        const artifact = row.artifactId
          ? await this.db
              .getRepository(ArtifactEntity)
              .findOneBy({ id: row.artifactId })
          : null;
        const assessment = await review(
          {
            kind: row.kind as 'account' | 'artifact',
            town: this.localities.get(row.localitySlug).name,
            subject: row.subjectText,
            occurredOn: row.occurredOn,
            body: row.body,
            links: row.links,
            disclosedInterest: row.disclosedInterest,
            artifact: artifact
              ? { mediaType: artifact.mediaType, name: 'attachment' }
              : null,
          },
          this.model.call
        );
        if (assessment.answers === null) continue; // still unreachable; try next time
        fresh.push({
          contributionId: row.id,
          stage: 'model',
          outcome: assessment.outcome,
          reasons: assessment.reasons,
          model: this.model.name,
          promptSha256: null,
          answers: assessment.answers,
        });
      }
      if (!fresh.length) continue;
      for (const decision of fresh)
        latest.set(decision.stage, decision as ReviewDecisionEntity);
      const outcomes = [...latest.values()]
        .filter((d) => ['upload', 'duplication', 'model'].includes(d.stage))
        .map((d) => d.outcome);
      const state = outcomes.includes('reject')
        ? 'rejected'
        : outcomes.includes('hold')
        ? 'held'
        : 'accepted';
      await this.db.transaction(async (manager) => {
        for (const decision of fresh)
          await manager.insert(ReviewDecisionEntity, decision);
        if (state !== row.state)
          await manager.update(
            ContributionEntity,
            row.id,
            state === 'rejected' ? { state, body: NOT_KEPT } : { state }
          );
      });
      if (state !== row.state) {
        changed += 1;
        await this.corroboration.evaluate(
          row.subjectKind === 'contribution' && row.subjectRef
            ? row.subjectRef
            : row.id,
          `contribution ${row.id} reviewed again`
        );
      }
    }
    return changed;
  }

  /** Forgets where submissions came from once the retention period passes. */
  async purgeOrigins(): Promise<number> {
    const cutoff = new Date(
      Date.now() - this.config.originRetentionDays * 86_400_000
    );
    const result = await this.db
      .getRepository(ContributionEntity)
      .update(
        { submittedAt: LessThan(cutoff), originNetwork: Not(IsNull()) },
        { originNetwork: null, originClient: null }
      );
    return result.affected ?? 0;
  }

  async view(row: ContributionEntity): Promise<ContributionView> {
    const decisions = await this.db
      .getRepository(ReviewDecisionEntity)
      .find({ where: { contributionId: row.id }, order: { id: 'ASC' } });
    // Whether a briefing may quote it yet, in the same trail as everything else.
    const promotion = (await this.promotion.standingFor([row.id])).get(row.id);
    const artifact = row.artifactId
      ? await this.db
          .getRepository(ArtifactEntity)
          .findOneBy({ id: row.artifactId })
      : null;
    return {
      id: row.id,
      localitySlug: row.localitySlug,
      kind: row.kind as ContributionView['kind'],
      subject: {
        kind: row.subjectKind as ContributionView['subject']['kind'],
        ref: row.subjectRef,
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
      state: row.state as ContributionView['state'],
      review: [
        ...decisions.map((decision) => ({
          stage: decision.stage as ReviewStep['stage'],
          outcome: decision.outcome as ReviewStep['outcome'],
          reasons: decision.reasons,
          at: decision.at.toISOString(),
        })),
        ...(promotion
          ? [
              {
                stage: 'briefing' as const,
                outcome: (promotion.offered
                  ? 'quotable'
                  : 'not-quotable') as ReviewStep['outcome'],
                reasons: [promotion.reason],
                at: promotion.at.toISOString(),
              },
            ]
          : []),
      ],
      submittedAt: row.submittedAt.toISOString(),
    };
  }
}
