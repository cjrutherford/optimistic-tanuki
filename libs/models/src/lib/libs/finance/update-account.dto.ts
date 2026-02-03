import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNumber, IsBoolean, IsOptional } from 'class-validator';

export class UpdateAccountDto {
  @ApiProperty({ description: 'The name of the account', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ description: 'The type of the account', required: false })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiProperty({ description: 'The balance of the account', required: false })
  @IsNumber()
  @IsOptional()
  balance?: number;

  @ApiProperty({ description: 'Description of the account', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Whether the account is active', required: false })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
