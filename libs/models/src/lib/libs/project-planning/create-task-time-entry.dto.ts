import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsUUID,
  IsOptional,
  IsString,
  MaxLength,
  IsDate,
} from 'class-validator';

export class CreateTaskTimeEntryDto {
  @ApiProperty({ description: 'Task ID for the time entry' })
  @IsUUID()
  taskId!: string;

  @ApiProperty({
    description: 'Optional description for this time entry',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  /**
   * Who is recording the time.
   *
   * Optional because the gateway sets it from the session and overwrites
   * whatever arrived, so requiring it only meant a caller had to send a value
   * that was then ignored. Identity belongs to the session, never the body.
   */
  @ApiPropertyOptional({ description: 'Set from the session by the gateway' })
  @IsOptional()
  @IsUUID()
  createdBy?: string;

  /**
   * When the work started, for an entry being recorded after the fact.
   *
   * Required once, and the service overwrote it with the current time anyway,
   * so a caller had to send a value that did nothing and was refused without
   * it. Starting a timer now is the ordinary case and needs no start time.
   */
  @ApiPropertyOptional({
    description: 'When the work started. Defaults to now.',
  })
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  startTime?: Date;
}
