import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsBoolean, IsDate, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class AccountDto {
  @ApiProperty({ description: 'The unique identifier of the account' })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  id: string;

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

  @ApiProperty({ description: 'The ID of the user who owns the account' })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: 'The ID of the profile associated with the account' })
  @IsString()
  @IsUUID()
  @IsNotEmpty()
  profileId: string;

  @ApiProperty({ description: 'App scope for the account' })
  @IsString()
  @IsNotEmpty()
  appScope: string;

  @ApiProperty({ description: 'The date the account was created' })
  @IsDate()
  @IsNotEmpty()
  createdAt: Date;

  @ApiProperty({ description: 'The date the account was last updated' })
  @IsDate()
  @IsNotEmpty()
  updatedAt: Date;

  @ApiProperty({ description: 'Whether the account is active' })
  @IsBoolean()
  @IsNotEmpty()
  isActive: boolean;

  @ApiProperty({ description: 'Description of the account' })
  @IsString()
  @IsOptional()
  description?: string;
}
