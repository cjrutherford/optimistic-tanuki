import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';
import type { ProjectTelosDto } from './project';

export class ProfileTelosStatsDto {
  @ApiProperty()
  @IsInt()
  @Min(0)
  strength!: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  dexterity!: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  constitution!: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  intelligence!: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  wisdom!: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  charisma!: number;
}

export class ProfileCharacterSheetDto {
  @ApiProperty()
  @IsString()
  classKey!: string;

  @ApiProperty()
  @IsString()
  classLabel!: string;

  @ApiProperty()
  @IsString()
  archetypeSummary!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  level!: number;

  @ApiProperty({ type: () => ProfileTelosStatsDto })
  @ValidateNested()
  @Type(() => ProfileTelosStatsDto)
  stats!: ProfileTelosStatsDto;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  traits!: string[];
}

export class ProfileTelosSourceFactDto {
  @ApiProperty()
  @IsString()
  sourceType!: string;

  @ApiProperty()
  @IsString()
  sourceId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiProperty()
  @IsString()
  content!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class ProfileTelosDto {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty()
  @IsString()
  profileId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  appScope?: string | null;

  @ApiProperty({ type: () => [require('./project').ProjectTelosDto] })
  @IsArray()
  @Type(() => require('./project').ProjectTelosDto)
  projects!: ProjectTelosDto[];

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  goals!: string[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  skills!: string[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  interests!: string[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  limitations!: string[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  strengths!: string[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  objectives!: string[];

  @ApiProperty()
  @IsString()
  coreObjective!: string;

  @ApiProperty()
  @IsString()
  overallProfileSummary!: string;

  @ApiProperty({ enum: ['pending', 'ready', 'stale', 'failed'] })
  @IsString()
  @IsIn(['pending', 'ready', 'stale', 'failed'])
  generationStatus!: 'pending' | 'ready' | 'stale' | 'failed';

  @ApiPropertyOptional()
  @IsOptional()
  generatedAt?: Date | string | null;

  @ApiPropertyOptional()
  @IsOptional()
  sourceUpdatedAt?: Date | string | null;

  @ApiProperty()
  @IsInt()
  @Min(0)
  sourceCount!: number;

  @ApiProperty({ type: () => ProfileCharacterSheetDto })
  @ValidateNested()
  @Type(() => ProfileCharacterSheetDto)
  characterSheet!: ProfileCharacterSheetDto;
}

export class CreateProfileTelosDto {
  @ApiProperty()
  @IsString()
  profileId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  appScope?: string | null;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  goals!: string[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  skills!: string[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  interests!: string[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  limitations!: string[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  strengths!: string[];

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  objectives!: string[];

  @ApiProperty()
  @IsString()
  coreObjective!: string;

  @ApiProperty()
  @IsString()
  overallProfileSummary!: string;

  @ApiProperty({ enum: ['pending', 'ready', 'stale', 'failed'] })
  @IsString()
  @IsIn(['pending', 'ready', 'stale', 'failed'])
  generationStatus!: 'pending' | 'ready' | 'stale' | 'failed';

  @ApiProperty()
  @IsInt()
  @Min(0)
  sourceCount!: number;

  @ApiProperty({ type: () => ProfileCharacterSheetDto })
  @ValidateNested()
  @Type(() => ProfileCharacterSheetDto)
  characterSheet!: ProfileCharacterSheetDto;

  @ApiPropertyOptional({ type: () => [ProfileTelosSourceFactDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProfileTelosSourceFactDto)
  sourceFacts?: ProfileTelosSourceFactDto[];
}

export class UpdateProfileTelosDto extends PartialType(CreateProfileTelosDto) {
  @ApiProperty()
  @IsUUID()
  id!: string;
}

export class QueryProfileTelosDto extends PartialType(ProfileTelosDto) {}

export class GetProfileTelosByProfileIdDto {
  @ApiProperty()
  @IsString()
  profileId!: string;
}

export class UpsertProfileTelosSourceDto {
  @ApiProperty()
  @IsString()
  profileId!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  appScope?: string | null;

  @ApiProperty()
  @IsString()
  profileName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  occupation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  location?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  interests?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @ApiProperty({ type: () => [ProfileTelosSourceFactDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProfileTelosSourceFactDto)
  facts!: ProfileTelosSourceFactDto[];
}
