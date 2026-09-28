import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum NexusMilestoneStatus {
  PLANNED = 'planned',
  IN_PROGRESS = 'in_progress',
  DELAYED = 'delayed',
  COMPLETED = 'completed',
}

export enum NexusChangeOrderStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  APPLIED = 'applied',
}

export class ProjectMilestoneDto {
  @ApiProperty()
  @IsUUID()
  id!: string;

  @ApiProperty()
  @IsUUID()
  projectId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  phase!: string;

  @ApiProperty({ enum: NexusMilestoneStatus })
  @IsEnum(NexusMilestoneStatus)
  status!: NexusMilestoneStatus;

  @ApiProperty()
  @IsDateString()
  plannedStart!: string;

  @ApiProperty()
  @IsDateString()
  plannedEnd!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  actualStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  actualEnd?: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  @Max(100)
  progressPercent!: number;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsUUID(undefined, { each: true })
  predecessorIds!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  delayDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  delayed?: boolean;
}

export class CreateMilestoneDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  phase!: string;

  @ApiProperty()
  @IsDateString()
  plannedStart!: string;

  @ApiProperty()
  @IsDateString()
  plannedEnd!: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  predecessorIds?: string[];
}

export class UpdateMilestoneDto {
  @ApiPropertyOptional({ enum: NexusMilestoneStatus })
  @IsOptional()
  @IsEnum(NexusMilestoneStatus)
  status?: NexusMilestoneStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progressPercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  actualStart?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  actualEnd?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class RegisterDrawingDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  title!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  version!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  storageKey!: string;

  @ApiProperty()
  @IsString()
  @Matches(/^[a-f0-9]{64}$/i)
  sha256!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  coiExpiresAt?: string;
}

export class DrawingManifestEntryDto {
  @ApiProperty()
  @IsUUID()
  id!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  title!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  version!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  storageKey!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  sha256!: string;

  @ApiProperty({ enum: ['valid', 'expired', 'missing', 'unverified'] })
  @IsString()
  coiStatus!: string;
}

export class DrawingManifestDto {
  @ApiProperty()
  @IsUUID()
  projectId!: string;

  @ApiProperty({ type: [DrawingManifestEntryDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DrawingManifestEntryDto)
  drawings!: DrawingManifestEntryDto[];
}

export class InspectionPhotoUploadDto {
  @ApiProperty()
  @IsUUID()
  projectId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(128)
  mimeType!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fileBase64!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  capturedAt?: string;
}

export class InspectionPhotoResponseDto {
  @ApiProperty()
  @IsUUID()
  id!: string;

  @ApiProperty()
  @IsUUID()
  projectId!: string;

  @ApiProperty()
  @IsString()
  fileName!: string;

  @ApiProperty()
  @IsString()
  sha256!: string;

  @ApiPropertyOptional()
  @IsOptional()
  gps?: { latitude: number; longitude: number };

  @ApiProperty()
  @IsString()
  antivirusStatus!: string;

  @ApiProperty()
  @IsDateString()
  capturedAt!: string;
}

export class ChangeOrderSignatureDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name!: string;

  @ApiProperty({ enum: ['owner', 'contractor'] })
  @IsString()
  role!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  signaturePng!: string;

  @ApiProperty()
  @IsDateString()
  signedAt!: string;
}

export class ChangeOrderSubmissionDto {
  @ApiProperty()
  @IsUUID()
  projectId!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  @MaxLength(10000)
  description!: string;

  @ApiProperty()
  @IsInt()
  amountCents!: number;

  @ApiProperty({ type: [ChangeOrderSignatureDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChangeOrderSignatureDto)
  signatures!: ChangeOrderSignatureDto[];
}

export class ChangeOrderResponseDto {
  @ApiProperty()
  @IsUUID()
  id!: string;

  @ApiProperty()
  @IsUUID()
  projectId!: string;

  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiProperty()
  @IsInt()
  amountCents!: number;

  @ApiProperty({ enum: NexusChangeOrderStatus })
  @IsEnum(NexusChangeOrderStatus)
  status!: NexusChangeOrderStatus;

  @ApiProperty({ type: [ChangeOrderSignatureDto] })
  @IsArray()
  signatures!: ChangeOrderSignatureDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  documentKey?: string;
}
