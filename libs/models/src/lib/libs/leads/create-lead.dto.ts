import {
  IsString,
  IsEmail,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsDateString,
  IsArray,
  Min,
} from 'class-validator';
import { LeadSource } from './lead-source.enum';
import { LeadStatus } from './lead-status.enum';
import { LeadContactPoint } from './lead-contact-point.interface';

export class CreateLeadDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  company?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  originalPostingUrl?: string;

  @IsOptional()
  contacts?: LeadContactPoint[];

  @IsEnum(LeadSource)
  source: LeadSource;

  @IsOptional()
  @IsEnum(LeadStatus)
  status?: LeadStatus = LeadStatus.NEW;

  @IsOptional()
  @IsNumber()
  @Min(0)
  value?: number = 0;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsDateString()
  nextFollowUp?: string;

  @IsOptional()
  @IsBoolean()
  isAutoDiscovered?: boolean = false;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  searchKeywords?: string[];

  @IsOptional()
  @IsString()
  assignedTo?: string;
}
