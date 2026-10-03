import { ApiProperty } from '@nestjs/swagger';

/**
 * What the local-hub community routes return (plan slices P3.2 and P4.1).
 * The contributions service produces these, the gateway forwards them, and
 * the web client is generated from their OpenAPI schemas. civic-community
 * re-exports them.
 */

/**
 * What a contribution is about. `contribution` is a corroboration: the
 * contributor's own account or artifact in support of another report.
 */
export const SUBJECT_KINDS = [
  'meeting',
  'story',
  'other',
  'contribution',
] as const;
export type SubjectKind = (typeof SUBJECT_KINDS)[number];

export const CONTRIBUTION_KINDS = ['account', 'artifact'] as const;
export type ContributionKind = (typeof CONTRIBUTION_KINDS)[number];

export const CONTRIBUTION_STATES = [
  'accepted',
  'held',
  'rejected',
  'withdrawn',
  'taken-down',
] as const;
export type ContributionState = (typeof CONTRIBUTION_STATES)[number];

export const REVIEW_STAGES = [
  'validation',
  'floor',
  'representations',
  'rate-limit',
  'suspension',
  'upload',
  'duplication',
  'model',
  'withdrawal',
  'takedown',
  'restoration',
  'corroboration',
  'briefing',
] as const;

export const REVIEW_OUTCOMES = [
  'accept',
  'hold',
  'reject',
  'withdrawn',
  'taken-down',
  'restored',
  'counted',
  'not-counted',
  'single',
  'corroborated',
  'held',
  'released',
  'off',
  'quotable',
  'not-quotable',
] as const;

export const OFFICIAL_STANDINGS = [
  'none',
  'submitting-official',
  'official-record',
] as const;
export type OfficialStanding = (typeof OFFICIAL_STANDINGS)[number];

/** Where a record came from, which is how much it is worth as a check. */
export const RECORD_KINDS = [
  /** The town's own paperwork: an agenda, minutes, a vote, a public notice. */
  'record',
  /** A published article from a local publisher. */
  'news',
  /** Material submitted through an official account the operator confirmed by callback. */
  'official-channel',
] as const;
export type RecordKind = (typeof RECORD_KINDS)[number];

export class SubjectOption {
  @ApiProperty({ enum: ['meeting', 'story'] })
  kind!: 'meeting' | 'story';

  /** Stable reference: the meeting's item id, or the story's id. */
  @ApiProperty()
  ref!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ type: String, nullable: true })
  date!: string | null;

  @ApiProperty({ type: String, nullable: true })
  url!: string | null;
}

export class ContributionSubject {
  @ApiProperty({ enum: SUBJECT_KINDS })
  kind!: SubjectKind;

  @ApiProperty({ type: String, nullable: true })
  ref!: string | null;

  @ApiProperty()
  text!: string;
}

export class ArtifactSummary {
  @ApiProperty()
  sha256!: string;

  @ApiProperty()
  mediaType!: string;

  @ApiProperty()
  bytes!: number;
}

export class ReviewStep {
  @ApiProperty({ enum: REVIEW_STAGES })
  stage!: (typeof REVIEW_STAGES)[number];

  @ApiProperty({ enum: REVIEW_OUTCOMES })
  outcome!: (typeof REVIEW_OUTCOMES)[number];

  @ApiProperty({ type: [String] })
  reasons!: string[];

  @ApiProperty()
  at!: string;
}

export class ContributionView {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  localitySlug!: string;

  @ApiProperty({ enum: CONTRIBUTION_KINDS })
  kind!: ContributionKind;

  @ApiProperty({ type: ContributionSubject })
  subject!: ContributionSubject;

  /** The calendar day the reported event happened, YYYY-MM-DD. */
  @ApiProperty({ type: String, nullable: true })
  occurredOn!: string | null;

  @ApiProperty()
  body!: string;

  @ApiProperty({ type: [String] })
  links!: string[];

  @ApiProperty({ type: String, nullable: true })
  disclosedInterest!: string | null;

  @ApiProperty({ type: ArtifactSummary, nullable: true })
  artifact!: ArtifactSummary | null;

  @ApiProperty({ enum: CONTRIBUTION_STATES })
  state!: ContributionState;

  /** Every step the contribution went through, oldest first, with its reasons. */
  @ApiProperty({ type: [ReviewStep] })
  review!: ReviewStep[];

  @ApiProperty()
  submittedAt!: string;
}

export class OfficialApplicationResult {
  @ApiProperty()
  granted!: boolean;

  @ApiProperty({ enum: OFFICIAL_STANDINGS })
  standing!: OfficialStanding;

  @ApiProperty({ type: [String] })
  reasons!: string[];

  /** The roster entry matched, when one was. */
  @ApiProperty({ type: String, nullable: true })
  office!: string | null;
}

export class PublicSubject {
  @ApiProperty({ enum: SUBJECT_KINDS })
  kind!: SubjectKind;

  @ApiProperty()
  text!: string;
}

export class ContributorRef {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  handle!: string;
}

/** A contribution as the public sees it: the contributor's own words, under their handle. */
export class PublicContribution {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: CONTRIBUTION_KINDS })
  kind!: ContributionKind;

  @ApiProperty({ type: PublicSubject })
  subject!: PublicSubject;

  @ApiProperty({ type: String, nullable: true })
  occurredOn!: string | null;

  @ApiProperty()
  body!: string;

  @ApiProperty({ type: [String] })
  links!: string[];

  @ApiProperty({ type: String, nullable: true })
  disclosedInterest!: string | null;

  @ApiProperty({ type: ArtifactSummary, nullable: true })
  artifact!: ArtifactSummary | null;

  @ApiProperty({ type: ContributorRef })
  contributor!: ContributorRef;

  @ApiProperty()
  submittedAt!: string;
}

/** What a later record said about a report, shown with the record named. */
export class OutcomeNote {
  @ApiProperty({ enum: ['confirmed', 'contradicted'] })
  verdict!: 'confirmed' | 'contradicted';

  @ApiProperty({ enum: RECORD_KINDS })
  kind!: RecordKind;

  @ApiProperty()
  title!: string;

  @ApiProperty({ type: String, nullable: true })
  date!: string | null;

  @ApiProperty({ type: String, nullable: true })
  url!: string | null;

  @ApiProperty({ type: String, nullable: true })
  publisher!: string | null;

  @ApiProperty()
  reason!: string;
}

/**
 * A report on the community surface. Its state is shown, never a tally: a
 * `single` report, or `corroborated` with the independent contributions that
 * corroborate it, each quoted in full and attributed.
 */
export class SurfaceItem extends PublicContribution {
  @ApiProperty({ enum: ['single', 'corroborated'] })
  status!: 'single' | 'corroborated';

  /** Held for review and released by evidence: a document, photograph or recording among its corroborations. */
  @ApiProperty()
  releasedByEvidence!: boolean;

  @ApiProperty({ type: [PublicContribution] })
  corroborations!: PublicContribution[];

  /** What later records said, when any settled it: the Phase C outcome. */
  @ApiProperty({ type: [OutcomeNote] })
  outcomes!: OutcomeNote[];
}

/** Material from a verified official, labeled with exactly what was checked and when. */
export class OfficialItem extends PublicContribution {
  @ApiProperty()
  label!: string;

  @ApiProperty()
  officialRecord!: boolean;
}

export class CommunitySurface {
  @ApiProperty({ type: [SurfaceItem] })
  items!: SurfaceItem[];

  @ApiProperty({ type: [OfficialItem] })
  official!: OfficialItem[];
}

/** How a contributor's reports have fared against the record: counts, never a score. */
export class ContributorHistory {
  @ApiProperty()
  confirmed!: number;

  @ApiProperty()
  contradicted!: number;

  @ApiProperty()
  pending!: number;
}

export class CorroboratedReport {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  subject!: string;

  @ApiProperty()
  localitySlug!: string;
}

export class Corroboration {
  @ApiProperty({ type: CorroboratedReport })
  report!: CorroboratedReport;

  @ApiProperty({ type: PublicContribution })
  contribution!: PublicContribution;
}

/** What a contributor's page shows, as the gateway returns it. */
export class ContributorPage {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  handle!: string;

  /** From the contributor's local-hub profile; empty when unavailable. */
  @ApiProperty()
  bio!: string;

  @ApiProperty({ type: String, nullable: true })
  official!: string | null;

  @ApiProperty({ type: [SurfaceItem] })
  reports!: SurfaceItem[];

  @ApiProperty({ type: [Corroboration] })
  corroborated!: Corroboration[];

  @ApiProperty({ type: ContributorHistory })
  history!: ContributorHistory;
}

/** A contributor's page as the service builds it: the gateway swaps the profile id for the bio. */
export type ContributorPageView = Omit<ContributorPage, 'bio'> & {
  profileId: string;
};

/** How many people are watching one town, and what they cover. */
export class TownDensity {
  @ApiProperty()
  localitySlug!: string;

  @ApiProperty()
  town!: string;

  /** Distinct contributors with a contribution in the active window. */
  @ApiProperty()
  active!: number;

  /** Everyone who has ever contributed here. */
  @ApiProperty()
  everContributed!: number;

  /** Contributions in the active window, by kind. */
  @ApiProperty()
  reports!: number;

  @ApiProperty()
  corroborations!: number;

  /** Reports the gate opened for, and reports a briefing may quote. */
  @ApiProperty()
  corroborated!: number;

  @ApiProperty()
  quotable!: number;

  /** What later records said about this town's reports. */
  @ApiProperty()
  confirmed!: number;

  @ApiProperty()
  contradicted!: number;

  /** Meetings published in the window, and how many drew a contribution. */
  @ApiProperty()
  meetings!: number;

  @ApiProperty()
  meetingsWithContributions!: number;

  /** Officials confirmed by callback. */
  @ApiProperty()
  officials!: number;
}

/** The signed-in account's standing in local-hub (`GET local-hub/me`). */
export class LocalHubMembership {
  @ApiProperty()
  profileId!: string;

  @ApiProperty()
  handle!: string;

  @ApiProperty()
  emailVerified!: boolean;

  @ApiProperty({ type: [String] })
  roles!: string[];

  @ApiProperty({ type: [String] })
  permissions!: string[];
}

/** A copyright notice as the operator reviews it, with the contributions it locates. */
export class TakedownNoticeRecord {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  claimantName!: string;

  @ApiProperty()
  claimantEmail!: string;

  @ApiProperty()
  claimantAddress!: string;

  @ApiProperty()
  work!: string;

  @ApiProperty({ type: [String] })
  locations!: string[];

  @ApiProperty()
  goodFaith!: boolean;

  @ApiProperty()
  accurateUnderPenalty!: boolean;

  @ApiProperty()
  signature!: string;

  /** received, upheld or declined. */
  @ApiProperty()
  state!: string;

  @ApiProperty()
  receivedAt!: string;

  @ApiProperty({ type: [String] })
  contributionIds!: string[];
}
