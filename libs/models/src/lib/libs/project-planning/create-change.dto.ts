import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDate,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum Changetype {
  ADDITION = 'ADDITION',
  MODIFICATION = 'MODIFICATION',
  DELETION = 'DELETION',
}

export enum ChangeResolution {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum ChangeStatus {
  PENDING = 'PENDING',
  RESEARCHING = 'RESEARCHING',
  DISCUSSING = 'DISCUSSING',
  DESIGNING = 'DESIGNING',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  IMPLEMENTING = 'IMPLEMENTING',
  COMPLETE = 'COMPLETE',
  DISCARDED = 'DISCARDED',
}

export class CreateChangeDto {
  @ApiProperty({ enum: Changetype, description: 'Type of change' })
  @IsEnum(Changetype)
  changeType!: Changetype;

  @ApiProperty({
    description: 'Description of the change',
    example: 'Add new user authentication feature',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(5000)
  changeDescription!: string;

  @ApiProperty({
    enum: ChangeStatus,
    description: 'Current status of the change',
  })
  @IsEnum(ChangeStatus)
  changeStatus!: ChangeStatus;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description: 'Date of the change',
  })
  @IsDate()
  @Type(() => Date)
  changeDate!: Date;

  /**
   * Who asked for the change.
   *
   * Optional because the gateway sets it from the session and overwrites
   * whatever arrives. Requiring it meant every client had to send a value that
   * was then discarded, and the clients that forgot simply could not create
   * anything. Identity belongs to the session, never the body.
   */
  @ApiPropertyOptional({ description: 'Set from the session by the gateway' })
  @IsOptional()
  @IsUUID()
  requestor?: string;

  /**
   * Who signed the change off.
   *
   * Optional because the gateway sets it from the session and overwrites
   * whatever arrives. Requiring it meant every client had to send a value that
   * was then discarded, and the clients that forgot simply could not create
   * anything. Identity belongs to the session, never the body.
   */
  @ApiPropertyOptional({ description: 'Set from the session by the gateway' })
  @IsOptional()
  @IsUUID()
  approver?: string;

  @ApiProperty({ description: 'Related project ID' })
  @IsString()
  @IsUUID()
  projectId!: string; // manual reference to the Project Entity from the [Project Planning Service] representing a related party to the change
}
