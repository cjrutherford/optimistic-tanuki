import type { ProjectTelosDto } from './project';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';

export class ProfileTelosDto {
  @ApiProperty()
  @IsString()
  id!: string;

  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty({ type: () => [require('./project').ProjectTelosDto] })
  @IsArray()
  @Type(() => require('./project').ProjectTelosDto)
  projects!: ProjectTelosDto[];

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  goals!: string[];

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  skills!: string[];

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  interests!: string[];

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  limitations!: string[];

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  strengths!: string[];

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  objectives!: string[];

  @ApiProperty()
  @IsString()
  coreObjective!: string;

  @ApiProperty()
  @IsString()
  overallProfileSummary!: string;
}

export class CreateProfileTelosDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  description!: string;

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  goals!: string[];

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  skills!: string[];

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  interests!: string[];

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  limitations!: string[];

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  strengths!: string[];

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  objectives!: string[];

  @ApiProperty()
  @IsString()
  coreObjective!: string;
}

export class UpdateProfileTelosDto extends PartialType(CreateProfileTelosDto) {
  @ApiProperty()
  @IsUUID()
  id!: string;
}

export class QueryProfileTelosDto extends PartialType(ProfileTelosDto) {}
