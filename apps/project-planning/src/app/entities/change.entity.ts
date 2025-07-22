import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

import { Project } from "./project.entity";

export enum Changetype {
    ADDITION = "ADDITION",
    MODIFICATION = "MODIFICATION",
    DELETION = "DELETION",
}

@Entity()
export class Change {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "enum", enum: Changetype })
    changeType: Changetype;

    @Column()
    changeDescription: string;

    @Column()
    changeDate: Date;

    @Column()
    requestor: string; // manual reference to the User Profile Entity from the [Profile Service] representing the requester of the change

    @Column()
    approver: string; // manual reference to the User Profile Entity from the [Profile Service] representing the approver of the change

    @ManyToOne(type => Project, project => project.changes)
    project: Project;


    @Column()
    updatedBy: string;

    @Column()
    updatedAt: Date;
}
