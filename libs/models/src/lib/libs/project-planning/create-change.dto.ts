import { ApiProperty } from "@nestjs/swagger";

export enum Changetype {
    ADDITION = "ADDITION",
    MODIFICATION = "MODIFICATION",
    DELETION = "DELETION",
}

export enum ChangeResolution {
    PENDING = "PENDING",
    APPROVED = "APPROVED",
    REJECTED = "REJECTED",
}

export class CreateChangeDto {
    @ApiProperty({ enum: Changetype, description: 'Type of change' })
    changeType: Changetype;

    @ApiProperty({ description: 'Description of the change' })
    changeDescription: string;

    @ApiProperty({ type: String, format: 'date-time', description: 'Date of the change' })
    changeDate: Date;

    @ApiProperty({ description: 'Requester user profile ID' })
    requestor: string; // manual reference to the User Profile Entity from the [Profile Service] representing the requester of the change

    @ApiProperty({ description: 'Approver user profile ID' })
    approver: string; // manual reference to the User Profile Entity from the [Profile Service] representing the approver of the change

    @ApiProperty({ description: 'Related project ID' })
    projectId: string; // manual reference to the Project Entity from the [Project Planning Service] representing a related party to the change
}
