import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsDate, IsOptional } from 'class-validator';

export class UpdateTransactionDto {
  @ApiProperty({ description: 'Description of the transaction', required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'The category of the transaction', required: false })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiProperty({ description: 'The date of the transaction', required: false })
  @IsDate()
  @IsOptional()
  transactionDate?: Date;
}
