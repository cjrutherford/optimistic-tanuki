import { PartialType } from '@nestjs/mapped-types';
import { CreateTimelineDto } from './create-timeline.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class UpdateTimelineDto extends PartialType(CreateTimelineDto) {
  @ApiProperty({ description: 'ID of the timeline' })
  @IsUUID()
  id: string;
}
