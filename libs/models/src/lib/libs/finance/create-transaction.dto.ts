import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsBoolean, IsDate, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class CreateTransactionDto {
  @ApiProperty({ description: 'The amount of the transaction' })
  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @ApiProperty({ description: 'The type of the transaction' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ description: 'The category of the transaction' })
  @IsString()
  @IsNotEmpty()
  category: string;

  @ApiProperty({ description: 'Description of the transaction' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'The ID of the user creating the transaction' })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'The ID of the profile creating the transaction' })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  profileId: string;

  @ApiProperty({ description: 'App scope for the transaction' })
  @IsString()
  @IsNotEmpty()
  appScope: string;

  @ApiProperty({ description: 'The ID of the account associated with the transaction' })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  accountId: string;

  @ApiProperty({ description: 'The date of the transaction' })
  @IsDate()
  @IsNotEmpty()
  transactionDate: Date;

  @ApiProperty({ description: 'Reference for the transaction' })
  @IsString()
  @IsOptional()
  reference?: string;

  @ApiProperty({ description: 'Whether the transaction is recurring' })
  @IsBoolean()
  @IsNotEmpty()
  isRecurring: boolean;
}
