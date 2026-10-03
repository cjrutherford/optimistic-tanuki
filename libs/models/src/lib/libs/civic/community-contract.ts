/**
 * What the local-hub community routes return (plan slices P3.2 and P4.1).
 * The contributions service produces these, the gateway forwards them, and
 * the web client reads them; they live here so the browser bundle needs
 * none of the service's code. civic-community re-exports them.
 */

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
    | 'accept'
    | 'hold'
    | 'reject'
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

export type RecordKind =
  /** The town's own paperwork: an agenda, minutes, a vote, a public notice. */
  | 'record'
  /** A published article from a local publisher. */
  | 'news'
  /** Material submitted through an official account the operator confirmed by callback. */
  | 'official-channel';

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

/** How a contributor's reports have fared against the record: counts, never a score. */
export interface ContributorHistory {
  confirmed: number;
  contradicted: number;
  pending: number;
}

/** A contributor's page as the service builds it. */
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
  history: ContributorHistory;
}

/** A contributor's page as the gateway returns it: the public bio added. */
export interface ContributorPage extends ContributorPageView {
  bio: string;
}

/** How many people are watching one town, and what they cover. */
export interface TownDensity {
  localitySlug: string;
  town: string;
  /** Distinct contributors with a contribution in the active window. */
  active: number;
  /** Everyone who has ever contributed here. */
  everContributed: number;
  /** Contributions in the active window, by kind. */
  reports: number;
  corroborations: number;
  /** Reports the gate opened for, and reports a briefing may quote. */
  corroborated: number;
  quotable: number;
  /** What later records said about this town's reports. */
  confirmed: number;
  contradicted: number;
  /** Meetings published in the window, and how many drew a contribution. */
  meetings: number;
  meetingsWithContributions: number;
  /** Officials confirmed by callback. */
  officials: number;
}

/** The signed-in account's standing in local-hub (`GET local-hub/me`). */
export interface LocalHubMembership {
  profileId: string;
  handle: string;
  emailVerified: boolean;
  roles: string[];
  permissions: string[];
}
