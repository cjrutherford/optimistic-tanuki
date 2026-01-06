import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsString, IsUUID, IsDate, MaxLength, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

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

export enum ChangeStatus {
    PENDING = "PENDING",
    RESEARCHING = "RESEARCHING",
    DISCUSSING = "DISCUSSING",
    DESIGNING = "DESIGNING",
    PENDING_APPROVAL = "PENDING_APPROVAL",
    IMPLEMENTING = "IMPLEMENTING",
    COMPLETE = "COMPLETE",
    DISCARDED = "DISCARDED",
}

export class CreateChangeDto {
    @ApiProperty({ enum: Changetype, description: 'Type of change' })
    @IsEnum(Changetype)
    changeType: Changetype;

    @ApiProperty({ description: 'Description of the change', example: 'Add new user authentication feature' })
    @IsString()
    @MinLength(10)
    @MaxLength(5000)
    changeDescription: string;

    @ApiProperty({ enum: ChangeStatus, description: 'Current status of the change' })
    @IsEnum(ChangeStatus)
    changeStatus: ChangeStatus;

    @ApiProperty({ type: String, format: 'date-time', description: 'Date of the change' })
    @IsDate()
    @Type(() => Date)
    changeDate: Date;

    @ApiProperty({ description: 'Requester user profile ID' })
    @IsString()
    @IsUUID()
    requestor: string; // manual reference to the User Profile Entity from the [Profile Service] representing the requester of the change

    @ApiProperty({ description: 'Approver user profile ID' })
    @IsString()
    @IsUUID()
    approver: string; // manual reference to the User Profile Entity from the [Profile Service] representing the approver of the change

    @ApiProperty({ description: 'Related project ID' })
    @IsString()
    @IsUUID()
    projectId: string; // manual reference to the Project Entity from the [Project Planning Service] representing a related party to the change
}
