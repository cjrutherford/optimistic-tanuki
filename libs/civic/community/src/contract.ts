import type { Outcome } from './review.js';
import type { Representations } from './representations.js';
import type { ContributorHistory } from './standing.js';
import type { RecordKind } from './outcome.js';

/**
 * The community service's message contract: the commands the gateway sends
 * over TCP, and their payloads and replies. Shared by both sides, in the
 * manner of upstream's constants and models libraries.
 */

export const CommunityCommands = {
  Subjects: 'Community:Subjects',
  Submit: 'Community:Submit',
  Mine: 'Community:Mine',
  Withdraw: 'Community:Withdraw',
  ApplyOfficial: 'Community:ApplyOfficial',
  ConfirmOfficialCallback: 'Community:ConfirmOfficialCallback',
  FileTakedownNotice: 'Community:FileTakedownNotice',
  ListTakedownNotices: 'Community:ListTakedownNotices',
  ActOnTakedownNotice: 'Community:ActOnTakedownNotice',
  FileCounterNotice: 'Community:FileCounterNotice',
  Surface: 'Community:Surface',
  ContributorPage: 'Community:ContributorPage',
  Artifact: 'Community:Artifact',
  Rereview: 'Community:Rereview',
  SweepOutcomes: 'Community:SweepOutcomes',
  ExportPromotions: 'Community:ExportPromotions',
  Density: 'Community:Density',
} as const;

/** Who is acting, as the gateway established it. Never taken from the request body. */
export interface Actor {
  userId: string;
  profileId: string;
  handle: string;
}

/**
 * What a contribution is about. `contribution` is a corroboration: the
 * contributor's own account or artifact in support of another report.
 */
export type SubjectKind = 'meeting' | 'story' | 'other' | 'contribution';

export interface SubjectOption {
  kind: 'meeting' | 'story';
  /** Stable reference: the meeting's item id, or the story's id. */
  ref: string;
  title: string;
  date: string | null;
  url: string | null;
}

export interface SubmitRequest {
  actor: Actor;
  localitySlug: string;
  kind: 'account' | 'artifact';
  subject: { kind: SubjectKind; ref: string | null; text: string };
  /** The calendar day the reported event happened, YYYY-MM-DD. */
  occurredOn: string | null;
  body: string;
  links: string[];
  disclosedInterest: string | null;
  representations: Representations;
  attachment: { name: string; base64: string } | null;
  /** Chosen by the client; a retried submission with the same key returns the first instead of recording twice. */
  idempotencyKey: string | null;
  /**
   * Keyed hashes of where the submission came from — the network and the
   * client — for the independence test. The gateway computes them; the raw
   * address never reaches the service.
   */
  origin: { network: string; client: string } | null;
  /** From the verified session; part of the verification floor for corroborating. */
  emailVerified: boolean;
}

export type ContributionState =
  | 'accepted'
  | 'held'
  | 'rejected'
  | 'withdrawn'
  | 'taken-down';

export interface ReviewStep {
  stage:
    | 'validation'
    | 'floor'
    | 'representations'
    | 'rate-limit'
    | 'suspension'
    | 'upload'
    | 'duplication'
    | 'model'
    | 'withdrawal'
    | 'takedown'
    | 'restoration'
    | 'corroboration'
    | 'briefing';
  outcome:
    | Outcome
    | 'withdrawn'
    | 'taken-down'
    | 'restored'
    | 'counted'
    | 'not-counted'
    | 'single'
    | 'corroborated'
    | 'held'
    | 'released'
    | 'off'
    | 'quotable'
    | 'not-quotable';
  reasons: string[];
  at: string;
}

export interface ContributionView {
  id: string;
  localitySlug: string;
  kind: 'account' | 'artifact';
  subject: { kind: SubjectKind; ref: string | null; text: string };
  occurredOn: string | null;
  body: string;
  links: string[];
  disclosedInterest: string | null;
  artifact: { sha256: string; mediaType: string; bytes: number } | null;
  state: ContributionState;
  /** Every step the contribution went through, oldest first, with its reasons. */
  review: ReviewStep[];
  submittedAt: string;
}

/**
 * A submission either becomes a contribution, with every review step recorded,
 * or is refused before review — for a missing affirmation, an account limit,
 * or an upload that cannot be accepted — with the reasons, and nothing kept.
 */
export type SubmitResult =
  | { contribution: ContributionView }
  | { refused: { stage: ReviewStep['stage']; reasons: string[] } };

export interface ApplyOfficialRequest {
  actor: Actor;
  /** From the verified session, never from the request body. */
  email: string;
  emailVerified: boolean;
  /** The account's name as registered, compared with the roster. */
  name: string;
  localitySlug: string;
}

export type OfficialStanding =
  | 'none'
  | 'submitting-official'
  | 'official-record';

export interface OfficialApplicationResult {
  granted: boolean;
  standing: OfficialStanding;
  reasons: string[];
  /** The roster entry matched, when one was. */
  office: string | null;
}

export interface TakedownNoticeRequest {
  claimantName: string;
  claimantEmail: string;
  claimantAddress: string;
  /** The copyrighted work, described. */
  work: string;
  /** Contribution ids or addresses on this service. */
  locations: string[];
  /** The statements the DMCA requires, each affirmed. */
  goodFaith: boolean;
  accurateUnderPenalty: boolean;
  signature: string;
}

export interface CounterNoticeRequest {
  actor: Actor;
  noticeId: string;
  contributionId: string;
  statement: string;
  consentToJurisdiction: boolean;
  underPenalty: boolean;
  signature: string;
}

/** A contribution as the public sees it: the contributor's own words, under their handle. */
export interface PublicContribution {
  id: string;
  kind: 'account' | 'artifact';
  subject: { kind: SubjectKind; text: string };
  occurredOn: string | null;
  body: string;
  links: string[];
  disclosedInterest: string | null;
  artifact: { sha256: string; mediaType: string; bytes: number } | null;
  contributor: { id: string; handle: string };
  submittedAt: string;
}

/** What a later record said about a report, shown with the record named. */
export interface OutcomeNote {
  verdict: 'confirmed' | 'contradicted';
  kind: RecordKind;
  title: string;
  date: string | null;
  url: string | null;
  publisher: string | null;
  reason: string;
}

/**
 * A report on the community surface. Its state is shown, never a tally: a
 * `single` report, or `corroborated` with the independent contributions that
 * corroborate it, each quoted in full and attributed.
 */
export interface SurfaceItem extends PublicContribution {
  status: 'single' | 'corroborated';
  /** Held for review and released by evidence: a document, photograph or recording among its corroborations. */
  releasedByEvidence: boolean;
  corroborations: PublicContribution[];
  /** What later records said, when any settled it: the Phase C outcome. */
  outcomes: OutcomeNote[];
}

/** Material from a verified official, labeled with exactly what was checked and when. */
export interface OfficialItem extends PublicContribution {
  label: string;
  officialRecord: boolean;
}

export interface CommunitySurface {
  items: SurfaceItem[];
  official: OfficialItem[];
}

export interface ContributorPageView {
  id: string;
  handle: string;
  /** For the gateway to fetch the public bio; not shown. */
  profileId: string;
  official: string | null;
  reports: SurfaceItem[];
  corroborated: {
    report: { id: string; subject: string; localitySlug: string };
    contribution: PublicContribution;
  }[];
  /** How their reports have fared against the record: counts, never a score. */
  history: ContributorHistory;
}
