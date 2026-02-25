import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsDate, IsOptional } from 'class-validator';

export class CreateSubscriptionDto {
  @ApiProperty({ description: 'The ID of the user creating the subscription' })
  @IsString()
  userId!: string;

  @ApiProperty({ description: 'The ID of the product being subscribed to' })
  @IsString()
  productId!: string;

  @ApiProperty({
    description: 'The subscription interval (e.g., monthly, yearly)',
  })
  @IsString()
  interval!: string;

  @ApiPropertyOptional({ description: 'The start date of the subscription' })
  @IsOptional()
  @IsDate()
  startDate?: Date;
}

export class UpdateSubscriptionDto {
  @ApiPropertyOptional({ description: 'The status of the subscription' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'The end date of the subscription' })
  @IsOptional()
  @IsDate()
  endDate?: Date;

  @ApiPropertyOptional({
    description: 'The next billing date of the subscription',
  })
  @IsOptional()
  @IsDate()
  nextBillingDate?: Date;
}
