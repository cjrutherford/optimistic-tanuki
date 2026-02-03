import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class CreateAccountDto {
  @ApiProperty({ description: 'The name of the account' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: 'The type of the account' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ description: 'The balance of the account' })
  @IsNumber()
  @IsNotEmpty()
  balance: number;

  @ApiProperty({ description: 'The currency of the account' })
  @IsString()
  @IsNotEmpty()
  currency: string;

  @ApiProperty({ description: 'The ID of the user creating the account' })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'The ID of the profile creating the account' })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  profileId: string;

  @ApiProperty({ description: 'App scope for the account' })
  @IsString()
  @IsNotEmpty()
  appScope: string;

  @ApiProperty({ description: 'Description of the account', required: false })
  @IsString()
  @IsOptional()
  description?: string;
}
