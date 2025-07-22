import { ApiProperty } from '@nestjs/swagger';

export class CreateProjectDto {
    @ApiProperty({ type: String })
    owner: string;

    @ApiProperty({ type: [String] })
    members: string[];

    @ApiProperty({ type: String })
    name: string;

    @ApiProperty({ type: String })
    description: string;

    @ApiProperty({ type: Date })
    startDate: Date;

    @ApiProperty({ type: Date })
    endDate: Date;

    @ApiProperty({ type: String })
    status: string;

    @ApiProperty({ type: String })
    createdBy: string;

    @ApiProperty({ type: Date })
    createdAt: Date;

    @ApiProperty({ type: String })
    updatedBy: string;

    @ApiProperty({ type: Date })
    updatedAt: Date;

    @ApiProperty({ type: String })
    deletedBy: string;

    @ApiProperty({ type: Date })
    deletedAt: Date;
}
