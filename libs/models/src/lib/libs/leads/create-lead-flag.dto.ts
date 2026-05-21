import { IsArray, IsOptional, IsString, ArrayMinSize, IsEnum } from 'class-validator';
import { LeadFlagReason } from './lead-flag-reason.enum';

export class CreateLeadFlagDto {
    @IsArray()
    @ArrayMinSize(1)
    @IsEnum(LeadFlagReason, { each: true })
    reasons: LeadFlagReason[];

    @IsOptional()
    @IsString()
    notes?: string;
}