import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, IsEnum, MaxLength } from 'class-validator';

export enum AttachmentType {
    IMAGE = 'IMAGE',
    VIDEO = 'VIDEO',
    AUDIO = 'AUDIO',
    DOCUMENT = 'DOCUMENT',
}

export class SearchAttachmentDto {
    @ApiPropertyOptional({ description: 'Used as text search of the attachment file path.' })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    filePath?: string;

    @ApiPropertyOptional({ description: 'Used as text search of the attachment type.', enum: AttachmentType })
    @IsOptional()
    @IsEnum(AttachmentType)
    type?: AttachmentType;

    @ApiPropertyOptional({ description: 'Used as text search of the attachment description.' })
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    description?: string;

    @ApiPropertyOptional({ description: 'Used as text search of the attachment name.' })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    name?: string;
}