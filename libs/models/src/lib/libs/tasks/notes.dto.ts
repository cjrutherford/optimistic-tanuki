
import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";

export declare type NoteStatusString = 'draft' | 'published' | 'archived' | 'deleted' | 'public';

export class CreateNoteDto {

    @ApiProperty()
    userId: string;

    @ApiProperty()
    title: string;

    @ApiProperty()
    description: string;

    @ApiProperty()
    contents: string;

    @ApiProperty()
    taskId: string;
}

// eslint-disable-next-line no-empty
export class UpdateNoteDto extends PartialType(CreateNoteDto){} {}

export class SearchNoteDto {
    @ApiPropertyOptional()
    userId?: string;

    @ApiPropertyOptional()
    title?: string;

    @ApiPropertyOptional()
    description?: string;

    @ApiPropertyOptional()
    contents?: string;

    @ApiPropertyOptional()
    taskId?: string;

    @ApiPropertyOptional()
    status?: NoteStatusString;

    @ApiPropertyOptional()
    filterColumn?: 'createdAt' | 'updatedAt';

    @ApiPropertyOptional()
    filterValue?: string;

    @ApiPropertyOptional()
    filterOperator?: '=' | '!=' | '<' | '>' | '<=' | '>=' | 'LIKE';
}