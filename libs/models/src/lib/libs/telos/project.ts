import type { ProfileTelosDto } from './profile';
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsArray, IsUUID } from 'class-validator';
import { Type } from 'class-transformer';
import { PartialType } from '@nestjs/mapped-types';

export class ProjectTelosDto {
    @ApiProperty()
    @IsString()
    id!: string;

    @ApiProperty({ type: () => require('./profile').ProfileTelosDto })
    @Type(() => require('./profile').ProfileTelosDto)
    profile!: ProfileTelosDto;

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
    @IsString()
    overallProjectSummary!: string;
}

export class CreateProjectTelosDto {
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

export class UpdateProjectTelosDto extends PartialType(CreateProjectTelosDto) {
    @ApiProperty()
    @IsUUID()
    id: string;
}

export class QueryProjectTelosDto extends PartialType(ProjectTelosDto) {}
