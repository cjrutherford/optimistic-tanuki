import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { BillingScope, ScopedBillingRecord } from './billing-scope';

export type BillingSubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled';

export interface BillingSubscription extends ScopedBillingRecord {
  accountId: string;
  planId: string;
  priceId: string;
  status: BillingSubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
}

export class CreateBillingSubscriptionDto implements BillingScope {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  tenantId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  appScope!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  accountId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  planId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  priceId!: string;
}

export class BillingSubscriptionRefDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  id!: string;
}

/**
 * `SUBSCRIPTION_CREATE_FROM_PRODUCT` — store-originated subscription.
 * Billing resolves `productId` via the override mapping table, else derives
 * `store:<productId>` plan/price ids. `accountId` is the caller's user id
 * until finance account provisioning exists (documented limitation).
 */
export class CreateSubscriptionFromProductDto implements BillingScope {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  tenantId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  appScope!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  accountId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  productId!: string;

  @ApiProperty({ required: false, default: 'monthly' })
  @IsOptional()
  @IsString()
  interval?: string;
}
