import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * The community store, in `daylight_community`.
 *
 * Decisions, official events and copyright actions are append-only, so a
 * contribution's history can be reconstructed exactly as it happened. The
 * contribution row itself carries only its current state beside what was
 * submitted. Contributors are keyed by the authentication service's user id,
 * never by email, so their records survive the move into the destination.
 */

@Entity('contributors')
export class ContributorEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index({ unique: true }) @Column('uuid') userId: string;
  @Column('uuid') profileId: string;
  @Column('text') handle: string;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
  @Column({ type: 'timestamptz', nullable: true }) suspendedAt: Date | null;
  @Column({ type: 'text', nullable: true }) suspendedReason: string | null;
  /** none, submitting-official (domain and roster matched), official-record (callback confirmed). */
  @Column({ type: 'text', default: 'none' }) officialStanding: string;
  @Column({ type: 'text', nullable: true }) officialLocality: string | null;
  @Column({ type: 'text', nullable: true }) officialOffice: string | null;
}

@Entity('contributions')
@Index(['contributorId', 'idempotencyKey'], {
  unique: true,
  where: '"idempotencyKey" IS NOT NULL',
})
export class ContributionEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column('uuid') contributorId: string;
  @Index() @Column('text') localitySlug: string;
  @Column('text') kind: string;
  @Column('text') subjectKind: string;
  @Column({ type: 'text', nullable: true }) subjectRef: string | null;
  @Column('text') subjectText: string;
  @Column({ type: 'date', nullable: true }) occurredOn: string | null;
  /** What was submitted, except for text refused as copied, which is not kept. */
  @Column('text') body: string;
  @Column('text') bodySha256: string;
  @Column('jsonb') links: string[];
  @Column({ type: 'text', nullable: true }) disclosedInterest: string | null;
  /** The subject area standing is earned in, from the desk of what it is about: government, schools, public-safety. */
  @Column({ type: 'text', default: 'government' }) topic: string;
  @Column('jsonb') representations: Record<string, boolean>;
  @Column({ type: 'uuid', nullable: true }) artifactId: string | null;
  /** Official material, from a contributor with official standing for this locality at the time. */
  @Column({ type: 'text', nullable: true }) officialStanding: string | null;
  @Index() @Column('text') state: string;
  @Index() @CreateDateColumn({ type: 'timestamptz' }) submittedAt: Date;
  /** The client's key for this submission, unique per contributor, so a retry is not recorded twice. */
  @Column({ type: 'text', nullable: true }) idempotencyKey: string | null;
  /** Keyed hashes of the submitting network and client, kept for the independence test and purged after the retention period. */
  @Column({ type: 'text', nullable: true }) originNetwork: string | null;
  @Column({ type: 'text', nullable: true }) originClient: string | null;
}

@Entity('artifacts')
export class ArtifactEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  /** Content address: the same file submitted twice is one artifact. */
  @Index({ unique: true }) @Column('text') sha256: string;
  @Column('text') mediaType: string;
  @Column('integer') bytes: number;
  @Column('text') storagePath: string;
  @Column('text') scanner: string;
  @Column({ type: 'timestamptz' }) scannedAt: Date;
  @Column('uuid') firstContributorId: string;
  @CreateDateColumn({ type: 'timestamptz' }) createdAt: Date;
}

@Entity('review_decisions')
export class ReviewDecisionEntity {
  @PrimaryGeneratedColumn('increment') id: number;
  @Index() @Column('uuid') contributionId: string;
  @Column('text') stage: string;
  @Column('text') outcome: string;
  @Column('jsonb') reasons: string[];
  @Column({ type: 'text', nullable: true }) model: string | null;
  @Column({ type: 'text', nullable: true }) promptSha256: string | null;
  @Column({ type: 'jsonb', nullable: true }) answers: object | null;
  @CreateDateColumn({ type: 'timestamptz' }) at: Date;
}

@Entity('official_events')
export class OfficialEventEntity {
  @PrimaryGeneratedColumn('increment') id: number;
  @Index() @Column('uuid') contributorId: string;
  /** domain-verified, refused, callback-confirmed. */
  @Column('text') kind: string;
  @Column('text') localitySlug: string;
  /** What was checked: the domain, the roster entry and where it is published, the number's published source. */
  @Column('jsonb') detail: object;
  /** The operator, for a callback; the service, for the automatic check. */
  @Column('text') by: string;
  @CreateDateColumn({ type: 'timestamptz' }) at: Date;
}

@Entity('takedown_notices')
export class TakedownNoticeEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('text') claimantName: string;
  @Column('text') claimantEmail: string;
  @Column('text') claimantAddress: string;
  @Column('text') work: string;
  @Column('jsonb') locations: string[];
  @Column('boolean') goodFaith: boolean;
  @Column('boolean') accurateUnderPenalty: boolean;
  @Column('text') signature: string;
  /** received, upheld, declined. */
  @Index() @Column({ type: 'text', default: 'received' }) state: string;
  @CreateDateColumn({ type: 'timestamptz' }) receivedAt: Date;
}

@Entity('takedown_actions')
export class TakedownActionEntity {
  @PrimaryGeneratedColumn('increment') id: number;
  @Index() @Column('uuid') noticeId: string;
  /** upheld, declined, restored. */
  @Column('text') action: string;
  @Column('jsonb') contributionIds: string[];
  @Column('text') by: string;
  @Column('text') note: string;
  @CreateDateColumn({ type: 'timestamptz' }) at: Date;
}

@Entity('counter_notices')
export class CounterNoticeEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Index() @Column('uuid') noticeId: string;
  @Column('uuid') contributionId: string;
  @Column('uuid') contributorId: string;
  @Column('text') statement: string;
  @Column('boolean') consentToJurisdiction: boolean;
  @Column('boolean') underPenalty: boolean;
  @Column('text') signature: string;
  @CreateDateColumn({ type: 'timestamptz' }) receivedAt: Date;
}

/** One per contribution taken down on an upheld notice; enough of them suspends the account. */
@Entity('copyright_strikes')
export class CopyrightStrikeEntity {
  @PrimaryGeneratedColumn('increment') id: number;
  @Index() @Column('uuid') contributorId: string;
  @Column('uuid') noticeId: string;
  @Column('uuid') contributionId: string;
  @CreateDateColumn({ type: 'timestamptz' }) at: Date;
}

/**
 * Each change in a report's standing on the community surface, with the
 * members and verdicts that produced it: append-only, so what the surface
 * showed at any time can be reconstructed.
 */
@Entity('gate_events')
export class GateEventEntity {
  @PrimaryGeneratedColumn('increment') id: number;
  @Index() @Column('uuid') reportId: string;
  /** single, corroborated, held, released, off (withdrawn, rejected or taken down). */
  @Column('text') status: string;
  @Column('real') mass: number;
  @Column('jsonb') members: object;
  /** What prompted the evaluation. */
  @Column('text') cause: string;
  @CreateDateColumn({ type: 'timestamptz' }) at: Date;
}

/**
 * What a later record said about a contribution: one row per contribution and
 * record compared, append-only, so a contributor's page can show what settled
 * their report and a verdict can be re-read as it was made.
 */
@Entity('outcome_matches')
@Index(['contributionId', 'recordRef'], { unique: true })
export class OutcomeMatchEntity {
  @PrimaryGeneratedColumn('increment') id: number;
  @Index() @Column('uuid') contributionId: string;
  /** record (the town's paperwork), news (a local publisher), official-channel (a confirmed official's material). */
  @Column('text') recordKind: string;
  @Column('text') recordRef: string;
  @Column('text') recordTitle: string;
  @Column({ type: 'date', nullable: true }) recordDate: string | null;
  @Column({ type: 'text', nullable: true }) recordUrl: string | null;
  @Column({ type: 'text', nullable: true }) recordPublisher: string | null;
  /** confirmed, contradicted, unrelated, unresolved. */
  @Index() @Column('text') verdict: string;
  @Column('jsonb') reasons: string[];
  @Column({ type: 'text', nullable: true }) model: string | null;
  @Column({ type: 'text', nullable: true }) promptSha256: string | null;
  @Column({ type: 'jsonb', nullable: true }) answers: object | null;
  @CreateDateColumn({ type: 'timestamptz' }) at: Date;
}

/**
 * Every movement in a contributor's standing, with what caused it.
 * Append-only: a reversal is another event, never a deletion, so the standing
 * a gate decision rested on can be recomputed for the day it was made.
 */
@Entity('reputation_events')
export class ReputationEventEntity {
  @PrimaryGeneratedColumn('increment') id: number;
  @Index() @Column('uuid') contributorId: string;
  @Index() @Column('text') topic: string;
  @Column('real') delta: number;
  /** confirmed, contradicted, reversed. */
  @Column('text') kind: string;
  @Column({ type: 'uuid', nullable: true }) contributionId: string | null;
  @Column({ type: 'integer', nullable: true }) outcomeMatchId: number | null;
  /** In words the contributor is shown. */
  @Column('text') reason: string;
  @CreateDateColumn({ type: 'timestamptz' }) at: Date;
}

/**
 * Each change in what the service offers a briefing: append-only, so a
 * published edition can be explained afterwards — this is what was quotable,
 * on this day, and this is why it stopped being so.
 */
@Entity('promotion_events')
export class PromotionEventEntity {
  @PrimaryGeneratedColumn('increment') id: number;
  @Index() @Column('uuid') contributionId: string;
  @Index() @Column('text') localitySlug: string;
  /** Whether a briefing may quote it, as of this event. */
  @Column('boolean') offered: boolean;
  /** official-record, authenticated-artifact, confirmed; null when it is not offered. */
  @Column({ type: 'text', nullable: true }) path: string | null;
  @Column('text') reason: string;
  @CreateDateColumn({ type: 'timestamptz' }) at: Date;
}

export const COMMUNITY_ENTITIES = [
  ContributorEntity,
  ContributionEntity,
  ArtifactEntity,
  ReviewDecisionEntity,
  OfficialEventEntity,
  TakedownNoticeEntity,
  TakedownActionEntity,
  CounterNoticeEntity,
  CopyrightStrikeEntity,
  GateEventEntity,
  OutcomeMatchEntity,
  ReputationEventEntity,
  PromotionEventEntity,
];
