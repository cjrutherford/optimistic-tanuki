import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

/** `PaymentCommands.PROCESS_WEBHOOK` — provider event intake (raw-body HMAC verification stays on the payments path per §8). */
export class ProcessWebhookDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  eventType!: string;

  @ApiProperty({ type: Object })
  @IsObject()
  data!: Record<string, unknown>;
}

/** `PaymentCommands.SYNC_LEMON_SQUEEZY_PRODUCTS`. */
export class SyncProductsDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  appScope?: string;
}

/** `PaymentCommands.GET_USER_PAYMENTS`. */
export class UserPaymentsDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userId!: string;
}

/** `PaymentCommands.GET_PAYMENT`. */
export class GetPaymentDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  paymentId!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  userId!: string;
}
