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
}

export class UpdatePersonaTelosDto extends PartialType(CreatePersonaTelosDto) {
  @ApiProperty()
  @IsUUID()
  id: string;
}

export class QueryPersonaTelsosDto extends PartialType(PersonaTelosDto) {}
