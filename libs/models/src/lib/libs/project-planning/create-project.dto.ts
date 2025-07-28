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

    @ApiProperty({ type: Date, nullable: true })
    endDate?: Date;

    @ApiProperty({ type: String })
    status: string;
}
