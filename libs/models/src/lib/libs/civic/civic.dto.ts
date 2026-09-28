import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum CivicMeetingBody {
  CITY_COUNCIL = 'city-council',
  PLANNING_COMMISSION = 'planning-commission',
}

export enum CivicBroadcastSeverity {
  ADVISORY = 'advisory',
  WATCH = 'watch',
  WARNING = 'warning',
  EMERGENCY = 'emergency',
}

export class CivicAgendaItemDto {
  @ApiProperty()
  @IsUUID()
  id!: string;

  @ApiProperty()
  @IsUUID()
  agendaId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  itemNumber?: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  summary!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  pageRef?: number;
}

export class CivicAgendaDto {
  @ApiProperty()
  @IsUUID()
  id!: string;

  @ApiProperty({ enum: CivicMeetingBody })
  @IsEnum(CivicMeetingBody)
  meetingBody!: CivicMeetingBody;

  @ApiProperty()
  @IsDateString()
  meetingDate!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  title!: string;

  @ApiProperty({ type: [CivicAgendaItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CivicAgendaItemDto)
  items!: CivicAgendaItemDto[];
}

export class IngestAgendaDto {
  @ApiProperty({ enum: CivicMeetingBody })
  @IsEnum(CivicMeetingBody)
  meetingBody!: CivicMeetingBody;

  @ApiProperty()
  @IsDateString()
  meetingDate!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  title!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fileName!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fileBase64!: string;
}

export class ImportAgendaSourceDto {
  @ApiProperty({
    description: 'ID of an HTTPS PDF source configured by Civic.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  sourceId!: string;

  @ApiProperty({ enum: CivicMeetingBody })
  @IsEnum(CivicMeetingBody)
  meetingBody!: CivicMeetingBody;

  @ApiProperty()
  @IsDateString()
  meetingDate!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  title!: string;
}

export class TipProjectSpatialDto {
  @ApiProperty()
  @IsUUID()
  id!: string;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  name!: string;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiProperty()
  @IsObject()
  geometry!: Record<string, unknown>;

  @ApiProperty()
  @IsInt()
  @Min(0)
  fundingAllocatedCents!: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  fundingSpentCents!: number;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  status!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  milestone?: string;
}

export class RegisterTipProjectDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  name!: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  description!: string;

  @ApiProperty()
  @IsObject()
  geometry!: Record<string, unknown>;

  @ApiProperty()
  @IsInt()
  @Min(0)
  fundingAllocatedCents!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  fundingSpentCents?: number;

  @ApiProperty()
  @IsString()
  @MaxLength(64)
  status!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  milestone?: string;
}

export class EmergencyBroadcastDto {
  @ApiProperty()
  @IsUUID()
  id!: string;

  @ApiProperty({ enum: CivicBroadcastSeverity })
  @IsEnum(CivicBroadcastSeverity)
  severity!: CivicBroadcastSeverity;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  headline!: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  body!: string;

  @ApiProperty()
  @IsDateString()
  issuedAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  audience?: string;
}

export class PublishBroadcastDto {
  @ApiProperty({ enum: CivicBroadcastSeverity })
  @IsEnum(CivicBroadcastSeverity)
  severity!: CivicBroadcastSeverity;

  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  headline!: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  body!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  audience?: string;
}
