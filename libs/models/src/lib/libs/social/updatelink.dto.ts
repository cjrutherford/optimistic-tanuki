import { ApiProperty } from '@nestjs/swagger';
import { IsUrl, MaxLength } from 'class-validator';

export class UpdateLinkDto {
    @ApiProperty({ description: 'The URL of the link', example: 'https://example.com' })
    @IsUrl({}, { message: 'Must be a valid URL' })
    @MaxLength(2048)
    url: string;
}
