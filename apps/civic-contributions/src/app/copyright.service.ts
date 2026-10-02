import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type {
  CounterNoticeRequest,
  TakedownNoticeRequest,
} from '@optimistic-tanuki/civic-community';
import { In, type DataSource } from 'typeorm';
import { COMMUNITY_CONFIG, type CommunityConfig } from '../config';
import { OutcomeService } from './outcome.service';
import { CorroborationService } from './corroboration.service';
import {
  ContributionEntity,
  ContributorEntity,
  CopyrightStrikeEntity,
  CounterNoticeEntity,
  ReviewDecisionEntity,
  TakedownActionEntity,
  TakedownNoticeEntity,
} from './entities';

/**
 * Copyright notices under DMCA §512: the mechanics, not the legal judgement.
 *
 * Anyone may file a notice; it is checked for the elements the statute
 * requires and recorded. An operator decides it. Upholding takes the named
 * contributions down, logs the action, and records a strike against each
 * contributor; enough strikes suspend the account — the repeat-infringer
 * policy the safe harbor requires, actually implemented. A contributor may
 * answer with a counter-notice; restoring the material after one is again
 * an operator's decision, logged. Registering the designated agent with the
 * Copyright Office is not something code can do; see the architecture plan.
 */

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/giu;

export class NoticeError extends Error {}

@Injectable()
export class CopyrightService {
  private readonly logger = new Logger(CopyrightService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @Inject(COMMUNITY_CONFIG) private readonly config: CommunityConfig,
    private readonly outcomes: OutcomeService,
    private readonly corroboration: CorroborationService
  ) {}

  async file(
    notice: TakedownNoticeRequest
  ): Promise<{ id: string; locatedContributions: number }> {
    const problems: string[] = [];
    for (const [field, label] of [
      ['claimantName', 'your name'],
      ['claimantEmail', 'an email address'],
      ['claimantAddress', 'a postal address'],
      ['work', 'the copyrighted work'],
      ['signature', 'your signature'],
    ] as const) {
      if (!notice[field]?.trim()) problems.push(`Give ${label}.`);
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(notice.claimantEmail ?? ''))
      problems.push('Give an email address we can reply to.');
    if (!notice.goodFaith)
      problems.push(
        'Affirm your good-faith belief that the use is not authorized.'
      );
    if (!notice.accurateUnderPenalty)
      problems.push(
        'Affirm, under penalty of perjury, that the notice is accurate and that you are authorized to act for the owner.'
      );
    const located = this.locate(notice.locations ?? []);
    if (!located.length)
      problems.push(
        'Identify the material: give the address or identifier of each contribution.'
      );
    if (problems.length) throw new NoticeError(problems.join(' '));
    const saved = await this.db.getRepository(TakedownNoticeEntity).save({
      claimantName: notice.claimantName.trim(),
      claimantEmail: notice.claimantEmail.trim(),
      claimantAddress: notice.claimantAddress.trim(),
      work: notice.work.trim(),
      locations: notice.locations,
      goodFaith: true,
      accurateUnderPenalty: true,
      signature: notice.signature.trim(),
      state: 'received',
    });
    const existing = await this.db
      .getRepository(ContributionEntity)
      .countBy({ id: In(located) });
    this.logger.warn(
      `copyright notice ${saved.id} received for ${existing} contribution(s); an operator must decide it`
    );
    return { id: saved.id, locatedContributions: existing };
  }

  async list(
    state?: string
  ): Promise<(TakedownNoticeEntity & { contributionIds: string[] })[]> {
    const notices = await this.db
      .getRepository(TakedownNoticeEntity)
      .find({ where: state ? { state } : {}, order: { receivedAt: 'ASC' } });
    return notices.map((notice) => ({
      ...notice,
      contributionIds: this.locate(notice.locations),
    }));
  }

  /** An operator's decision on a notice: uphold it (take down, strike), decline it, or restore after a counter-notice. */
  async act(input: {
    noticeId: string;
    action: 'upheld' | 'declined' | 'restored';
    operator: string;
    note: string;
  }): Promise<{ contributions: string[]; suspended: string[] }> {
    const notice = await this.db
      .getRepository(TakedownNoticeEntity)
      .findOneBy({ id: input.noticeId });
    if (!notice) throw new NoticeError('No such notice.');
    if (!input.note.trim())
      throw new NoticeError('Record the reason for the decision.');
    const ids = this.locate(notice.locations);
    const suspended: string[] = [];
    await this.db.transaction(async (manager) => {
      const contributions = ids.length
        ? await manager.find(ContributionEntity, { where: { id: In(ids) } })
        : [];
      if (input.action === 'upheld') {
        if (notice.state !== 'received')
          throw new NoticeError(`That notice was already ${notice.state}.`);
        for (const contribution of contributions) {
          if (contribution.state === 'taken-down') continue;
          await manager.update(ContributionEntity, contribution.id, {
            state: 'taken-down',
          });
          await manager.insert(ReviewDecisionEntity, {
            contributionId: contribution.id,
            stage: 'takedown',
            outcome: 'taken-down',
            reasons: [
              'Taken down on a copyright notice. You may answer with a counter-notice if you believe this is a mistake.',
            ],
            model: null,
            promptSha256: null,
            answers: { noticeId: notice.id },
          });
          await manager.insert(CopyrightStrikeEntity, {
            contributorId: contribution.contributorId,
            noticeId: notice.id,
            contributionId: contribution.id,
          });
          const strikes = await manager.countBy(CopyrightStrikeEntity, {
            contributorId: contribution.contributorId,
          });
          if (strikes >= this.config.strikeLimit) {
            const contributor = await manager.findOneBy(ContributorEntity, {
              id: contribution.contributorId,
            });
            if (contributor && !contributor.suspendedAt) {
              await manager.update(ContributorEntity, contributor.id, {
                suspendedAt: new Date(),
                suspendedReason: `${strikes} contributions were taken down on upheld copyright notices`,
              });
              suspended.push(contributor.id);
            }
          }
        }
        await manager.update(TakedownNoticeEntity, notice.id, {
          state: 'upheld',
        });
      } else if (input.action === 'declined') {
        if (notice.state !== 'received')
          throw new NoticeError(`That notice was already ${notice.state}.`);
        await manager.update(TakedownNoticeEntity, notice.id, {
          state: 'declined',
        });
      } else {
        if (notice.state !== 'upheld')
          throw new NoticeError(
            'Only material taken down on an upheld notice can be restored.'
          );
        const countered = await manager.find(CounterNoticeEntity, {
          where: { noticeId: notice.id },
        });
        if (!countered.length)
          throw new NoticeError(
            'Nothing on that notice has been answered with a counter-notice.'
          );
        for (const counter of countered) {
          // Restored material goes back through review rather than straight to accepted.
          await manager.update(ContributionEntity, counter.contributionId, {
            state: 'held',
          });
          await manager.insert(ReviewDecisionEntity, {
            contributionId: counter.contributionId,
            stage: 'restoration',
            outcome: 'restored',
            reasons: [
              'Restored after a counter-notice. It waits to be corroborated like any held contribution.',
            ],
            model: null,
            promptSha256: null,
            answers: { noticeId: notice.id },
          });
        }
      }
      await manager.insert(TakedownActionEntity, {
        noticeId: notice.id,
        action: input.action,
        contributionIds: contributions.map((c) => c.id),
        by: input.operator,
        note: input.note.trim(),
      });
    });
    // Taken-down material leaves the surface at once; what it supported is
    // weighed again, and whatever standing it earned is given back.
    if (input.action !== 'declined') {
      const touched = ids.length
        ? await this.db
            .getRepository(ContributionEntity)
            .find({ where: { id: In(ids) } })
        : [];
      if (input.action === 'upheld') {
        for (const row of touched)
          await this.outcomes.reverse(
            row.id,
            `it was taken down on copyright notice ${notice.id}`
          );
      }
      const reports = new Set(
        touched.map((row) =>
          row.subjectKind === 'contribution' && row.subjectRef
            ? row.subjectRef
            : row.id
        )
      );
      for (const report of reports)
        await this.corroboration.evaluate(
          report,
          `copyright notice ${notice.id} ${input.action}`
        );
    }
    return { contributions: ids, suspended };
  }

  async counter(request: CounterNoticeRequest): Promise<{ id: string }> {
    const contributor = await this.db
      .getRepository(ContributorEntity)
      .findOneBy({ userId: request.actor.userId });
    const contribution = contributor
      ? await this.db.getRepository(ContributionEntity).findOneBy({
          id: request.contributionId,
          contributorId: contributor.id,
        })
      : null;
    if (!contributor || !contribution)
      throw new NoticeError('That is not one of your contributions.');
    if (contribution.state !== 'taken-down')
      throw new NoticeError('That contribution has not been taken down.');
    const notice = await this.db
      .getRepository(TakedownNoticeEntity)
      .findOneBy({ id: request.noticeId });
    if (!notice || !this.locate(notice.locations).includes(contribution.id))
      throw new NoticeError('That notice does not name this contribution.');
    const problems: string[] = [];
    if (!request.statement?.trim())
      problems.push(
        'Explain why the material was removed by mistake or misidentification.'
      );
    if (!request.underPenalty)
      problems.push('Affirm the statement under penalty of perjury.');
    if (!request.consentToJurisdiction)
      problems.push(
        'Consent to the jurisdiction of the federal court, as the DMCA requires.'
      );
    if (!request.signature?.trim()) problems.push('Sign the counter-notice.');
    if (problems.length) throw new NoticeError(problems.join(' '));
    const saved = await this.db.getRepository(CounterNoticeEntity).save({
      noticeId: notice.id,
      contributionId: contribution.id,
      contributorId: contributor.id,
      statement: request.statement.trim(),
      consentToJurisdiction: true,
      underPenalty: true,
      signature: request.signature.trim(),
    });
    this.logger.warn(
      `counter-notice ${saved.id} on notice ${notice.id}; an operator decides restoration`
    );
    return { id: saved.id };
  }

  /** Contribution ids named in a notice's locations, as ids or within addresses. */
  private locate(locations: readonly string[]): string[] {
    return [
      ...new Set(
        locations.flatMap(
          (location) => location.toLowerCase().match(UUID) ?? []
        )
      ),
    ];
  }
}
