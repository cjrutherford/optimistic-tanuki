import { ApiProperty } from '@nestjs/swagger';

export class UpdateLinkDto {
    @ApiProperty({ description: 'The URL of the link' })
    url: string;
}
