import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export enum DonationStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Canonical donation read shape (E1). The `payments.donations` table is the
 * single writer; store references it by id.
 */
export class DonationDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  profileId?: string;

  @ApiProperty()
  @IsNumber()
  amount!: number;

  @ApiProperty({ default: false })
  @IsBoolean()
  isRecurring!: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  lemonSqueezyOrderId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  lemonSqueezySubscriptionId?: string;

  @ApiProperty({ enum: DonationStatus, default: DonationStatus.PENDING })
  @IsEnum(DonationStatus)
  status!: DonationStatus;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  createdAt?: Date;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  cancelledAt?: Date;
}

/** `PaymentCommands.GET_DONATION_GOAL` and `LIST_DONATIONS` — month is 1-12. */
export class DonationGoalDto {
  @ApiProperty({ minimum: 1, maximum: 12 })
  @IsNumber()
  @Min(1)
  @Max(12)
  month!: number;

  @ApiProperty()
  @IsNumber()
  year!: number;
}

/** `PaymentCommands.CREATE_DONATION_CHECKOUT`. */
export class CreateDonationCheckoutDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  profileId!: string;

  @ApiProperty()
  @IsNumber()
  amount!: number;

  @ApiProperty()
  @IsBoolean()
  isRecurring!: boolean;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  appScope!: string;
}

/** `PaymentCommands.GET_USER_DONATIONS`. */
export class UserDonationsDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userId!: string;
}

/** `PaymentCommands.CANCEL_SUBSCRIPTION`. */
export class CancelSubscriptionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  subscriptionId!: string;
}

/**
 * `PaymentCommands.RECORD_DONATION` — direct donation insert used by the E2
 * dual-write (gateway creates the canonical payments row first, then the
 * store row with the returned id). Unlike checkout, this mints no provider
 * session: status starts `pending` like checkout-created rows.
 */
export class RecordDonationDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  profileId?: string;

  @ApiProperty()
  @IsNumber()
  amount!: number;

  @ApiProperty({ required: false, default: 'USD' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  anonymous?: boolean;
}
