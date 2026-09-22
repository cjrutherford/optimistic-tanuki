import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDate,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';

export type BusinessTier = 'basic' | 'pro' | 'enterprise';

/**
 * Canonical business-page CONTENT read shape (E14 target).
 *
 * Field split (decided): content + display-relevant fields live here;
 * provider money state (`lemonSqueezySubscriptionId`, `subscriptionExpiresAt`)
 * stays payments-internal. `tier` and `subscriptionStatus` are included
 * because they drive display (badges, gating copy), not charging.
 * Mirrors `apps/payments/src/entities/business-page.entity.ts` (content
 * subset) — the E14 backfill maps these columns 1:1.
 */
export class BusinessPageContentDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  communityId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  ownerId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  website?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ enum: ['basic', 'pro', 'enterprise'], default: 'basic' })
  @IsIn(['basic', 'pro', 'enterprise'])
  tier!: BusinessTier;

  @ApiProperty({
    enum: ['active', 'inactive', 'cancelled', 'past_due'],
    default: 'inactive',
  })
  @IsIn(['active', 'inactive', 'cancelled', 'past_due'])
  subscriptionStatus!: 'active' | 'inactive' | 'cancelled' | 'past_due';

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  pinnedPostId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isCommunity?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  businessThemeId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  createdAt?: Date;
}

/** `BusinessContentCommands.PAGE_GET` — content read by community. */
export class BusinessPageRefDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  communityId!: string;
}

/** `BusinessContentCommands.PAGE_CREATE` — dual-write target. */
export class CreateBusinessPageContentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  communityId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  ownerId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  tier?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  paymentsBusinessPageId?: string;
}

/** `BusinessContentCommands.PAGE_UPDATE` — owner-scoped patch. */
export class UpdateBusinessPageContentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  communityId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  ownerId!: string;

  @ApiProperty({ type: Object })
  @IsObject()
  data!: Record<string, unknown>;
}

/** `BusinessContentCommands.PAGES_BY_COMMUNITIES` — batch read. */
export class CommunitiesPagesDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  communityIds!: string[];
}

/** `BusinessContentCommands.THEME_GET`. */
export class BusinessThemeRefDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  businessPageId!: string;
}

/** `BusinessContentCommands.THEME_CREATE`. */
export class CreateBusinessThemeDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  businessPageId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  personalityId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  primaryColor?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  accentColor?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  backgroundColor?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  customCss?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  customFontFamily?: string;
}
