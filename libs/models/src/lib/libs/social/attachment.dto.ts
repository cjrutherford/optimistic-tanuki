import { ApiProperty } from '@nestjs/swagger';

export class AttachmentDto {
    @ApiProperty({ description: 'Unique identifier for the attachment' })
    id: string;

    @ApiProperty({ description: 'Name of the attachment' })
    name: string;

    @ApiProperty({ description: 'URL of the attachment' })
    url: string;

    @ApiProperty({ description: 'Type of the attachment' })
    type: string;

    @ApiProperty({ description: 'Size of the attachment in bytes' })
    size: number;

    @ApiProperty({ description: 'Date when the attachment was created' })
    createdAt: Date;

    @ApiProperty({ description: 'Date when the attachment was last updated' })
    updatedAt: Date;
}