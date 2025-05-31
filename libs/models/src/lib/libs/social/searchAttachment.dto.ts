import { ApiPropertyOptional } from "@nestjs/swagger";

export class SearchAttachmentDto {
    @ApiPropertyOptional({ description: 'Used as text search of the attachment file path.' })
    filePath?: string;

    @ApiPropertyOptional({ description: 'Used as text search of the attachment type.' })
    type?: 'IMAGE' | 'VIDEO' | 'AUDI' | 'DOCUMENT';

    @ApiPropertyOptional({ description: 'Used as text search of the attachment description.' })
    description?: string;

    @ApiPropertyOptional({ description: 'Used as text search of the attachment name.' })
    name?: string;
}