import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import {
  evaluateGate,
  standingOf,
  type GateMember,
  type GateResult,
  type ReputationEvent,
} from '@optimistic-tanuki/civic-community';
import { In, type DataSource, type EntityManager } from 'typeorm';
import { COMMUNITY_CONFIG, type CommunityConfig } from '../config';
import {
  ArtifactEntity,
  ContributionEntity,
  GateEventEntity,
  ReputationEventEntity,
  ReviewDecisionEntity,
} from './entities';

/**
 * Where a report stands on the community surface, and why.
 *
 * A report and the accepted contributions corroborating it go through the
 * gate (@civic/community). A report that was accepted is `corroborated` or a
 * `single` report; one that was held stays `held` until independent
 * contributions cross the gate *and* one of them carries a document,
 * photograph or recording — evidence, not volume, releases it. Withdrawn,
 * rejected and taken-down reports are `off` the surface.
 *
 * Status is computed from current rows, so a withdrawal or takedown takes
 * effect at once. Each change is appended to `gate_events` with its members'
 * verdicts, and the report's contributor sees it in their review trail.
 */

export type SurfaceStatus =
  | 'single'
  | 'corroborated'
  | 'held'
  | 'released'
  | 'off';

export interface Evaluation {
  status: SurfaceStatus;
  gate: GateResult;
  members: { row: ContributionEntity; member: GateMember }[];
}

const OFF = new Set(['withdrawn', 'rejected', 'taken-down']);

@Injectable()
export class CorroborationService {
  private readonly logger = new Logger(CorroborationService.name);

  constructor(
    @InjectDataSource() private readonly db: DataSource,
    @Inject(COMMUNITY_CONFIG) private readonly config: CommunityConfig
  ) {}

  /**
   * Standing earned on a topic, decayed to today. Nobody starts with any:
   * it moves only when a later record settles one of their reports, which is
   * Phase C's outcome matching.
   */
  async standing(
    contributorId: string,
    topic: string,
    manager: EntityManager = this.db.manager
  ): Promise<number> {
    const rows = await manager.find(ReputationEventEntity, {
      where: { contributorId, topic },
    });
    if (!rows.length) return 0;
    const events: ReputationEvent[] = rows.map((row) => ({
      topic: row.topic,
      delta: row.delta,
      at: row.at,
    }));
    return standingOf(events, topic, new Date(), this.config.standing);
  }

  async compute(
    report: ContributionEntity,
    manager: EntityManager = this.db.manager
  ): Promise<Evaluation> {
    const corroborations = await manager.find(ContributionEntity, {
      where: {
        subjectKind: 'contribution',
        subjectRef: report.id,
        state: 'accepted',
      },
      order: { submittedAt: 'ASC' },
    });
    const rows = [report, ...corroborations];
    const artifactIds = rows
      .map((row) => row.artifactId)
      .filter((id): id is string => id !== null);
    const artifacts = artifactIds.length
      ? await manager.find(ArtifactEntity, { where: { id: In(artifactIds) } })
      : [];
    const shaOf = new Map(
      artifacts.map((artifact) => [artifact.id, artifact.sha256])
    );
    const members = await Promise.all(
      rows.map(async (row) => ({
        row,
        member: {
          id: row.id,
          contributorId: row.contributorId,
          role:
            row.id === report.id
              ? ('report' as const)
              : ('corroboration' as const),
          submittedAt: row.submittedAt,
          official: row.officialStanding !== null,
          disclosedInterest: row.disclosedInterest,
          origin: { network: row.originNetwork, client: row.originClient },
          artifactSha: row.artifactId
            ? shaOf.get(row.artifactId) ?? null
            : null,
          links: row.links,
          standing: await this.standing(
            row.contributorId,
            report.topic,
            manager
          ),
        },
      }))
    );
    const gate = evaluateGate(
      members.map((entry) => entry.member),
      this.config.gate
    );
    let status: SurfaceStatus;
    if (OFF.has(report.state)) status = 'off';
    else if (report.state === 'held')
      status = gate.corroborated && gate.evidenced ? 'released' : 'held';
    else status = gate.corroborated ? 'corroborated' : 'single';
    return { status, gate, members };
  }

  /** Re-evaluates a report, recording and announcing any change in its status. */
  async evaluate(reportId: string, cause: string): Promise<Evaluation | null> {
    return await this.db.transaction(async (manager) => {
      const report = await manager.findOneBy(ContributionEntity, {
        id: reportId,
      });
      if (!report || report.subjectKind === 'contribution') return null;
      const evaluation = await this.compute(report, manager);
      const last = await manager.findOne(GateEventEntity, {
        where: { reportId },
        order: { id: 'DESC' },
      });
      const previous = (last?.status ??
        (report.state === 'held' ? 'held' : 'single')) as SurfaceStatus;
      if (!last || last.status !== evaluation.status) {
        await manager.insert(GateEventEntity, {
          reportId,
          status: evaluation.status,
          mass: evaluation.gate.mass,
          members: evaluation.gate.members,
          cause,
        });
      }
      if (evaluation.status !== previous) {
        const reason = announcement(previous, evaluation.status);
        if (reason) {
          await manager.insert(ReviewDecisionEntity, {
            contributionId: reportId,
            stage: 'corroboration',
            outcome: evaluation.status,
            reasons: [reason],
            model: null,
            promptSha256: null,
            answers: null,
          });
        }
        this.logger.log(
          `report ${reportId}: ${previous} -> ${evaluation.status} (${cause})`
        );
      }
      return evaluation;
    });
  }

  /** The verdict on one corroboration, recorded in its contributor's trail when it is received. */
  async recordVerdict(corroboration: ContributionEntity): Promise<void> {
    if (
      corroboration.subjectKind !== 'contribution' ||
      !corroboration.subjectRef
    )
      return;
    const evaluation = await this.evaluate(
      corroboration.subjectRef,
      `corroboration ${corroboration.id} received`
    );
    const verdict = evaluation?.gate.members.find(
      (member) => member.id === corroboration.id
    );
    if (!verdict) return;
    await this.db.getRepository(ReviewDecisionEntity).insert({
      contributionId: corroboration.id,
      stage: 'corroboration',
      outcome: verdict.counted ? 'counted' : 'not-counted',
      reasons: verdict.reasons,
      model: null,
      promptSha256: null,
      answers: null,
    });
  }
}

function announcement(
  previous: SurfaceStatus,
  next: SurfaceStatus
): string | null {
  if (next === 'corroborated')
    return 'Independent contributions now corroborate this report.';
  if (next === 'released')
    return 'Released: independent contributions, one with a document, photograph or recording, now support this report.';
  if (next === 'single' && previous === 'corroborated')
    return 'It is a single report again: a contribution that corroborated it was withdrawn or taken down.';
  if (next === 'held' && previous === 'released')
    return 'It waits for evidence again: a contribution that supported it was withdrawn or taken down.';
  return null;
}
