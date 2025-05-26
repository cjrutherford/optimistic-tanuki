import { ApiProperty, ApiPropertyOptional, PartialType } from "@nestjs/swagger";

export declare type TaskStatusString = 'draft' | 'published' | 'archived' | 'deleted' | 'public';

export class CreateTaskDto {
    @ApiProperty()
    title: string;

    @ApiProperty()
    description: string;
}

export class UpdateTaskDto extends PartialType(CreateTaskDto){}

export class SearchTaskDto {
    @ApiPropertyOptional()
    title?: string;

    @ApiPropertyOptional()
    description?: string;

    @ApiPropertyOptional()
    status?: TaskStatusString;

    @ApiPropertyOptional({ enum: ['createdAt', 'updatedAt', 'deletedAt'] })
    filterColumn?: 'createdAt' | 'updatedAt' | 'deletedAt';

    @ApiPropertyOptional()
    filterValue?: string;

    @ApiPropertyOptional({ enum: ['=', '!=', '<', '>', '<=', '>=', 'LIKE'] })
    filterOperator?: '=' | '!=' | '<' | '>' | '<=' | '>=' | 'LIKE';
}

