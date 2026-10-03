import type {
  ContributionView,
  ReviewStep,
  SubjectKind,
} from '@optimistic-tanuki/models';
import type { Representations } from './representations.js';

// The shapes the routes return live in the shared models library, so the web
// client can use them without this library's code.
export type {
  CommunitySurface,
  ContributionState,
  ContributionView,
  ContributorPageView,
  OfficialApplicationResult,
  OfficialItem,
  OfficialStanding,
  OutcomeNote,
  PublicContribution,
  ReviewStep,
  SubjectKind,
  SubjectOption,
  SurfaceItem,
} from '@optimistic-tanuki/models';

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
  /**
   * The account's local-hub roles, as the gateway resolved them. Required
   * to corroborate: a request without them is refused (D20, fail closed).
   */
  roles?: readonly string[];
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
