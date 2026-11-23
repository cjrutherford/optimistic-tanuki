import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * The sources admin for Daylight operators (plan slice SD.6): what discovery
 * decided, the operator's overrides on it, how each source is doing, and
 * readers' requests for sources.
 */

export const SOURCE_OVERRIDE_KINDS = ['block', 'pin'] as const;
export type SourceOverrideKind = (typeof SOURCE_OVERRIDE_KINDS)[number];

export const SOURCE_REQUEST_DECISIONS = ['approved', 'rejected'] as const;
export type SourceRequestDecision = (typeof SOURCE_REQUEST_DECISIONS)[number];

/** The longest reason an operator may record. */
export const MAX_SOURCE_REASON_LENGTH = 500;

export class SourceDecisionEntry {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  slug!: string;

  @ApiProperty({ type: String, nullable: true })
  ownerSlug!: string | null;

  @ApiProperty({ type: String, nullable: true })
  sourceKey!: string | null;

  @ApiProperty({ type: String, nullable: true })
  adapter!: string | null;

  @ApiProperty({ type: String, nullable: true })
  url!: string | null;

  /** adopted or refused by discovery; blocked, unblocked, pinned or unpinned by an operator. */
  @ApiProperty()
  decision!: string;

  @ApiProperty({ type: String, nullable: true })
  via!: string | null;

  @ApiProperty({ type: String, nullable: true })
  reason!: string | null;

  @ApiProperty({ type: [String] })
  evidence!: string[];

  @ApiProperty()
  decidedAt!: string;
}

export class SourceDecisionPage {
  @ApiProperty({ type: [SourceDecisionEntry] })
  items!: SourceDecisionEntry[];

  @ApiProperty()
  total!: number;
}

export class SourceOverride {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  sourceKey!: string;

  @ApiProperty({ enum: SOURCE_OVERRIDE_KINDS })
  kind!: SourceOverrideKind;

  @ApiProperty()
  reason!: string;

  /** The operator's account id. */
  @ApiProperty()
  actor!: string;

  @ApiProperty()
  createdAt!: string;
}

export class SetSourceOverrideBody {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  sourceKey!: string;

  /** block: never adopt it; pin: adopt it even where discovery refused. */
  @ApiProperty({ enum: SOURCE_OVERRIDE_KINDS })
  @IsIn(SOURCE_OVERRIDE_KINDS)
  kind!: SourceOverrideKind;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_SOURCE_REASON_LENGTH)
  reason!: string;
}

export class ClearSourceOverrideBody {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_SOURCE_REASON_LENGTH)
  reason!: string;
}

export const SOURCE_HEALTH_STATUSES = [
  'healthy',
  'quiet',
  'failing',
  'retired',
] as const;
export type SourceHealthStatus = (typeof SOURCE_HEALTH_STATUSES)[number];

export class SourceHealthEntry {
  @ApiProperty()
  sourceKey!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  adapter!: string;

  @ApiProperty({ enum: SOURCE_HEALTH_STATUSES })
  status!: SourceHealthStatus;

  @ApiProperty({ type: String, nullable: true })
  lastAttemptAt!: string | null;

  @ApiProperty({ type: String, nullable: true })
  lastSuccessAt!: string | null;

  @ApiProperty()
  consecutiveFailures!: number;

  @ApiProperty()
  items7d!: number;

  @ApiProperty()
  errors7d!: number;

  @ApiProperty({ type: String, nullable: true })
  newestPublished!: string | null;

  /** The override in force on this source, if any. */
  @ApiPropertyOptional({ enum: SOURCE_OVERRIDE_KINDS })
  override?: SourceOverrideKind;
}

export class SourceHealthReport {
  @ApiProperty()
  slug!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: [SourceHealthEntry] })
  sources!: SourceHealthEntry[];
}

export const SOURCE_REQUEST_STATUSES = [
  'pending',
  'approved',
  'rejected',
] as const;
export type SourceRequestStatus = (typeof SOURCE_REQUEST_STATUSES)[number];

export class SourceRequestEntry {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  townName!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ type: String, nullable: true })
  note!: string | null;

  @ApiProperty({ enum: SOURCE_REQUEST_STATUSES })
  status!: SourceRequestStatus;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty({ type: String, nullable: true })
  decidedBy!: string | null;

  @ApiProperty({ type: String, nullable: true })
  decidedAt!: string | null;

  @ApiProperty({ type: String, nullable: true })
  decisionReason!: string | null;
}

export class SourceRequestPage {
  @ApiProperty({ type: [SourceRequestEntry] })
  items!: SourceRequestEntry[];

  @ApiProperty()
  total!: number;
}

export class DecideSourceRequestBody {
  @ApiProperty({ enum: SOURCE_REQUEST_DECISIONS })
  @IsIn(SOURCE_REQUEST_DECISIONS)
  decision!: SourceRequestDecision;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_SOURCE_REASON_LENGTH)
  reason!: string;
}
