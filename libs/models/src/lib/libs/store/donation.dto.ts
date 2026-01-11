import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export class CreateDonationDto {
  @ApiProperty({ description: 'User ID making the donation', required: false })
  @IsOptional()
  @IsUUID()
  userId?: string;
  @ApiProperty({ description: 'Amount of the dontation' })
  @IsNumber()
  amount: number;
  @ApiProperty({ description: 'Currency of the donation', required: false })
  @IsOptional()
  @IsString()
  currency?: string;
  @ApiProperty({
    description: 'Optional message with the donation',
    required: false,
  })
  @IsOptional()
  @IsString()
  message?: string;
  @ApiProperty({ description: 'Is the donation anonymous', required: false })
  @IsOptional()
  @IsBoolean()
  anonymous?: boolean;
}
