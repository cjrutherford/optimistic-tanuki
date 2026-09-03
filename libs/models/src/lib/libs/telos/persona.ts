import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsArray, IsOptional, IsUUID } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';

export class PersonaTelosDto {
  @ApiProperty()
  @IsString()
  id!: string;

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

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  exampleResponses!: string[];

  @ApiProperty()
  @IsString()
  promptTemplate!: string;

  /**
   * What this persona is allowed to do, as coarse capabilities.
   *
   * Absent on records that predate the column, which means no scope was ever
   * decided and every tool is available. An empty list is a decision: look but
   * do not act.
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  capabilities?: string[] | null;
}

export class CreatePersonaTelosDto {
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

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  exampleResponses!: string[];

  @ApiProperty()
  @IsString()
  promptTemplate!: string;

  /**
   * What this persona is allowed to do, as coarse capabilities.
   *
   * Absent on records that predate the column, which means no scope was ever
   * decided and every tool is available. An empty list is a decision: look but
   * do not act.
   */
  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  capabilities?: string[] | null;
}

export class UpdatePersonaTelosDto extends PartialType(CreatePersonaTelosDto) {
  @ApiProperty()
  @IsUUID()
  id!: string;
}

export class QueryPersonaTelsosDto extends PartialType(PersonaTelosDto) {}
