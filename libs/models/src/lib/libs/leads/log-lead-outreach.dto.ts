import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { LeadStatus } from './lead-status.enum';

/**
 * Recording a message the user sent themselves, from their own mail client.
 *
 * Distinct from `SendLeadResponseDto` because nothing is being delivered here:
 * there is no recipient to validate and no delivery that can fail. What the two
 * share is the trail they leave on the lead, so that a message written in the
 * app and sent by hand is as visible in the notes and the pipeline as one the
 * app delivered itself.
 */
export class LogLeadOutreachDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  subject!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(12000)
  message!: string;

  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus;

  @IsOptional()
  @IsDateString()
  nextFollowUp?: string;
}
