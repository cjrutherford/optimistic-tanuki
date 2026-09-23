import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export enum SocialEventStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

export enum SocialEventPrivacy {
  PUBLIC = 'public',
  PRIVATE = 'private',
  COMMUNITY = 'community',
}

/**
 * Canonical social-event shape (E17). Named `SocialEvent` so generated clients
 * cannot confuse it with the blogging `BlogEvent`. Mirrors
 * `apps/social/src/entities/event.entity.ts`.
 */
export class SocialEventDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsDate()
  @Type(() => Date)
  startDate!: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  locationUrl?: string;

  @ApiProperty({ enum: SocialEventPrivacy, default: SocialEventPrivacy.PUBLIC })
  @IsEnum(SocialEventPrivacy)
  privacy!: SocialEventPrivacy;

  @ApiProperty({ enum: SocialEventStatus, required: false })
  @IsOptional()
  @IsEnum(SocialEventStatus)
  status?: SocialEventStatus;
}

/** `EventCommands.CREATE` — creation fields only; status/privacy default server-side. */
export class CreateSocialEventDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsDate()
  @Type(() => Date)
  startDate!: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  endDate?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  location?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  locationUrl?: string;

  @ApiProperty({ required: false, enum: SocialEventPrivacy })
  @IsOptional()
  @IsEnum(SocialEventPrivacy)
  privacy?: SocialEventPrivacy;
}

/** `EventCommands.FIND` — fetch one event by id. */
export class SocialEventRefDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  eventId!: string;
}
