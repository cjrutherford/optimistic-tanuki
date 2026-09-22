import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export enum PayoutMethod {
  PAYPAL = 'paypal',
  BANK_TRANSFER = 'bank-transfer',
  VENMO = 'venmo',
  ZELLE = 'zelle',
}

export enum PayoutStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

/**
 * Canonical payout-request read shape. Mirrors
 * `apps/payments/src/entities/payout-request.entity.ts`.
 */
export class PayoutRequestDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  sellerId!: string;

  @ApiProperty()
  @IsNumber()
  amount!: number;

  @ApiProperty({ enum: PayoutStatus, default: PayoutStatus.PENDING })
  @IsEnum(PayoutStatus)
  status!: PayoutStatus;

  @ApiProperty({ enum: PayoutMethod })
  @IsEnum(PayoutMethod)
  payoutMethod!: PayoutMethod;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  payoutEmail?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bankAccountLast4?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bankRoutingLast4?: string;
}

/** `PaymentCommands.UPDATE_SELLER_PAYOUT_INFO`. */
export class UpdateSellerPayoutInfoDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  sellerId!: string;

  @ApiProperty({ enum: PayoutMethod })
  @IsEnum(PayoutMethod)
  payoutMethod!: PayoutMethod;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  payoutEmail?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bankAccountLast4?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bankRoutingLast4?: string;
}

/** `PaymentCommands.CREATE_PAYOUT_REQUEST`. */
export class CreatePayoutRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  sellerId!: string;

  @ApiProperty()
  @IsNumber()
  amount!: number;

  @ApiProperty({ enum: PayoutMethod })
  @IsEnum(PayoutMethod)
  payoutMethod!: PayoutMethod;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  payoutEmail?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bankAccountLast4?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  bankRoutingLast4?: string;
}

/** `PaymentCommands.GET_SELLER_PAYOUT_REQUESTS`. */
export class SellerPayoutRequestsDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  sellerId!: string;
}

/** `PaymentCommands.CANCEL_PAYOUT_REQUEST`. */
export class CancelPayoutRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  payoutRequestId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  sellerId!: string;
}

/** `PaymentCommands.GET_SELLER_WALLET`. */
export class SellerWalletDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  sellerId!: string;
}

/** `PaymentCommands.GET_SELLER_EARNINGS_SUMMARY`. */
export class SellerEarningsSummaryDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  sellerId!: string;
}

/** `PaymentCommands.GET_USER_TRANSACTIONS`. */
export class UserTransactionsDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userId!: string;
}

/** `PaymentCommands.GET_PORTAL_URL`. */
export class PortalUrlDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userId!: string;
}
