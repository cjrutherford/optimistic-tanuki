import { ChangeResolution, CreateChangeDto } from './create-change.dto';
import { PartialType } from '@nestjs/mapped-types';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsOptional, IsEnum } from 'class-validator';

export class UpdateChangeDto extends PartialType(CreateChangeDto) {
  @ApiProperty({ description: 'Change ID' })
  @IsUUID()
  id: string;

  @ApiPropertyOptional({
    enum: ChangeResolution,
    description: 'Change resolution',
  })
  @IsOptional()
  @IsEnum(ChangeResolution)
  resolution?: ChangeResolution;
}

export class QueryChangeDto extends PartialType(CreateChangeDto) {
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
