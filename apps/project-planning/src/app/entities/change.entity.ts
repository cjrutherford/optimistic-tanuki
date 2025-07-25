import { ChangeResolution, ChangeStatus, Changetype } from "@optimistic-tanuki/models";
import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

import { Project } from "./project.entity";

@Entity()
export class Change {
    @PrimaryGeneratedColumn("uuid")
    id: string;

    @Column({ type: "enum", enum: Changetype })
    changeType: Changetype;

    @Column({ type: "enum", enum: ChangeStatus, default: ChangeStatus.PENDING })
    status: ChangeStatus;

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

    @Column({ type: "enum", enum: ChangeResolution, default: ChangeResolution.PENDING })
    resolution: ChangeResolution;

    @Column()
    createdBy: string; // manual reference to the User Profile Entity from the [Profile Service] representing the creator of the change

    @Column()
    createdAt: Date;

    @Column()
    updatedBy: string;

    @Column()
    updatedAt: Date;

    @Column({ nullable: true })
    deletedAt?: Date;
}
