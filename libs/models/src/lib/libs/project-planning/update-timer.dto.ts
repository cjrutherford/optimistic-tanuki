import { PartialType } from '@nestjs/mapped-types';
import { CreateTimerDto } from './create-timer.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class UpdateTimerDto extends PartialType(CreateTimerDto) {
  @ApiProperty({ description: 'Timer ID' })
  @IsUUID()
  id!: string;
}
