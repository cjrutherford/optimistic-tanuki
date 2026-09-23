import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export type SponsorshipType = 'sticky-ad' | 'banner' | 'featured';
export type SponsorshipStatus = 'pending' | 'active' | 'expired' | 'cancelled';

/**
 * Canonical sponsorship CONTENT read shape (E14/E15 target).
 *
 * Field split: tiers, ad content, and scheduling live here; charge capture
 * (`lemonSqueezyOrderId`, `amount` settlement) stays payments-side and is
 * referenced by id. Mirrors
 * `apps/payments/src/entities/community-sponsorship.entity.ts` (content
 * subset) — the E14 backfill maps these columns 1:1.
 */
export class SponsorshipContentDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  communityId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  businessPageId?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({ enum: ['sticky-ad', 'banner', 'featured'] })
  @IsIn(['sticky-ad', 'banner', 'featured'])
  type!: SponsorshipType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  adContent?: string;

  @ApiProperty({ enum: ['pending', 'active', 'expired', 'cancelled'] })
  @IsIn(['pending', 'active', 'expired', 'cancelled'])
  status!: SponsorshipStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startsAt?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  expiresAt?: Date;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  months?: number;
}

/** `GET sponsorship/:communityId/active` future shape — community + active only. */
export class ActiveSponsorshipsDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  communityId!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumber()
  limit?: number;
}

/** `BusinessContentCommands.SPONSORSHIP_ACTIVE` — shares the active shape. */
export class CommunitySponsorshipsDto extends ActiveSponsorshipsDto {}

/** `BusinessContentCommands.SPONSORSHIP_USER`. */
export class UserSponsorshipsDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userId!: string;
}

/** `BusinessContentCommands.SPONSORSHIP_CREATE` — dual-write target. */
export class CreateSponsorshipContentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  communityId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty({ enum: ['sticky-ad', 'banner', 'featured'] })
  @IsIn(['sticky-ad', 'banner', 'featured'])
  type!: SponsorshipType;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  businessPageId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  adContent?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsInt()
  @Min(1)
  months?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  paymentsSponsorshipId?: string;
}
