import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsNotEmpty, IsString } from 'class-validator';

/**
 * `ResourceCommands.CHECK_RESOURCE_AVAILABILITY` — gateway sends
 * `{ resourceId, ...{ startTime, endTime } }`.
 */
export class CheckResourceAvailabilityDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  resourceId!: string;

  @ApiProperty()
  @IsDate()
  @Type(() => Date)
  startTime!: Date;

  @ApiProperty()
  @IsDate()
  @Type(() => Date)
  endTime!: Date;
}
