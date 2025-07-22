import { ApiProperty } from '@nestjs/swagger';

export class CreateRiskDto {
    @ApiProperty({ description: 'Manual reference to the User Profile Entity from the [Profile Service] representing owner of the risk' })
    owner: string;

    @ApiProperty({ description: 'Manual reference to the Project Entity from the [Project Planning Service] representing a related party to the risk' })
    projectId: string;

    @ApiProperty()
    name: string;

    @ApiProperty()
    description: string;

    @ApiProperty()
    impact: string;

    @ApiProperty()
    likelihood: string;

    @ApiProperty()
    status: string;

    @ApiProperty()
    createdBy: string;

    @ApiProperty({ type: Date })
    createdAt: Date;

    @ApiProperty()
    updatedBy: string;

    @ApiProperty({ type: Date })
    updatedAt: Date;

    @ApiProperty()
    deletedBy: string;

    @ApiProperty({ type: Date })
    deletedAt: Date;
}
