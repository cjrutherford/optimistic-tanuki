import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsDateString,
  IsIn,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Max,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export const APPROVED_SUPPLIER_VENDORS = [
  'CDW',
  'Newegg Business',
  'Amazon Business',
  'Dell OEM',
] as const;

export type SupplierVendor = (typeof APPROVED_SUPPLIER_VENDORS)[number];

export const SUPPLIER_OFFER_AVAILABILITIES = [
  'in_stock',
  'backorder',
  'out_of_stock',
  'unknown',
] as const;

export type SupplierOfferAvailability =
  (typeof SUPPLIER_OFFER_AVAILABILITIES)[number];

export class CreateSupplierOfferDto {
  @ApiProperty({ enum: APPROVED_SUPPLIER_VENDORS })
  @IsIn(APPROVED_SUPPLIER_VENDORS)
  vendor!: SupplierVendor;

  @ApiProperty()
  @IsString()
  @Length(1, 255)
  sourceId!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 255)
  sourceSku!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 512)
  productName!: string;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  sourceUrl?: string | null;

  @ApiProperty({ required: false, nullable: true, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  hardwarePartId?: string | null;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount!: number;

  @ApiProperty({ example: 'USD' })
  @IsString()
  @Length(3, 3)
  currency!: string;

  @ApiProperty({ enum: SUPPLIER_OFFER_AVAILABILITIES })
  @IsIn(SUPPLIER_OFFER_AVAILABILITIES)
  availability!: SupplierOfferAvailability;

  @ApiProperty({ type: String, format: 'date-time' })
  @IsDateString()
  observedAt!: string;
}

export interface SupplierOffer extends CreateSupplierOfferDto {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Read model for the authenticated owner sourcing workflow. */
export interface SupplierOfferSummary {
  id: string;
  vendor: SupplierVendor;
  sourceChannel: 'live-api' | 'file-import';
  sourceSku: string;
  productName: string;
  sourceUrl: string | null;
  amount: number;
  currency: string;
  availability: SupplierOfferAvailability;
  observedAt: Date;
}

export class SearchAmazonBusinessOffersDto {
  @ApiProperty({ minLength: 2, maxLength: 120 })
  @IsString()
  @Length(2, 120)
  keywords!: string;

  @ApiProperty({ required: false, pattern: '^\\d{5}(?:-\\d{4})?$' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{5}(?:-\d{4})?$/)
  shippingPostalCode?: string;
}

export type CommercialQuoteState =
  | 'issued'
  | 'accepted'
  | 'expired'
  | 'withdrawn';

/** Immutable financial and input snapshot for one issued quote. */
export interface CommercialQuote {
  id: string;
  sourceCost: number;
  currency: string;
  inputs: Record<string, unknown>;
  terms: Record<string, unknown>;
  pricingSnapshot: Record<string, unknown>;
  issuedAt: Date;
  validUntil: Date;
  version: string;
  state: CommercialQuoteState;
  idempotencyKey: string;
  createdAt: Date;
}

export class ImportSupplierOffersDto {
  @ApiProperty({ enum: APPROVED_SUPPLIER_VENDORS })
  @IsIn(APPROVED_SUPPLIER_VENDORS)
  provider!: SupplierVendor;

  @ApiProperty({ enum: ['csv', 'json'] })
  @IsIn(['csv', 'json'])
  format!: 'csv' | 'json';

  @ApiProperty({ maxLength: 1_048_576 })
  @IsString()
  @Length(1, 1_048_576)
  content!: string;
}

export class CommercialQuoteItemDto {
  @ApiProperty()
  @IsString()
  @Length(1, 128)
  offerId!: string;

  @ApiProperty({ minimum: 1, maximum: 1000 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  quantity!: number;
}

export class IssueCommercialQuoteDto {
  @ApiProperty({ enum: ['tier1', 'tier2', 'tier3'] })
  @IsIn(['tier1', 'tier2', 'tier3'])
  tierId!: string;

  @ApiProperty({ type: [CommercialQuoteItemDto], maxItems: 100 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CommercialQuoteItemDto)
  items!: CommercialQuoteItemDto[];

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  monthlyRetainerRevenue!: number;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  monthlyCloudCost!: number;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  monthlySmsCost!: number;

  @ApiProperty({ minimum: 0 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  monthlyNetworkCost!: number;

  @ApiProperty({ minLength: 1, maxLength: 128 })
  @IsString()
  @Length(1, 128)
  idempotencyKey!: string;
}

export class GetCommercialQuoteDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  quoteId!: string;
}

export class AcceptCommercialQuoteDto extends GetCommercialQuoteDto {}

export class GenerateClientDeploymentArtifactsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  quoteId!: string;

  @ApiProperty({ type: String })
  @IsString()
  @Length(1, 255)
  organization!: string;

  @ApiProperty({ type: String })
  @IsString()
  @Length(1, 255)
  contactName!: string;

  @ApiProperty({ pattern: '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$' })
  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/)
  imageTag!: string;

  @ApiProperty()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  gatewayUrl!: string;

  @ApiProperty()
  @IsUrl({ protocols: ['http', 'https', 'ws', 'wss'], require_protocol: true })
  gatewayWsUrl!: string;

  @ApiProperty()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  socketUrl!: string;
}

export interface ClientDeploymentArtifacts {
  'docker-compose.client.yml': string;
  '.env': string;
  'gateway-config.yaml': string;
  'gateway-composition.yaml': string;
  'bootstrap-owner.mjs': string;
  'proposal.md': string;
}

export interface OperatorAccessProbeResult {
  available: true;
  service: 'system-configurator';
}
