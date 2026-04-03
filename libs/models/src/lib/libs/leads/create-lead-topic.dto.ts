import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  ValidateIf,
} from 'class-validator';
import { LeadDiscoverySource } from './lead-discovery-source.enum';
import { LeadTopicDiscoveryIntent } from './lead-topic-discovery-intent.enum';

export class CreateLeadTopicDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @IsString({ each: true })
  keywords: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludedTerms?: string[];

  @IsOptional()
  @IsEnum(LeadTopicDiscoveryIntent)
  discoveryIntent?: LeadTopicDiscoveryIntent;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(LeadDiscoverySource, { each: true })
  sources?: LeadDiscoverySource[];

  @ValidateIf((topic) =>
    (topic.sources || []).includes(LeadDiscoverySource.GOOGLE_MAPS)
  )
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  googleMapsCities?: string[];

  @ValidateIf((topic) =>
    (topic.sources || []).includes(LeadDiscoverySource.GOOGLE_MAPS)
  )
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  googleMapsTypes?: string[];

  @ValidateIf((topic) =>
    (topic.sources || []).includes(LeadDiscoverySource.GOOGLE_MAPS)
  )
  @IsString()
  googleMapsLocation?: string;

  @ValidateIf((topic) =>
    (topic.sources || []).includes(LeadDiscoverySource.GOOGLE_MAPS)
  )
  @IsInt()
  @IsPositive()
  googleMapsRadiusMiles?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean = true;

  @IsOptional()
  @IsDateString()
  lastRun?: string;

  @IsOptional()
  leadCount?: number = 0;

  @IsOptional()
  @IsInt()
  priority?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetCompanies?: string[];

  @IsOptional()
  @IsString()
  buyerPersona?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  painPoints?: string[];

  @IsOptional()
  @IsString()
  valueProposition?: string;

  @IsOptional()
  @IsEnum(['aggressive', 'balanced', 'conservative'])
  searchStrategy?: 'aggressive' | 'balanced' | 'conservative';

  @IsOptional()
  @IsInt()
  confidence?: number;
}
