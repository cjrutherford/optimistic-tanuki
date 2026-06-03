import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { LeadStatus } from './lead-status.enum';

export class SendLeadResponseDto {
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  toEmail?: string;

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
