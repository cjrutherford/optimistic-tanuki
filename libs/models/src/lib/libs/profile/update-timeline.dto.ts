import { PartialType } from '@nestjs/mapped-types';
import { CreateTimelineDto } from './create-timeline.dto';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateTimelineDto extends PartialType(CreateTimelineDto) {
  @ApiProperty({ description: 'ID of the timeline' })
  id: string;
}
