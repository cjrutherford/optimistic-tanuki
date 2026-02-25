import { CreateRiskDto } from './create-risk.dto';
import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsOptional } from 'class-validator';

export class UpdateRiskDto extends PartialType(CreateRiskDto) {
  @ApiProperty({ description: 'Risk ID' })
  @IsUUID()
  id!: string;
}

export class QueryRiskDto extends PartialType(CreateRiskDto) {
  @ApiPropertyOptional({ description: 'Created by user ID' })
  @IsOptional()
  @IsUUID()
  createdBy?: string;

  @ApiPropertyOptional({ description: 'Updated by user ID' })
  @IsOptional()
  @IsUUID()
  updatedBy?: string;

  @ApiPropertyOptional({ type: [Date], description: 'Created at range' })
  @IsOptional()
  createdAt?: [Date, Date];

  @ApiPropertyOptional({ type: [Date], description: 'Updated at range' })
  @IsOptional()
  updatedAt?: [Date, Date];
}
