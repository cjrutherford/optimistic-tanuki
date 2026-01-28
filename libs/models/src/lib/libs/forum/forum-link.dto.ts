import { ApiProperty } from '@nestjs/swagger';

export class ForumLinkDto {
  @ApiProperty({ description: 'The unique identifier of the link' })
  id: string;

  @ApiProperty({ description: 'The URL of the link' })
  url: string;

  @ApiProperty({ description: 'The title of the link', required: false })
  title?: string;

  @ApiProperty({ description: 'The description of the link', required: false })
  description?: string;

  @ApiProperty({ description: 'The date the link was created' })
  createdAt: Date;
}
