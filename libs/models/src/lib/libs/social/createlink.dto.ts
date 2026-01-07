import { ApiProperty } from '@nestjs/swagger';
import { IsUrl, IsUUID, MaxLength } from 'class-validator';

export class CreateLinkDto {
    @ApiProperty({ description: 'The URL of the link', example: 'https://example.com' })
    @IsUrl({}, { message: 'Must be a valid URL' })
    @MaxLength(2048)
    url: string;

    @ApiProperty({ description: 'The ID of the post' })
    @IsUUID()
    postId: string;
}
