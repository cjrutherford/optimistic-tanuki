import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  Min,
  registerDecorator,
  ValidateIf,
  ValidateNested,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

export const FLOW_SIZES = [
  'compact',
  'midsize',
  'large',
  'commercial',
] as const;
export type FlowSize = (typeof FLOW_SIZES)[number];

export const FLOW_CONDITIONS = [
  'light',
  'moderate',
  'heavy',
  'severe',
] as const;
export type FlowCondition = (typeof FLOW_CONDITIONS)[number];

export const FLOW_SYNC_ITEM_TYPES = [
  'booking',
  'estimate',
  'completion_note',
  'photo',
  'payment',
  'availability',
  'status',
] as const;
export type FlowSyncItemType = (typeof FLOW_SYNC_ITEM_TYPES)[number];

const FLOW_PHONE_PATTERN = /^[+()0-9 .-]{7,}$/;

@ValidatorConstraint({ name: 'isAbsent', async: false })
class IsAbsentConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    return !Object.prototype.hasOwnProperty.call(args.object, args.property);
  }
}

export function IsAbsent(
  validationOptions?: ValidationOptions
): PropertyDecorator {
  return (object: object, propertyName: string | symbol): void => {
    registerDecorator({
      constraints: [],
      options: validationOptions,
      validator: IsAbsentConstraint,
      target: object.constructor,
      propertyName: propertyName.toString(),
    });
  };
}

const FLOW_SYNC_FORBIDDEN_PAYMENT_KEYS = new Set([
  'pan',
  'card',
  'cardnumber',
  'cardnumbermasked',
  'cardmasked',
  'cardtoken',
  'cvc',
  'cvv',
  'expiration',
  'expirationdate',
  'expiry',
  'expirydate',
  'exp',
  'paymentmethod',
  'paymentmethodid',
  'paymentmethodtoken',
  'paymenttoken',
]);

function normalizeFlowSyncKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function containsForbiddenPaymentField(
  value: unknown,
  paymentContext: boolean,
  visited: WeakSet<object> = new WeakSet<object>()
): boolean {
  if (!value || typeof value !== 'object') return false;
  if (visited.has(value)) return false;
  visited.add(value);
  if (Array.isArray(value)) {
    return value.some((entry) =>
      containsForbiddenPaymentField(entry, paymentContext, visited)
    );
  }
  return Object.entries(value as Record<string, unknown>).some(
    ([key, entry]) => {
      const normalizedKey = normalizeFlowSyncKey(key);
      const nestedPaymentContext =
        paymentContext ||
        normalizedKey === 'payment' ||
        normalizedKey === 'billing';
      if (
        FLOW_SYNC_FORBIDDEN_PAYMENT_KEYS.has(normalizedKey) ||
        (normalizedKey === 'number' && nestedPaymentContext)
      ) {
        return true;
      }
      return containsForbiddenPaymentField(
        entry,
        nestedPaymentContext,
        visited
      );
    }
  );
}

@ValidatorConstraint({ name: 'safeFlowSyncPayload', async: false })
class SafeFlowSyncPayloadConstraint implements ValidatorConstraintInterface {
  validate(value: unknown, args: ValidationArguments): boolean {
    const type = (args.object as Record<string, unknown>)['type'];
    return !containsForbiddenPaymentField(value, type === 'payment');
  }
}

export function IsSafeFlowSyncPayload(
  validationOptions?: ValidationOptions
): PropertyDecorator {
  return (object: object, propertyName: string | symbol): void => {
    registerDecorator({
      constraints: [],
      options: validationOptions,
      validator: SafeFlowSyncPayloadConstraint,
      target: object.constructor,
      propertyName: propertyName.toString(),
    });
  };
}

@ValidatorConstraint({ name: 'exactlyOneBookingIdentifier', async: false })
class ExactlyOneBookingIdentifierConstraint
  implements ValidatorConstraintInterface
{
  validate(_value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as Record<string, unknown>;
    const bookingPresent =
      Object.prototype.hasOwnProperty.call(dto, 'bookingId') &&
      dto['bookingId'] !== undefined;
    const trackingPresent =
      Object.prototype.hasOwnProperty.call(dto, 'trackingCode') &&
      dto['trackingCode'] !== undefined;
    const bookingValid =
      typeof dto['bookingId'] === 'string' &&
      dto['bookingId'].trim().length > 0;
    const trackingValid =
      typeof dto['trackingCode'] === 'string' &&
      dto['trackingCode'].trim().length > 0;
    return (
      bookingPresent !== trackingPresent &&
      (bookingPresent ? bookingValid : trackingValid)
    );
  }
}

export function IsExactlyOneBookingIdentifier(
  validationOptions?: ValidationOptions
): PropertyDecorator {
  return (object: object, propertyName: string | symbol): void => {
    registerDecorator({
      constraints: [],
      options: validationOptions,
      validator: ExactlyOneBookingIdentifierConstraint,
      target: object.constructor,
      propertyName: propertyName.toString(),
    });
  };
}

export class CreateEstimateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  serviceId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  servicePackage: string;

  @IsIn(FLOW_SIZES)
  size: FlowSize;

  @IsIn(FLOW_CONDITIONS)
  condition: FlowCondition;

  @IsOptional()
  @IsNumber()
  @Min(1)
  squareFootage?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  tradeType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  serviceTier?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  units?: number;

  @IsOptional()
  @IsIn(FLOW_CONDITIONS)
  surfaceCondition?: FlowCondition;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  addons?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @IsAbsent()
  tenantId?: string;
}

export class EstimateResultDto {
  @IsString()
  @IsNotEmpty()
  estimateId: string;

  @IsString()
  @IsNotEmpty()
  serviceId: string;

  @IsString()
  @IsNotEmpty()
  serviceName: string;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  basePrice: number;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  conditionMultiplier: number;

  @IsNumber()
  subtotal: number;

  @IsNumber()
  taxAmount: number;

  @IsNumber()
  depositRequired: number;

  @IsNumber()
  total: number;

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsString()
  @IsNotEmpty()
  expiresAt: string;
}

export class CreateBookingDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  estimateId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  serviceId: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  servicePackage?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  customerName: string;

  @IsString()
  @IsNotEmpty()
  @Matches(FLOW_PHONE_PATTERN)
  @MaxLength(40)
  customerPhone: string;

  @IsEmail()
  @IsNotEmpty()
  @MaxLength(254)
  customerEmail: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(240)
  serviceAddress: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  gateCode?: string;

  @IsDateString()
  scheduledDate: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  arrivalWindow: string;

  @IsAbsent()
  serviceName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photoUrls?: string[];

  @IsAbsent()
  tenantId?: string;

  @IsAbsent()
  totalAmount?: number;

  @IsAbsent()
  depositAmount?: number;
}

export class CreateDepositDto {
  @ValidateIf((dto: CreateDepositDto) => !dto.trackingCode)
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  bookingId?: string;

  @ValidateIf((dto: CreateDepositDto) => !dto.bookingId)
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  trackingCode?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  @IsExactlyOneBookingIdentifier()
  idempotencyKey: string;

  @IsAbsent()
  amount?: number;

  @IsAbsent()
  currency?: string;

  @IsAbsent()
  customerEmail?: string;

  @IsAbsent()
  customerPhone?: string;

  @IsAbsent()
  paymentMethodId?: string;
}

export class DepositPaymentDto extends CreateDepositDto {}

export class GetFlowStatusDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  id: string;
}

export class CreateFlowAvailabilityDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  serviceId: string;

  @IsAbsent()
  tenantId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  servicePackage?: string;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsIn(FLOW_SIZES)
  size?: FlowSize;

  @IsOptional()
  @IsIn(FLOW_CONDITIONS)
  condition?: FlowCondition;
}

export class FlowSyncItemDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsIn(FLOW_SYNC_ITEM_TYPES)
  type: FlowSyncItemType;

  @IsObject()
  @IsSafeFlowSyncPayload()
  payload: Record<string, unknown>;

  @IsNumber()
  timestamp: number;

  @IsBoolean()
  synced: boolean;

  @IsInt()
  @Min(0)
  attempts: number;

  @IsString()
  @IsNotEmpty()
  idempotencyKey: string;
}

export class SyncFlowDto {
  @IsArray()
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => FlowSyncItemDto)
  items: FlowSyncItemDto[];

  @IsAbsent()
  tenantId?: string;
}

export interface FlowAvailabilityResponse {
  date: string;
  windows: Array<{
    id: string;
    timeSlot: string;
    available: boolean;
  }>;
}

export interface FlowBookingResponse {
  bookingId: string;
  trackingCode?: string;
  status: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  serviceAddress?: string;
  scheduledDate?: string;
  arrivalWindow?: string;
  serviceName?: string;
  totalAmount?: number;
  depositAmount?: number;
  createdAt?: string;
}

export interface FlowPaymentIntentResponse {
  paymentIntentId: string;
  clientSecret?: string;
  status: string;
  amount: number;
  currency: string;
  bookingId?: string;
  trackingCode?: string;
  smsConfirmation?: {
    dispatched: boolean;
    to?: string;
    sid?: string;
    message?: string;
  };
}

export class JobStatusDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  bookingId: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  trackingCode?: string;

  @IsIn(['scheduled', 'en_route', 'in_progress', 'completed', 'cancelled'])
  status: 'scheduled' | 'en_route' | 'in_progress' | 'completed' | 'cancelled';

  @IsString()
  @IsNotEmpty()
  customerName: string;

  @IsOptional()
  @IsString()
  customerPhone?: string;

  @IsString()
  @IsNotEmpty()
  serviceName: string;

  @IsString()
  @IsNotEmpty()
  serviceAddress: string;

  @IsDateString()
  scheduledDate: string;

  @IsString()
  @IsNotEmpty()
  arrivalWindow: string;

  @IsBoolean()
  depositPaid: boolean;

  @IsOptional()
  @IsNumber()
  depositAmount?: number;

  @IsNumber()
  totalAmount: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsBoolean()
  reviewPromptEligible: boolean;

  @IsOptional()
  @IsUrl()
  googleReviewUrl?: string;

  @IsString()
  @IsNotEmpty()
  updatedAt: string;
}

export class CreatePaymentIntentDto extends CreateDepositDto {}

export interface FlowTenantContext {
  tenantId: string;
  tenantContext?: unknown;
}

export type FlowTenantPayload<T extends object> = T & FlowTenantContext;

export class FlowSyncResultDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsBoolean()
  acknowledged: boolean;

  @IsOptional()
  @IsString()
  error?: string;
}

export class FlowSyncResponseDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FlowSyncResultDto)
  results: FlowSyncResultDto[];
}

export type EstimateResponseDto = EstimateResultDto;
export type EstimateResponse = EstimateResultDto;
export type BookingResponseDto = FlowBookingResponse;
export type BookingResponse = FlowBookingResponse;
export type PaymentIntentResponseDto = FlowPaymentIntentResponse;
export type PaymentIntentResponse = FlowPaymentIntentResponse;
export type StatusResponseDto = JobStatusDto;
export type JobStatusResponse = JobStatusDto;
export type FlowEstimateResponse = EstimateResultDto;
export type FlowBookingResult = FlowBookingResponse;
export type FlowPaymentIntent = FlowPaymentIntentResponse;
export type FlowStatusResponse = JobStatusDto;
