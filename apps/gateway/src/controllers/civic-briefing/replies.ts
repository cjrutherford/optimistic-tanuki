import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CommunitySurface,
  ContributionView,
  ContributorPage,
  EditionHistory,
  EditionSummary,
  LocalHubMembership,
  OFFICIAL_STANDINGS,
  OfficialApplicationResult,
  BackfillStatus,
  PipelineHealthReport,
  type OfficialStanding,
  PublishedBriefing,
  SubmissionRequest,
  SubjectOption,
  TakedownNoticeRecord,
  TownDensity,
} from '@optimistic-tanuki/models';

/**
 * The local-hub routes wrap every reply in `{ data }`, as the Daylight POC
 * did. These classes describe the wrappers for the OpenAPI document, from
 * which the web client is generated (P4.1b).
 */

export class EditionListReply {
  @ApiProperty({ type: [EditionSummary] })
  data!: EditionSummary[];
}

export class EditionHistoryReply {
  @ApiProperty({ type: EditionHistory })
  data!: EditionHistory;
}

export class PublishedBriefingReply {
  @ApiProperty({ type: PublishedBriefing })
  data!: PublishedBriefing;
}

export class MembershipReply {
  @ApiProperty({ type: LocalHubMembership })
  data!: LocalHubMembership;
}

export class SubjectOptionsReply {
  @ApiProperty({ type: [SubjectOption] })
  data!: SubjectOption[];
}

export class ContributionReply {
  @ApiProperty({ type: ContributionView })
  data!: ContributionView;
}

export class ContributionListReply {
  @ApiProperty({ type: [ContributionView] })
  data!: ContributionView[];
}

export class CounterNoticeReceipt {
  @ApiProperty()
  id!: string;
}

export class CounterNoticeReply {
  @ApiProperty({ type: CounterNoticeReceipt })
  data!: CounterNoticeReceipt;
}

export class OfficialApplicationReply {
  @ApiProperty({ type: OfficialApplicationResult })
  data!: OfficialApplicationResult;
}

export class CommunitySurfaceReply {
  @ApiProperty({ type: CommunitySurface })
  data!: CommunitySurface;
}

export class ContributorPageReply {
  @ApiProperty({ type: ContributorPage })
  data!: ContributorPage;
}

export class TakedownNoticeReceipt {
  @ApiProperty()
  id!: string;

  /** How many contributions on this service the notice's locations name. */
  @ApiProperty()
  locatedContributions!: number;
}

export class TakedownNoticeReceiptReply {
  @ApiProperty({ type: TakedownNoticeReceipt })
  data!: TakedownNoticeReceipt;
}

/** A submission: the JSON fields as one part, and an optional attachment. */
export class ContributionUpload {
  /** Sent as one JSON part. */
  @ApiProperty({ type: SubmissionRequest })
  submission!: SubmissionRequest;

  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  attachment?: unknown;
}

export class DensityReport {
  @ApiProperty({ type: [TownDensity] })
  rows!: TownDensity[];
}

export class DensityReply {
  @ApiProperty({ type: DensityReport })
  data!: DensityReport;
}

export class OfficialStandingResult {
  @ApiProperty({ enum: OFFICIAL_STANDINGS })
  standing!: OfficialStanding;
}

export class OfficialStandingReply {
  @ApiProperty({ type: OfficialStandingResult })
  data!: OfficialStandingResult;
}

export class TakedownNoticeListReply {
  @ApiProperty({ type: [TakedownNoticeRecord] })
  data!: TakedownNoticeRecord[];
}

export class TakedownActionResult {
  @ApiProperty({ type: [String] })
  contributions!: string[];

  /** Contributors suspended by this decision. */
  @ApiProperty({ type: [String] })
  suspended!: string[];
}

export class TakedownActionReply {
  @ApiProperty({ type: TakedownActionResult })
  data!: TakedownActionResult;
}

export class RereviewResult {
  @ApiProperty()
  changed!: number;
}

export class RereviewReply {
  @ApiProperty({ type: RereviewResult })
  data!: RereviewResult;
}

export class OutcomeSweepResult {
  @ApiProperty()
  compared!: number;

  @ApiProperty()
  confirmed!: number;

  @ApiProperty()
  contradicted!: number;
}

export class OutcomeSweepReply {
  @ApiProperty({ type: OutcomeSweepResult })
  data!: OutcomeSweepResult;
}

export class TownPromotion {
  @ApiProperty()
  localitySlug!: string;

  @ApiProperty()
  quotes!: number;

  @ApiProperty()
  corrections!: number;
}

export class PromotionExportResult {
  @ApiProperty({ type: [TownPromotion] })
  towns!: TownPromotion[];
}

export class PromotionExportReply {
  @ApiProperty({ type: PromotionExportResult })
  data!: PromotionExportResult;
}

export class BackfillStatusReply {
  @ApiProperty({ type: BackfillStatus })
  data!: BackfillStatus;
}

export class PipelineHealthReply {
  @ApiProperty({ type: PipelineHealthReport })
  data!: PipelineHealthReport;
}
