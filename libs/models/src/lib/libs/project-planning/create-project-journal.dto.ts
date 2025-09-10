import { ApiProperty } from "@nestjs/swagger";

export class CreateProjectJournalDto {
    @ApiProperty({ type: String })
    profileId: string;

    @ApiProperty({ type: String })
    projectId: string;

    @ApiProperty({ type: String })
    content: string;

    @ApiProperty({ type: String, required: false })
    analysis?: string; 
}
